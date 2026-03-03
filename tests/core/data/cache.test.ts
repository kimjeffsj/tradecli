import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CachedDataAdapter, FileCache } from '../../../src/core/data/cache';
import { createCandles } from '../../fixtures/helpers';
import { MockDataAdapter } from '../../../src/core/data/adapters/mock';

// 테스트 전용 캐시 디렉토리
const TEST_CACHE_DIR = '.cache/test-tradecli';

// 매 테스트 전: 기존 테스트 캐시 디렉토리 클리어
beforeEach(async () => {
  await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

// 매 테스트 후: 테스트 캐시 디렉토리 정리
afterEach(async () => {
  await fs.rm(TEST_CACHE_DIR, { recursive: true, force: true });
  vi.useRealTimers(); // fake timer 사용한 테스트 후 복원
});

// 테스트용 공통 FetchOptions
const baseOptions = {
  pair: 'XAUUSD',
  timeframe: 'H1' as const,
  from: 1_700_000_000_000,
  to: 1_700_100_000_000,
};

describe('FileCache', () => {
  // --- 캐시 miss 시나리오 ---
  describe('캐시 miss', () => {
    it('파일이 없으면 null을 반환한다', async () => {
      // Given
      const cache = new FileCache({ dir: TEST_CACHE_DIR });

      // When
      const result = await cache.get(baseOptions);

      // Then
      expect(result).toBeNull();
    });
  });

  // --- 캐시 hit 시나리오 ---
  describe('캐시 hit', () => {
    it('저장한 캔들을 그대로 반환한다', async () => {
      // Given
      const cache = new FileCache({ dir: TEST_CACHE_DIR });
      const candles = createCandles([1800, 1810, 1820]);

      // When
      await cache.set(baseOptions, candles);
      const result = await cache.get(baseOptions);

      // Then
      expect(result).toEqual(candles);
    });

    it('다른 pair의 캐시와 독립적으로 저장된다', async () => {
      // Given
      const cache = new FileCache({ dir: TEST_CACHE_DIR });
      const goldCandles = createCandles([1800, 1810]);
      const eurCandles = createCandles([1.05, 1.06]);

      // When: 두 가지 다른 페어를 각각 저장
      await cache.set({ ...baseOptions, pair: 'XAUUSD' }, goldCandles);
      await cache.set({ ...baseOptions, pair: 'EURUSD' }, eurCandles);

      // Then: 각각 독립적으로 조회 가능
      expect(await cache.get({ ...baseOptions, pair: 'XAUUSD' })).toEqual(goldCandles);
      expect(await cache.get({ ...baseOptions, pair: 'EURUSD' })).toEqual(eurCandles);
    });
  });

  // --- TTL 만료 시나리오 ---
  describe('TTL 만료', () => {
    it('TTL이 지난 캐시는 null을 반환한다', async () => {
      // Given: 기준 시각을 고정하고 fake timer 시작
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const cache = new FileCache({ dir: TEST_CACHE_DIR, ttl: 100 });
      const candles = createCandles([1800]);
      await cache.set(baseOptions, candles);

      // When: 200ms 후 시스템 시각 이동
      vi.setSystemTime(now + 200); // Date.now() = now + 200 > expiresAt
      const result = await cache.get(baseOptions);

      // Then: 만료됐으므로 null
      expect(result).toBeNull();
    });

    it('TTL이 남아 있으면 캐시 hit', async () => {
      // Given: TTL 1시간
      const cache = new FileCache({ dir: TEST_CACHE_DIR, ttl: 60 * 60 * 1000 });
      const candles = createCandles([1800]);
      await cache.set(baseOptions, candles);

      //  When: 30분 후 조회
      vi.useFakeTimers();
      vi.advanceTimersByTime(30 * 60 * 1000);

      const result = await cache.get(baseOptions);

      // Then: 아직 유효하므로 hit
      expect(result).toEqual(candles);
    });
  });

  // --- 캐시 클리어 ---
  describe('clear', () => {
    it('클리어 후 모든 캐시 클리어', async () => {
      // Given
      const cache = new FileCache({ dir: TEST_CACHE_DIR });
      await cache.set(baseOptions, createCandles([1800]));
      await cache.set({ ...baseOptions, pair: 'EURUSD' }, createCandles([1.05]));

      // When
      await cache.clear();

      // Then: 디렉토리 자체가 사라짐
      const exists = await fs
        .access(TEST_CACHE_DIR)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });
});

describe('CachedDataAdapter', () => {
  it('캐시 miss 시 inner adapter를 호출', async () => {
    // Given
    const mockCandles = createCandles([1800, 1810, 1820]);
    const inner = new MockDataAdapter({ candles: mockCandles });
    const adapter = new CachedDataAdapter(inner, { dir: TEST_CACHE_DIR });

    // When
    const result = await adapter.fetchCandles(baseOptions);

    // Then: MockDataAdapter가 캔들을 반환해야 함
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('close');
  });

  it('캐시 hit 시 inner adapter를 다시 호출 하지 않는다', async () => {
    // Give: inner를 spy로 감싸서 호출 횟수 추적
    const mockCandles = createCandles([1800, 1810, 1820]);
    const inner = new MockDataAdapter({ candles: mockCandles });
    const fetchSpy = vi.spyOn(inner, 'fetchCandles');
    const adapter = new CachedDataAdapter(inner, { dir: TEST_CACHE_DIR });

    // When: 동일한 옵션으로 두 번 호출
    await adapter.fetchCandles(baseOptions);
    await adapter.fetchCandles(baseOptions);

    // Then: inner.fetchCandles 는 한 번만 호출 되어야 함
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('adapter name이 "cached(mock)"이다', () => {
    // Given
    const inner = new MockDataAdapter();
    const adapter = new CachedDataAdapter(inner, { dir: TEST_CACHE_DIR });

    // Then
    expect(adapter.name).toBe('cached(mock)');
  });

  it('clearCache 후 재호출 시 inner adapter를 다시 호출', async () => {
    // Given
    const mockCandles = createCandles([1800]);
    const inner = new MockDataAdapter({ candles: mockCandles });
    const fetchSpy = vi.spyOn(inner, 'fetchCandles');
    const adapter = new CachedDataAdapter(inner, { dir: TEST_CACHE_DIR });

    // When: 첫 호출 -> 캐시 저장 -> clear -> 재호출
    await adapter.fetchCandles(baseOptions);
    await adapter.clearCache();
    await adapter.fetchCandles(baseOptions);

    // Then: inner 는 총 2번 호출됨
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
