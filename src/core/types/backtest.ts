// 개별 트레이드 기록
export interface Trade {
  id: string;
  strategyId: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: number;
  exitTime: number;
  // 손익 (수수료/슬리피지 반영 이후)
  pnl: number;
  pnlPercent: number;
  // 종료 사유
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL';
}

// 백테스트 전체 결과
export interface BacktestResult {
  strategyId: string;
  pair: string;
  // 총 트레이드 수
  totlaTrades: number;
  winRate: number; // 0~1
  profitFactor: number; // 총수익 / 총손실
  // 최대 낙폭 (%) - 리스크 지표
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  // Value at Rist (95% 신뢰구간)
  var95: number;
  trades: Trade[];
  // 에쿼티 커브 [timestamp, equity] 쌍의 배열
  equtiycurve: [number, number][];
}

// 백테스트 실행 설정
export interface Backtestconfig {
  initialCapial: number;
  // 거래 수수료 (0.001 = 0.1%)
  commissionRate: number;
  // 슬리피지 (0.0005 = 0.05%)
  slippageRate: number;
  // 트레이드당 리스크 비율 (0.01 = 자본의 1%)
  riskPerTrade: number;
}
