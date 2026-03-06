import { describe, expect, it } from 'vitest';
import { detectFVG } from '../../../src/core/smc/fvg';
import { Candle } from '../../../src/core/types';
import { createCandle } from '../../fixtures/helpers';

describe('detectFVG', () => {
  // --- 헬퍼: orderblock.test.ts 패턴 재사용 ---
  function makeCandle(
    index: number,
    open: number,
    close: number,
    high: number,
    low: number
  ): Candle {
    return createCandle({
      timestamp: 1_700_000_000_000 + index * 3_600_000,
      open,
      high,
      low,
      close,
    });
  }

  // 1. Bullish FVG 감지
  describe('Bullish FVG 감지', () => {
    it('candle[0].high < candle[2].low 이면 Bullish FVG 생성', () => {
      // Given: 3캔들 구조에서 첫째 high(105) < 셋째 low(108) -> 갭 존재
      const candles: Candle[] = [
        makeCandle(0, 100, 104, 105, 99), // high=105
        makeCandle(1, 104, 112, 113, 103), // impulse (강한 상승)
        makeCandle(2, 112, 115, 116, 108), // low=108
      ];

      // When
      const result = detectFVG(candles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe('BULLISH');
      // 갭 영역: 첫째 high(105) ~ 셋째 low(108)
      expect(result[0].low).toBe(105);
      expect(result[0].high).toBe(108);
      expect(result[0].formedAt).toBe(candles[1]); // impulse 캔들
      expect(result[0].formedIndex).toBe(1);
      expect(result[0].status).toBe('OPEN');
      expect(result[0].fillPercentage).toBe(0);
    });
  });

  // 2. Bearish FVG 감지
  describe('Bearish FVG 감지', () => {
    it('candle[0].low > candle[2].high 이면 Bearish FVG 생성', () => {
      // Given: 3캔들 구조에서 첫째 low(95) > 셋째 high(92) -> 갭 존재
      const candles: Candle[] = [
        makeCandle(0, 100, 96, 101, 95), // low=95
        makeCandle(1, 96, 88, 97, 87), // impulse (강한 하락)
        makeCandle(2, 88, 90, 92, 86), // high=92
      ];

      // When
      const result = detectFVG(candles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe('BEARISH');
      // 갭 영역: 셋째 high(92) ~ 첫째 low(95)
      expect(result[0].low).toBe(92);
      expect(result[0].high).toBe(95);
      expect(result[0].formedAt).toBe(candles[1]);
      expect(result[0].formedIndex).toBe(1);
      expect(result[0].status).toBe('OPEN');
      expect(result[0].fillPercentage).toBe(0);
    });
  });

  // 3. 부분 fill -> PARTIALLY_FILLED
  describe('FVG 부분 충전', () => {
    it('이후 캔들이 FVG 일부 진입 시 PARTIALLY_FILLED', () => {
      // Given: Bullish FVG (low=105, high=108, gapSize=3)
      // 이후 캔들 low=107 -> fill = (108 - 107) / 3 ≈ 0.333
      const candles: Candle[] = [
        makeCandle(0, 100, 104, 105, 99), // high=105
        makeCandle(1, 104, 112, 113, 103), // impulse
        makeCandle(2, 112, 115, 116, 108), // low=108
        // fill 캔들: low=107이 갭 영역(105~108)에 진입
        makeCandle(3, 115, 113, 116, 107),
      ];

      // When
      const result = detectFVG(candles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('PARTIALLY_FILLED');
      // fill = (108 - 107) / (108 - 105) = 1/3
      expect(result[0].fillPercentage).toBeCloseTo(1 / 3, 5);
    });
  });

  // 4. 완전 fill -> FILLED
  describe('FVG 완전 충전', () => {
    it('이후 캔들이 FVG를 완전 관통하면 FILLED', () => {
      // Given: Bullish FVG (low=105, high=108, gapSize=3)
      // 이후 캔들 low=104 -> fill = (108 - 104) / 3 = 4/3 -> clamp 1
      const candles: Candle[] = [
        makeCandle(0, 100, 104, 105, 99), // high=105
        makeCandle(1, 104, 112, 113, 103), // impulse
        makeCandle(2, 112, 115, 116, 108), // low=108
        // fill 캔들: low=104 -> FVG 완전 관통
        makeCandle(3, 115, 106, 116, 104),
      ];

      // When
      const result = detectFVG(candles);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('FILLED');
      expect(result[0].fillPercentage).toBe(1);
    });
  });

  // 5. FVG 없는 구간
  describe('FVG 없는 구간', () => {
    it('갭이 없으면 빈 배열 반환', () => {
      // Given: 캔들들이 서로 겹침 — 갭 없음
      const candles: Candle[] = [
        makeCandle(0, 100, 103, 104, 99), // high=104
        makeCandle(1, 103, 105, 106, 102), // impulse
        makeCandle(2, 105, 107, 108, 103), // low=103 < candle[0].high(104) -> 갭 없음
      ];

      // When
      const result = detectFVG(candles);

      // Then
      expect(result).toEqual([]);
    });

    it('캔들이 3개 미만이면 빈 배열 반환', () => {
      const candles: Candle[] = [
        makeCandle(0, 100, 103, 104, 99),
        makeCandle(1, 103, 105, 106, 102),
      ];

      const result = detectFVG(candles);
      expect(result).toEqual([]);
    });
  });
});
