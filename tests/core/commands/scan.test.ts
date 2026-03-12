import { describe, expect, it } from 'vitest';
import { parsePairs } from '../../../src/core/report/parse-pairs';
import { Timeframe } from '../../../src/core/types';

describe('scan command logic', () => {
  it('다중 페어 파싱 + 결과 개수 확인', () => {
    const pairs = parsePairs('XAUUSD,EURUSD,GBPUSD');
    expect(pairs).toHaveLength(3);
    expect(pairs).toEqual(['XAUUSD', 'EURUSD', 'GBPUSD']);
  });

  it('지원하지 않는 페어 검출', async () => {
    const { MockDataAdapter } = await import('../../../src/core/data/adapters/mock');
    const adapter = new MockDataAdapter({ supportedPairs: ['XAUUSD'] });
    const supported = await adapter.getSupportedPairs();

    const requested = parsePairs('XAUUSD,BTCUSD');
    const unsupported = requested.filter((p) => !supported.includes(p));

    expect(unsupported).toEqual(['BTCUSD']);
  });

  it('bias-only 모드: BiasEngine만 실행', async () => {
    // BiasEngine이 단독 실행 가능한지 확인
    const { BiasEngine } = await import('../../../src/core/bias');
    const { createCandle } = await import('../../fixtures/helpers');

    // StubAdapter — 모든 TF에 같은 캔들 반환
    const candles = [
      createCandle({ timestamp: 1e12, open: 100, high: 103, low: 98, close: 102 }),
      createCandle({ timestamp: 1e12 + 3600000, open: 102, high: 104, low: 100, close: 101 }),
      createCandle({ timestamp: 1e12 + 7200000, open: 101, high: 102, low: 95, close: 96 }),
      createCandle({ timestamp: 1e12 + 10800000, open: 96, high: 103, low: 95, close: 102 }),
      createCandle({ timestamp: 1e12 + 14400000, open: 102, high: 110, low: 101, close: 109 }),
      createCandle({ timestamp: 1e12 + 18000000, open: 109, high: 111, low: 106, close: 107 }),
      createCandle({ timestamp: 1e12 + 21600000, open: 107, high: 108, low: 93, close: 94 }),
      createCandle({ timestamp: 1e12 + 25200000, open: 94, high: 99, low: 92, close: 98 }),
      createCandle({ timestamp: 1e12 + 28800000, open: 98, high: 115, low: 97, close: 114 }),
      createCandle({ timestamp: 1e12 + 32400000, open: 114, high: 118, low: 112, close: 117 }),
      createCandle({ timestamp: 1e12 + 36000000, open: 117, high: 120, low: 115, close: 119 }),
      createCandle({ timestamp: 1e12 + 39600000, open: 119, high: 122, low: 117, close: 121 }),
      createCandle({ timestamp: 1e12 + 43200000, open: 121, high: 124, low: 119, close: 123 }),
    ];

    const stubAdapter = {
      name: 'stub',
      fetchCandles: async () => candles,
      getSupportedPairs: async () => ['XAUUSD'],
      getSupportedTimeframes: () => ['D1', 'H4', 'H1'] as Timeframe[],
    };

    const engine = new BiasEngine(stubAdapter, {
      weights: { D1: 0.5, H4: 0.3, H1: 0.2 },
      lookback: 2,
    });

    const result = await engine.calculate('XAUUSD');

    // BiasResult 구조 검증 — SMCAnalysis 없이 단독 실행
    expect(result.pair).toBe('XAUUSD');
    expect(result.bias).toBeDefined();
    expect(result.timeframes).toHaveLength(3);
  });
});
