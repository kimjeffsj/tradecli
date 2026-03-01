/**
 * 테스트용 캔들 생성 헬퍼 - 매 테스트마다 반복 코드 제거
 */

import { Candle } from '../../src/core/types';

export function createCandles(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    // 1시간 간격으로 timestamp 생성 (정렬 순서 보장)
    timestamp: 1_700_000_000_000 + index * 3_600_000,
    // open은 이전 close 또는 첫 번째면 close 그대로
    open: index === 0 ? close : closes[index - 1],
    // 단순 테스트용 : high/low는 close 기준 +-1%
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1000,
  }));
}

// OHLCV를 직접 지정하고 싶을때 사용
export function createCandle(overrides: Partial<Candle> = {}): Candle {
  return {
    timestamp: 1_700_000_000_000,
    open: 1800,
    high: 1810,
    low: 1790,
    close: 1805,
    volume: 1000,
    // 개별 필드 오버라이드 가능
    ...overrides,
  };
}
