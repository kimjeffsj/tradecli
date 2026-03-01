/**
 * 테스트용 Mock Adapter - API 키 없이 인터페이스 검증
 */

import { Candle, Timeframe } from '../../types';
import { DataAdapter, DataFetchError, FetchOptions } from './adapter';

// Mock 어댑터 생성 옵션
export interface MockAdapterOptions {
  // 반환할 캔들 데이터를 직접 주입
  candles?: Candle[];
  // true면 fetchCandles 호출 시 에러 던짐 (에러 시나리오 테스트용)
  shouldFail?: boolean;
  supportedPairs?: string[];
}

export class MockDataAdapter implements DataAdapter {
  readonly name = 'mock';

  // 생성자에서 테스트 데이터를 주입받음
  // 테스트마다 다른 시나리오 만들 수 있음
  constructor(private readonly options: MockAdapterOptions = {}) {}

  async fetchCandles(options: FetchOptions): Promise<Candle[]> {
    // 에러 시나리오 시뮬레이션
    if (this.options.shouldFail) {
      throw new DataFetchError(
        'Mock fetch failed',
        this.name,
        new Error('Simulated network error')
      );
    }

    const candles = this.options.candles ?? [];

    // limit 옵션 적용 - 실제 어댑터와 동일한 동작 보장
    if (options.limit !== undefined) {
      return candles.slice(0, options.limit);
    }

    return candles;
  }

  async getSupportedPairs(): Promise<string[]> {
    return this.options.supportedPairs ?? ['XAUUSD', 'EURUSD', 'GBPUSD'];
  }

  getSupportedTimeframes(): Timeframe[] {
    // Mock은 모든 타임 프레임 지원
    return ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
  }
}
