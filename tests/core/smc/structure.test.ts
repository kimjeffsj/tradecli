import { describe, expect, it } from 'vitest';
import { Candle, SwingPoint } from '../../../src/core/types';
import { createCandle } from '../../fixtures/helpers';
import { analyzeStructure } from '../../../src/core/smc/structure';

describe('analyzeStructure', () => {
  // --- 헬퍼: 테스트용 캔들+스윙 세트를 간결하게 만들기 위해 ---

  // 캔들 배열을 OHLC로 직접 구성하는 헬퍼
  // close가 돌파 판단 기준이므로 close를 정밀 제어해야 함
  function makeCandle(index: number, close: number, high: number, low: number): Candle {
    return createCandle({
      timestamp: 1_700_000_000_000 + index * 3_600_000,
      open: close,
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

  // 1. 상승 추세에서 BOS (higher high 돌파)
  describe('상승 추세에서 BOS', () => {
    it('swing high를 close로 상방 돌파하면 BOS(BULLISH)를 반환', () => {
      // Given: SL(90) -> SH(110) -> SL(95) -> SH(115)
      // 캔들 [7]의 close가 SH(110)의 price를 상방 돌파
      const candles: Candle[] = [];
      for (let i = 0; i < 10; i++) {
        // 기본 캔들 - close로 돌파 여부 판단
        candles.push(makeCandle(i, 100, 105, 95));
      }

      // 돌파 캔들: close가 swing high price(110*1.01=111.1)보다 높아야 함
      candles[7] = makeCandle(7, 115, 116, 108);

      const swings: SwingPoint[] = [
        makeSwing('SWING_LOW', 90, 1, candles[1]),
        makeSwing('SWING_HIGH', 110, 1, candles[3]),
        makeSwing('SWING_LOW', 95, 1, candles[5]),
      ];

      // When
      const result = analyzeStructure(candles, swings);

      // Then
      expect(result.breaks).toHaveLength(1);
      expect(result.breaks[0].type).toBe('BOS');
      expect(result.breaks[0].direction).toBe('BULLISH');
      expect(result.breaks[0].brokenSwing).toBe(swings[1]); // SH(110) 돌파
      expect(result.breaks[0].confirmedIndex).toBe(7);
    });
  });

  // 2. 하락 추세에서 BOS (lower low 돌파)
  describe('하락 추세에서 BOS', () => {
    it('swing low를 close로 하방 돌파하면 BOS(BEARISH)를 반환', () => {
      // Given: SH(110) -> SL(90) -> SH(105) -> 캔들이 SL(90) 하방 돌파
      const candles: Candle[] = [];
      for (let i = 0; i < 10; i++) {
        candles.push(makeCandle(i, 100, 105, 95));
      }
      // 돌파 캔들: close가 swing low price(90)보다 낮아야 함
      candles[7] = makeCandle(7, 85, 92, 83);

      const swings: SwingPoint[] = [
        makeSwing('SWING_HIGH', 110, 1, candles[1]),
        makeSwing('SWING_LOW', 90, 3, candles[3]),
        makeSwing('SWING_HIGH', 105, 5, candles[5]),
      ];

      // When
      const result = analyzeStructure(candles, swings);

      // Then
      expect(result.breaks).toHaveLength(1);
      expect(result.breaks[0].type).toBe('BOS');
      expect(result.breaks[0].direction).toBe('BEARISH');
      expect(result.breaks[0].brokenSwing).toBe(swings[1]); // SL(90) 돌파;
      expect(result.breaks[0].confirmedIndex).toBe(7);
    });
  });

  // 3. 상승 -> 하락 CHoCH
  describe('상승->하락 CHoCH', () => {
    it('BULLISH 추세 중 swing low 하방 돌파 시 CHoCH(BEARISH)를 반환', () => {
      // Given: 먼저 BOS로 BULLISH 확정 -> 이후 swing low 하방 돌파
      // SL(90) -> SH(110) -> SL(95) -> close>110(BOS) -> SH(120) -> SL(100) -> close<100(CHoCH)
      const candles: Candle[] = [];
      for (let i = 0; i < 15; i++) {
        candles.push(makeCandle(i, 105, 108, 102));
      }
      // BOS 확정 캔들 (close > SH 110)
      candles[6] = makeCandle(6, 115, 116, 108);
      // CHoCH 확정 캔들 (close < SL 100)
      candles[12] = makeCandle(12, 88, 99, 85);

      const swings: SwingPoint[] = [
        makeSwing('SWING_LOW', 90, 1, candles[1]),
        makeSwing('SWING_HIGH', 110, 3, candles[3]),
        makeSwing('SWING_LOW', 95, 5, candles[5]),
        // BOS 발생 후 새로운 스윙
        makeSwing('SWING_HIGH', 120, 8, candles[8]),
        makeSwing('SWING_LOW', 100, 10, candles[10]),
      ];

      // When
      const result = analyzeStructure(candles, swings);

      // Then: BOS 1개 + CHoCH 1개
      expect(result.breaks).toHaveLength(2);
      expect(result.breaks[0].type).toBe('BOS');
      expect(result.breaks[0].direction).toBe('BULLISH');
      expect(result.breaks[1].type).toBe('CHOCH');
      expect(result.breaks[1].direction).toBe('BEARISH');
      expect(result.breaks[1].brokenSwing.price).toBe(100); // SL(100) 돌파
      expect(result.direction).toBe('BEARISH'); // 최종 방향 전환됨
    });
  });

  // 4. 하락 -> 상승 CHoCH
  describe('하락->상승 CHoCH', () => {
    it('BEARISH 추세 중 swing high 상방 돌파 시 CHoCH(BULLISH)를 반환', () => {
      // Given: 먼저 BOS로 BEARISH 확정 -> 이후 swing high 상방 돌파
      const candles: Candle[] = [];
      for (let i = 0; i < 15; i++) {
        candles.push(makeCandle(i, 100, 105, 95));
      }
      // BOS 확정 캔들 (close < SL 90)
      candles[6] = makeCandle(6, 85, 92, 83);
      // CHoCH 확정 캔들 (close > SH 105)
      candles[12] = makeCandle(12, 112, 114, 108);

      const swings: SwingPoint[] = [
        makeSwing('SWING_HIGH', 110, 1, candles[1]),
        makeSwing('SWING_LOW', 90, 3, candles[3]),
        makeSwing('SWING_HIGH', 105, 5, candles[5]),
        // BOS 발생 후 새로운 스윙
        makeSwing('SWING_LOW', 80, 8, candles[8]),
        makeSwing('SWING_HIGH', 105, 10, candles[10]),
      ];

      // When
      const result = analyzeStructure(candles, swings);

      // Then
      expect(result.breaks).toHaveLength(2);
      expect(result.breaks[0].type).toBe('BOS');
      expect(result.breaks[0].direction).toBe('BEARISH');
      expect(result.breaks[1].type).toBe('CHOCH');
      expect(result.breaks[1].direction).toBe('BULLISH');
      expect(result.direction).toBe('BULLISH');
    });
  });

  // 5. 횡보 구간 - 돌파 없음
  describe('횡보 구간', () => {
    it('어떤 swing도 돌파하지 않으면 빈 배열을 반환', () => {
      // Given: 모든 캔들의 close가 swing high/low 사이에 머뭂
      const candles: Candle[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(makeCandle(i, 100, 103, 97));
      }

      const swings: SwingPoint[] = [
        makeSwing('SWING_HIGH', 110, 2, candles[2]),
        makeSwing('SWING_LOW', 90, 4, candles[4]),
        makeSwing('SWING_HIGH', 108, 6, candles[6]),
      ];

      // When
      const result = analyzeStructure(candles, swings);

      // Then
      expect(result.breaks).toEqual([]);
      expect(result.direction).toBeUndefined();
    });
  });

  // 6. 연속 BOS - 방향 유지
  describe('연속 BOS', () => {
    it('같은 방향으로 연속 돌파하면 모두 BOS이고 방향을 유지', () => {
      // Given: SL -> SH(110) -> SL -> close>110(BOS) -> SH(120) -> SL -> close > 120(BOS);
      const candles: Candle[] = [];
      for (let i = 0; i < 15; i++) {
        candles.push(makeCandle(i, 105, 108, 102));
      }
      // 첫 BOS
      candles[6] = makeCandle(6, 115, 116, 108);
      // 두 번째 BOS
      candles[12] = makeCandle(12, 125, 126, 118);

      const swings: SwingPoint[] = [
        makeSwing('SWING_LOW', 90, 1, candles[1]),
        makeSwing('SWING_HIGH', 110, 3, candles[3]),
        makeSwing('SWING_LOW', 95, 5, candles[5]),
        makeSwing('SWING_HIGH', 120, 8, candles[8]),
        makeSwing('SWING_LOW', 100, 10, candles[10]),
      ];

      // When
      const result = analyzeStructure(candles, swings);

      // Then: BOS 2개, 방향 유지
      expect(result.breaks).toHaveLength(2);
      expect(result.breaks[0].type).toBe('BOS');
      expect(result.breaks[0].direction).toBe('BULLISH');
      expect(result.breaks[1].type).toBe('BOS');
      expect(result.breaks[1].direction).toBe('BULLISH');
      expect(result.direction).toBe('BULLISH');
    });
  });
});
