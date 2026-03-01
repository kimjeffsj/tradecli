/**
 * 모든 데이터 어댑터가 따라야할 인터페이스 정의
 */

import { Candle, Timeframe } from '../../types';

// 캔들 데이터 요청 옵션
// 어댑터 구현체에 관계없이 동일한 파라미터로 호출 가능
export interface FetchOptions {
  pair: string; // "XAUUSD", "EURUSD" 등
  timeframe: Timeframe;
  // Unix timestamp - undefined면 어댑터가 기본값 결정
  from?: number;
  to?: number;
  // 요청할 최대 캔들 수 (기본값은 어댑터가 정의)
  limit?: number;
}

// 어댑터 패턴의 핵심: 이 인터페이스만 바라보면
// TwelveData든 CCXT든 Mock이든 교체 가능
export interface DataAdapter {
  readonly name: string;

  // 캔들 데이터 조회 - timestamp 오름차순 정렬 보장
  fetchCandles(options: FetchOptions): Promise<Candle[]>;

  // 지원하는 페어 목록 (필터링/유효성 검사에 사용)
  getSupportedPairs(): Promise<string[]>;

  // 지원하는 타임프레임 목록
  getSupportedTimeframes(): Timeframe[];
}

// 커스텀 에러 - 어떤 어댑터에서 발생했는지 추적 가능
export class DataFetchError extends Error {
  constructor(
    message: string,
    // 에러 발생 어댑터 이름
    public readonly adapterName: string,
    // 원래 에러 체이닝 (스택트레이스 보존)
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DataFetchError';
  }
}
