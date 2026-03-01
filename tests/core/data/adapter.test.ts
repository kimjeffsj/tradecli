import { describe, it, expect } from 'vitest';
import { createCandles } from '../../fixtures/helpers';
import { MockDataAdapter } from '../../../src/core/data/adapters/mock';
import { DataFetchError } from '../../../src/core/data/adapters/adapter';

describe('MockDataAdapter', () => {
  describe('fetchCandle()', () => {
    it('should return injected candles', async () => {
      // Given: 캔들 3개를 주입한 Mock 어댑터
      const candles = createCandles([1800, 1810, 1820]);
      const adapter = new MockDataAdapter({ candles });

      // When
      const result = await adapter.fetchCandles({
        pair: 'XAUUSD',
        timeframe: 'H4',
      });

      // Then
      expect(result).toHaveLength(3);
      expect(result[0].close).toBe(1800);
    });

    it('should respect limit options', async () => {
      // Given
      const candles = createCandles([1800, 1810, 1820, 1830, 1840]);
      const adapter = new MockDataAdapter({ candles });

      // When: limit 2 요청
      const result = await adapter.fetchCandles({
        pair: 'XAUUSD',
        timeframe: 'H4',
        limit: 2,
      });

      // Then: 2개 반환
      expect(result).toHaveLength(2);
    });

    it('should throw DataFetchError when shouldFail is true', async () => {
      // Given: 실패하도록 설정한 어댑터
      const adapter = new MockDataAdapter({ shouldFail: true });

      // When / Then: DataFetchError 가 throw 되어야 함
      await expect(adapter.fetchCandles({ pair: 'XAUUSD', timeframe: 'H4' })).rejects.toThrow(
        DataFetchError
      );
    });

    it('should return empty array when no candles injected', async () => {
      const adapter = new MockDataAdapter();
      const result = await adapter.fetchCandles({
        pair: 'XAUUSD',
        timeframe: 'H4',
      });
      expect(result).toEqual([]);
    });
  });

  describe('getSupportedPairs()', () => {
    it('should return default pairs when none specified', async () => {
      const adapter = new MockDataAdapter();
      const pairs = await adapter.getSupportedPairs();
      expect(pairs).toContain('XAUUSD');
    });

    it('should return custom pairs when specified', async () => {
      const adapter = new MockDataAdapter({ supportedPairs: ['BTCUSD'] });
      const pairs = await adapter.getSupportedPairs();
      expect(pairs).toEqual(['BTCUSD']);
    });
  });

  describe('getSupportedTimeframes()', () => {
    it('should include H4 and D1', () => {
      const adapter = new MockDataAdapter();
      const tfs = adapter.getSupportedTimeframes();
      expect(tfs).toContain('H4');
      expect(tfs).toContain('D1');
    });
  });
});
