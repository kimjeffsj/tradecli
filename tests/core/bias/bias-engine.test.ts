import { describe, expect, it } from 'vitest';
import { DataAdapter, FetchOptions } from '../../../src/core/data/adapters/adapter';
import { Candle, Timeframe } from '../../../src/core/types';
import { createCandle } from '../../fixtures/helpers';
import { BiasEngine } from '../../../src/core/bias';

/**
 * 결정론적 테스트용 StubAdapter
 * 타임프레임별로 다른 캔들 패턴 반환 — 방향 제어 가능
 */
class StubAdapter implements DataAdapter {
  readonly name = 'stub';

  constructor(
    // TF -> 캔들 배열 매핑 — 테스트에서 원하는 패턴 주입
    private readonly candleMap: Partial<Record<Timeframe, Candle[]>>
  ) {}

  async fetchCandles(options: FetchOptions): Promise<Candle[]> {
    const candles = this.candleMap[options.timeframe];
    if (!candles) throw new Error(`No stub data for ${options.timeframe}`);
    return candles;
  }

  async getSupportedPairs(): Promise<string[]> {
    return ['XAUUSD'];
  }

  getSupportedTimeframes(): Timeframe[] {
    return Object.keys(this.candleMap) as Timeframe[];
  }
}

// 상승 추세 캔들 생성 — SMCAnalyzer가 BULLISH direction 판정하도록
// lookback=2 기준, 충분한 swing + BOS 조건 충족
function makeBullishCandles(): Candle[] {
  const data: Array<[number, number, number, number]> = [
    [100, 103, 98, 102],
    [102, 104, 100, 101],
    [101, 102, 95, 96], // swing low
    [96, 103, 95, 102],
    [102, 110, 101, 109], // swing high
    [109, 111, 106, 107],
    [107, 108, 93, 94], // swing low -> lower low
    [94, 99, 92, 98],
    [98, 115, 97, 114], // close > prev swing high -> BULLISH BOS
    [114, 118, 112, 117],
    [117, 120, 115, 119],
    [119, 122, 117, 121],
    [121, 124, 119, 123],
  ];
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

// 하락 추세 캔들 — BEARISH direction
function makeBearishCandles(): Candle[] {
  const data: Array<[number, number, number, number]> = [
    [200, 205, 198, 199],
    [199, 202, 196, 197],
    [197, 204, 196, 203], // swing high
    [203, 205, 199, 200],
    [200, 201, 192, 193], // swing low
    [193, 197, 191, 196],
    [196, 210, 195, 209], // swing high -> higher high
    [209, 211, 205, 206],
    [206, 207, 188, 189], // close < prev swing low -> BEARISH BOS
    [189, 192, 186, 187],
    [187, 189, 184, 185],
    [185, 187, 182, 183],
    [183, 185, 180, 181],
  ];
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

describe('BiasEngine', () => {
  it('BiasResult 구조 검증: 모든 필드 존재 + 타입 확인', async () => {
    const adapter = new StubAdapter({
      D1: makeBullishCandles(),
      H4: makeBullishCandles(),
      H1: makeBullishCandles(),
    });

    const engine = new BiasEngine(adapter, {
      weights: { D1: 0.5, H4: 0.3, H1: 0.2 },
      lookback: 2, // stub 캔들이 lookback=2 기준
    });

    const result = await engine.calculate('XAUUSD');

    // 모든 필드 존재
    expect(result.pair).toBe('XAUUSD');
    expect(result.bias).toBeDefined();
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.weightedScore).toBe('number');
    expect(result.timeframes).toHaveLength(3);
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 형식

    // 타임프레임별 상세도 검증
    for (const tf of result.timeframes) {
      expect(tf.timeframe).toBeDefined();
      expect(tf.weight).toBeGreaterThan(0);
    }
  });

  it('커스텀 config: weights/threshold 반영 확인', async () => {
    const adapter = new StubAdapter({
      W1: makeBullishCandles(),
      D1: makeBearishCandles(),
    });

    const engine = new BiasEngine(adapter, {
      weights: { W1: 0.7, D1: 0.3 },
      threshold: 0.1,
      lookback: 2,
    });

    const result = await engine.calculate('XAUUSD');

    // 2개 TF만 분석
    expect(result.timeframes).toHaveLength(2);
    // W1(0.7) BULLISH + D1(0.3) BEARISH -> score = 0.7 - 0.3 = 0.4
    expect(result.timeframes.find((t) => t.timeframe === 'W1')?.weight).toBe(0.7);
    expect(result.timeframes.find((t) => t.timeframe === 'D1')?.weight).toBe(0.3);
  });

  it('어댑터 에러 시 에러 전파', async () => {
    const adapter = new StubAdapter({}); // 빈 맵 — 모든 TF에서 에러

    const engine = new BiasEngine(adapter, {
      weights: { D1: 0.5 },
      lookback: 2,
    });

    // fetchCandles에서 throw -> Promise.all reject -> 에러 전파
    await expect(engine.calculate('XAUUSD')).rejects.toThrow();
  });
});
