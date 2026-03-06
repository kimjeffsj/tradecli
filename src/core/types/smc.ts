import { Candle } from './candle';

export type SwingType = 'SWING_HIGH' | 'SWING_LOW';

export interface SwingPoint {
  type: SwingType;
  price: number;
  index: number;
  candle: Candle;
}

// Structure Break
// BOS: Bullish Structure Break
// CHOCH: Bearish Structure Break
export type StructureBreakType = 'BOS' | 'CHOCH';

export interface StructureBreak {
  type: StructureBreakType;
  // 이탈 방향
  direction: 'BULLISH' | 'BEARISH';
  // 이탈된 스윙 포인트
  brokenSwing: SwingPoint;
  // 이탈 확정 캔들 (close 기준)
  confirmedAt: Candle;
  confirmedIndex: number;
}

// Order Block - BOS/CHoCH 이전 마지막 반대 방향 캔들 구간
export interface OrderBlock {
  direction: 'BULLISH' | 'BEARISH';
  // OB price range
  high: number;
  low: number;
  // 생성 기준이 된 Structure Break
  structureBreak: StructureBreak;
  // OB 생명주기: FRESH(미진입) -> TESTED -> BROKEN(무효)
  status: 'FRESH' | 'TESTED' | 'BROKEN';
  createdAt: Candle;
}

// Fair Value Gap -
export interface FairValueGap {
  direction: 'BULLISH' | 'BEARISH';
  // FVG price range
  // Bullish: candle[0].high ~ candle[1].low
  // Bearish: candle[0].low ~ candle[1].high
  high: number;
  low: number;
  // FVG를 형성한 중간 캔들 (impulse candle)
  formedAt: Candle;
  isMitigated: boolean;
}
