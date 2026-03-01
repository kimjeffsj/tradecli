export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  // 0이면 빈 캔들 (거래 없음) → 처리 로직 필요
  volume: number;
}

// 지원 타임프레임 — string literal union 사용
// enum 대신 union을 쓰는 이유: 직렬화/역직렬화 없이 string 그대로 사용 가능
export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1';

// 타임프레임별 밀리초 값 — 캐시 TTL, 시간 계산에 사용
export const TIMEFRAME_MS: Record<Timeframe, number> = {
  M1: 60_000,
  M5: 300_000,
  M15: 900_000,
  M30: 1_800_000,
  H1: 3_600_000,
  H4: 14_400_000,
  D1: 86_400_000,
  W1: 604_800_000,
};
