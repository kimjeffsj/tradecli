import { describe, expect, it } from 'vitest';
import { createCandles } from '../../fixtures/helpers';
import { detectSwingPoints } from '../../../src/core/smc/swing';

describe('detectSwingPoints', () => {
  // --- 기본 동작 ---
  describe('SWING HIGH 감지', () => {
    it('명확한 고점을 SWING_HIGH로 감지', () => {
      // Given: 중간 캔들이 확연이 높은 시나리오
      // close: 100, 105, 110, 105, 100 -> 인덱스 2가 SWING_HIGH
      const candles = createCandles([100, 105, 110, 105, 100]);

      // When
      const result = detectSwingPoints(candles, 2);

      // Then
      const highs = result.filter((p) => p.type === 'SWING_HIGH');
      expect(highs).toHaveLength(1);
      expect(highs[0].index).toBe(2);
      expect(highs[0].price).toBe(candles[2].high);
    });

    it('여러 SWING_HIGH가 있으면 모두 감지', () => {
      // Given: 두 개의 고점 (인덱스 2, 6)
      // close: 100, 105, 110, 105, 100, 105, 112, 105, 100
      const candles = createCandles([100, 105, 110, 105, 100, 105, 112, 105, 100]);

      // When
      const result = detectSwingPoints(candles, 2);

      // Then
      const highs = result.filter((p) => p.type === 'SWING_HIGH');
      expect(highs).toHaveLength(2);
      expect(highs[0].index).toBe(2);
      expect(highs[1].index).toBe(6);
    });
  });

  describe('SWING_LOW 감지', () => {
    it('명확한 지점을 SWING_LOW로 감지', () => {
      // Given: 중간이 가장 낮은 시나리오
      // close: 110, 105, 100, 105, 110 -> 인덱스 2가 SWING_LOW
      const candles = createCandles([110, 105, 100, 105, 110]);

      // When
      const result = detectSwingPoints(candles, 2);

      // Then
      const lows = result.filter((p) => p.type === 'SWING_LOW');
      expect(lows).toHaveLength(1);
      expect(lows[0].index).toBe(2);
      expect(lows[0].price).toBe(candles[2].low);
    });
  });

  describe('고점과 저점 동시 감지', () => {
    it('지그재그 패턴에서 고점과 저점을 모두 감지', () => {
      // Given: 100 -> 110 -> 100 -> 110 -> 100
      const candles = createCandles([100, 110, 100, 110, 100]);

      // When
      const result = detectSwingPoints(candles, 1);

      // Then
      const highs = result.filter((p) => p.type === 'SWING_HIGH');
      const lows = result.filter((p) => p.type === 'SWING_LOW');
      expect(highs).toHaveLength(2); // 인덱스 1, 3
      expect(lows).toHaveLength(1); // 인덱스 2만 (0과 4는 경계)
      expect(lows[0].index).toBe(2);
      // lookback=1 이면 양쪽 1개씩 비교 -> 경계 캔들은 스윙 X
    });
  });

  // --- 엣지 케이스 ---
  describe('엣지 케이스', () => {
    it('캔들 수가 lookback*2+1 미만이면 빈 배열을 반환', () => {
      // Given: lookback=5 -> 최소 11개 필요, 3개만 있음
      const candles = createCandles([100, 105, 100]);

      // When
      const result = detectSwingPoints(candles, 5);

      // Then
      expect(result).toEqual([]);
    });

    it('캔들 배열이 비어 있으면 빈 배열을 반환', () => {
      const result = detectSwingPoints([], 5);
      expect(result).toEqual([]);
    });

    it('lookback을 크게 하면 더 적은 스윙 포인트가 감지된다', () => {
      // Given: 동일한 캔들에 lookback 2 vs lookback 4
      const candles = createCandles([100, 103, 107, 103, 100, 103, 107, 103, 100]);

      // When
      const small = detectSwingPoints(candles, 2);
      const large = detectSwingPoints(candles, 4);

      // Then: lookback이 클수록 스윙 포인트가 같거나 적다
      expect(large.length).toBeLessThanOrEqual(small.length);
    });

    it('결과는 index 오름차순으로 정렬된다', () => {
      // Given
      const candles = createCandles([100, 110, 100, 110, 100]);

      // When
      const result = detectSwingPoints(candles, 1);

      // Then
      const indices = result.map((p) => p.index);
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    });
  });

  describe('동일 가격 연속', () => {
    it('양쪽에 동일한 고점이 있으면 스윙으로 감지하지 않는다', () => {
      // Given: 110, 110, 110 -> 중간없이 고점이 아님 (동일)
      const candles = createCandles([110, 110, 110, 110, 110]);

      // When
      const result = detectSwingPoints(candles, 2);

      // Then: 엄격한 부등호 사용 -> 동일 값은 스윙 아님
      expect(result).toEqual([]);
    });
  });
});
