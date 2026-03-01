import { Candle, Timeframe } from './candle';

// 진입 신호 - 전략이 백테스트 엔진에게 전달하는 단위
export interface Signal {
  direction: 'LONG' | 'SHORT';
  // 진입 가격 (지정가 또는 시장가)
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  // 신호 발생 시점
  timestamp: number;
  // 어떤 전략에서 발생했는지 추적용
  strategyId: number;
  // 신호 강도 0~1 (Optional - 필터링에 활용 가능)
  confidence?: number;
}

// 모든전략이 구현해야하는 인터페이스
// Core 원칙: 전략은 캔들을 받아 Signal[]을 반환하는 순수 로직
export interface Strategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly supportedTimeframes: Timeframe[];

  // 메인 분석 함수 - look-ahead bias 방지를 위해
  // candles[i]까지만 보고 신호 생성
  analyze(candles: Candle[], timeframe: Timeframe): Signal[];
}

export interface StrategyConfig {
  // Risk/Reward Ratio
  rrRatio: number;
  // 최대 동시 포지션 수
  maxPositions: number;
}
