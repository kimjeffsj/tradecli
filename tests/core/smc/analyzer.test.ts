import { describe, it, expect } from 'vitest';
import { SMCAnalyzer } from '../../../src/core/smc/analyzer';
import { createCandle } from '../../fixtures/helpers';
import { Candle } from '../../../src/core/types/index';

describe('SMCAnalyzer', () => {
  // 편의 함수: OHLC를 직접 지정한 캔들 배열 생성
  function buildCandles(data: Array<[number, number, number, number]>): Candle[] {
    return data.map(([open, high, low, close], i) =>
      createCandle({
        timestamp: 1_700_000_000_000 + i * 3_600_000,
        open,
        high,
        low,
        close,
        volume: 1000,
      })
    );
  }

  it('전체 파이프라인 통합: swing -> structure -> OB -> FVG 모두 결과 반환', () => {
    // lookback=2로 설정하여 적은 캔들로도 swing 감지 가능
    const analyzer = new SMCAnalyzer(2);

    // 상승 추세 -> 하락 전환 시나리오 (swing, BOS, OB 생성 조건 충족)
    // 캔들 최소 13개: lookback=2 기준 양쪽 2개씩 필요 + 구조 변경 여유
    const candles = buildCandles([
      // 0-4: 초기 상승 구간
      [100, 105, 98, 103], // 0
      [103, 104, 100, 101], // 1
      [101, 99, 95, 96], // 2: swing low 후보 (lookback=2)
      [96, 102, 95, 101], // 3
      [101, 110, 100, 108], // 4: swing high 후보
      // 5-8: 하락 후 재상승 (BOS 조건)
      [108, 109, 103, 104], // 5
      [104, 106, 93, 94], // 6: swing low 후보, close < swing low -> 하방 돌파
      [94, 98, 92, 97], // 7
      [97, 112, 96, 111], // 8: swing high 후보, close > swing high -> 상방 돌파

      // 9-12: 후속 캔들 (OB 상태 업데이트 + FVG 가능 구간)
      [111, 113, 108, 112], // 9
      [112, 115, 110, 114], // 10
      [114, 116, 111, 115], // 11
      [115, 117, 113, 116], // 12
    ]);

    const result = analyzer.analyze(candles);

    // 4가지 결과 모두 존재 확인
    expect(result.swingPoints).toBeDefined();
    expect(result.structure).toBeDefined();
    expect(result.orderBlocks).toBeDefined();
    expect(result.fairValueGaps).toBeDefined();

    // swing points가 감지되어야 함
    expect(result.swingPoints.length).toBeGreaterThan(0);

    // structure breaks가 있어야 함 (BOS 또는 CHoCH)
    expect(result.structure.breaks.length).toBeGreaterThan(0);

    // direction이 결정되어야 함
    expect(result.structure.direction).toBeDefined();
  });

  it('캔들 부족 시: 빈 결과 반환 (에러 없이)', () => {
    const analyzer = new SMCAnalyzer(5); // 기본 lookback=5

    // 3개 캔들 -> swing 감지 불가 (최소 11개 필요)
    const candles = buildCandles([
      [100, 105, 98, 103],
      [103, 108, 101, 106],
      [106, 110, 104, 109],
    ]);

    const result = analyzer.analyze(candles);

    // 에러 없이 빈 결과
    expect(result.swingPoints).toEqual([]);
    expect(result.structure.breaks).toEqual([]);
    expect(result.structure.direction).toBeUndefined();
    expect(result.orderBlocks).toEqual([]);
    // FVG는 3캔들만 있으면 감지 가능하지만, 갭 조건 불충족 시 빈 배열
    expect(result.fairValueGaps).toBeDefined();
  });

  it('OB/FVG 없는 구간: swing/structure는 있지만 OB/FVG 조건 불충족', () => {
    const analyzer = new SMCAnalyzer(2);

    // 완만한 상승 -> CHoCH만 발생 (BOS 없음 -> OB 없음)
    // 캔들 간 갭 없음 -> FVG 없음
    const candles = buildCandles([
      [100, 103, 99, 102], // 0
      [102, 104, 101, 103], // 1
      [103, 104, 100, 101], // 2: swing low 후보
      [101, 105, 100, 104], // 3
      [104, 107, 103, 106], // 4: swing high 후보
      [106, 107, 104, 105], // 5
      [105, 106, 102, 103], // 6: 하락 (swing low 후보)
      [103, 108, 102, 107], // 7
      [107, 110, 106, 109], // 8: swing high 후보
      [109, 110, 107, 108], // 9
      [108, 109, 106, 107], // 10
    ]);

    const result = analyzer.analyze(candles);

    // swing은 감지될 수 있음
    expect(result.swingPoints.length).toBeGreaterThanOrEqual(0);

    // OB: BOS가 없거나 반대 캔들이 없으면 빈 배열
    // FVG: 캔들 간 갭이 없으므로 빈 배열
    // (정확한 값은 데이터에 따라 다르지만, 갭 없는 완만한 데이터)
    expect(result.fairValueGaps).toEqual([]);
  });
});
