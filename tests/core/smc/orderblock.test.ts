import { describe, expect, it } from 'vitest';
import { detectOrderBlocks } from '../../../src/core/smc/orderblock';
import { Candle, StructureBreak, SwingPoint } from '../../../src/core/types';
import { createCandle } from '../../fixtures/helpers';

describe('detectOrderBlocks', () => {
  // --- 헬퍼: structure.test.ts 패턴 재사용 ---
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

  function makeSwing(
    type: 'SWING_HIGH' | 'SWING_LOW',
    price: number,
    index: number,
    candle: Candle
  ): SwingPoint {
    return { type, price, index, candle };
  }

  function makeBOS(
    direction: 'BULLISH' | 'BEARISH',
    brokenSwing: SwingPoint,
    confirmedAt: Candle,
    confirmedIndex: number
  ): StructureBreak {
    return {
      type: 'BOS',
      direction,
      brokenSwing,
      confirmedAt,
      confirmedIndex,
    };
  }

  // 1. Bullish OB 감지
  describe('Bullish OB 감지', () => {
    it('Bullish BOS 직전 마지막 bearish 캔들을 OB로 식별', () => {
      // Given: 캔들 배열에서 index 4가 bearish (close < open), index 7이 BOS 확정
      // [0] neutral, [1] bullish, [2] bullish, [3] bullish,
      // [4] bearish (OB 후보), [5] bullish, [6] bullish,
      // [7] BOS 확정 (close > swing high)
      const candles: Candle[] = [
        makeCandle(0, 100, 100, 105, 95), // doji — 무시
        makeCandle(1, 98, 102, 103, 97), // bullish
        makeCandle(2, 102, 106, 107, 101), // bullish
        makeCandle(3, 106, 108, 109, 105), // bullish
        makeCandle(4, 108, 103, 109, 102), // bearish ← OB 후보
        makeCandle(5, 103, 107, 108, 102), // bullish
        makeCandle(6, 107, 112, 113, 106), // bullish
        makeCandle(7, 112, 118, 119, 111), // BOS 확정 캔들
        makeCandle(8, 118, 120, 121, 117), // 이후 캔들
        makeCandle(9, 120, 122, 123, 119), // 이후 캔들
      ];

      const swingHigh = makeSwing('SWING_HIGH', 110, 3, candles[3]);
      const breaks: StructureBreak[] = [makeBOS('BULLISH', swingHigh, candles[7], 7)];

      // When
      const result = detectOrderBlocks(candles, breaks);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe('BULLISH');
      // OB 영역은 bearish 캔들 [4]의 high/low
      expect(result[0].high).toBe(109);
      expect(result[0].low).toBe(102);
      expect(result[0].createdAt).toBe(candles[4]);
      expect(result[0].status).toBe('FRESH');
    });
  });

  // 2. Bearish OB 감지
  describe('Bearish OB 감지', () => {
    it('Bearish BOS 직전 마지막 bullish 캔들을 OB로 식별', () => {
      // Given: index 4가 bullish (close > open), index 7이 Bearish BOS 확정
      const candles: Candle[] = [
        makeCandle(0, 100, 100, 105, 95),
        makeCandle(1, 102, 98, 103, 97), // bearish
        makeCandle(2, 98, 95, 99, 94), // bearish
        makeCandle(3, 95, 93, 96, 92), // bearish
        makeCandle(4, 93, 97, 98, 92), // bullish ← OB 후보
        makeCandle(5, 97, 94, 98, 93), // bearish
        makeCandle(6, 94, 91, 95, 90), // bearish
        makeCandle(7, 91, 85, 92, 84), // BOS 확정 (close < swing low)
        makeCandle(8, 85, 83, 86, 82),
        makeCandle(9, 83, 81, 84, 80),
      ];

      const swingLow = makeSwing('SWING_LOW', 90, 3, candles[3]);
      const breaks: StructureBreak[] = [makeBOS('BEARISH', swingLow, candles[7], 7)];

      // When
      const result = detectOrderBlocks(candles, breaks);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe('BEARISH');
      expect(result[0].high).toBe(98);
      expect(result[0].low).toBe(92);
      expect(result[0].createdAt).toBe(candles[4]);
      expect(result[0].status).toBe('FRESH');
    });
  });

  // 3. OB 재테스트 -> TESTED
  describe('OB 재테스트', () => {
    it('가격이 OB 영역에 진입하면 TESTED로 변경', () => {
      // Given: Bullish OB (low=102, high=109) 생성 후, 이후 캔들이 OB 영역 진입
      const candles: Candle[] = [
        makeCandle(0, 100, 100, 105, 95),
        makeCandle(1, 108, 103, 109, 102), // bearish ← OB
        makeCandle(2, 103, 107, 108, 102),
        makeCandle(3, 107, 115, 116, 106), // BOS 확정
        // 이후 가격이 되돌아와 OB 영역 진입
        makeCandle(4, 115, 110, 116, 108), // high=116, low=108 -> OB(102~109) 진입
        makeCandle(5, 110, 112, 113, 109),
      ];

      const swingHigh = makeSwing('SWING_HIGH', 110, 2, candles[2]);
      const breaks: StructureBreak[] = [makeBOS('BULLISH', swingHigh, candles[3], 3)];

      // When
      const result = detectOrderBlocks(candles, breaks);

      // Then: OB 영역(102~109)에 candle[4].low=108이 진입 -> TESTED
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('TESTED');
    });
  });

  // 4. OB 돌파 -> BROKEN
  describe('OB 돌파', () => {
    it('Bullish OB를 가격이 완전 관통하면 BROKEN', () => {
      // Given: Bullish OB (low=102, high=109) 생성 후, close가 OB.low 아래로
      const candles: Candle[] = [
        makeCandle(0, 100, 100, 105, 95),
        makeCandle(1, 108, 103, 109, 102), // bearish ← OB
        makeCandle(2, 103, 107, 108, 102),
        makeCandle(3, 107, 115, 116, 106), // BOS 확정
        // 되돌아와 OB 진입 (TESTED)
        makeCandle(4, 115, 106, 116, 105), // low=105 -> OB(102~109) 진입
        // OB 관통 — close < OB.low(102)
        makeCandle(5, 106, 99, 107, 98), // close=99 < 102 -> BROKEN
      ];

      const swingHigh = makeSwing('SWING_HIGH', 110, 2, candles[2]);
      const breaks: StructureBreak[] = [makeBOS('BULLISH', swingHigh, candles[3], 3)];

      // When
      const result = detectOrderBlocks(candles, breaks);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('BROKEN');
    });
  });

  // 5. BOS 없으면 OB 없음
  describe('BOS 없음', () => {
    it('breaks가 비어있으면 빈 배열 반환', () => {
      const candles: Candle[] = [
        makeCandle(0, 100, 102, 103, 99),
        makeCandle(1, 102, 104, 105, 101),
      ];

      const result = detectOrderBlocks(candles, []);

      expect(result).toEqual([]);
    });

    it('CHoCH만 있으면 OB 생성하지 않음', () => {
      const candles: Candle[] = [
        makeCandle(0, 100, 100, 105, 95),
        makeCandle(1, 108, 103, 109, 102),
        makeCandle(2, 103, 107, 108, 102),
        makeCandle(3, 107, 115, 116, 106),
      ];

      const swingHigh = makeSwing('SWING_HIGH', 110, 2, candles[2]);
      const breaks: StructureBreak[] = [
        {
          type: 'CHOCH', // CHoCH는 OB 대상 아님
          direction: 'BULLISH',
          brokenSwing: swingHigh,
          confirmedAt: candles[3],
          confirmedIndex: 3,
        },
      ];

      const result = detectOrderBlocks(candles, breaks);
      expect(result).toEqual([]);
    });
  });
});
