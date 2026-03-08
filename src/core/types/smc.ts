import { Candle, Timeframe } from './candle';

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
  // Bullish: candle[i-1].high ~ candle[i+1].low
  // Bearish: candle[i+1].high ~ candle[i-1].low
  high: number;
  low: number;
  // FVG를 형성한 중간 캔들 (impulse candle)
  formedAt: Candle;
  // impulse 캔들 index — fill 추적 시작점 계산에 사용
  formedIndex: number;
  // FVG 생명주기: OPEN → PARTIALLY_FILLED → FILLED
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED';
  // 갭이 메워진 비율 (0~1, 단조증가)
  fillPercentage: number;
}

// 분석 결과 타입 - breaks 배열 + 최종 시장 방향
export interface StructureResult {
  breaks: StructureBreak[];
  direction: 'BULLISH' | 'BEARISH' | undefined;
}

// SMC 전체 파이프라인 결과 - SMC Analyzer의 반환 타입
export interface SMCAnalysis {
  swingPoints: SwingPoint[];
  structure: StructureResult;
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
}

// 최종 Bias 방향 - LONG/SHORT 외에 확인 없으면 NEUTRAL
export type BiasDirection = 'LONG' | 'SHORT' | 'NEUTRAL';

// 타임프레임별 분석 결과 + 가중치 - calculateBias 입력용
export interface TimeframeBias {
  timeframe: Timeframe;
  // StructureResult.direction 그대로 전달 - undefined는 판단 불가
  direction: 'BULLISH' | 'BEARISH' | undefined;
  weight: number;
}

export interface BiasResult {
  pair: string;
  bias: BiasDirection;
  // [weightedScore] - 방향 무관 확신도 (0~1)
  confidence: number;
  // 합산 점수 (-1 ~ +1) - 디버깅용 원시값
  weightedScore: number;
  // 타임프레임별 상세 - 어느 Timeframe이 어떤 방향인지 확인
  timeframes: TimeframeBias[];
  // ISO8601 - 분석 시점 기록
  timestamp: string;
}

export interface BiasEngineConfig {
  // 타임프레임별 가중치 - 미지정 Timeframe은 분석 대상에서 제외
  weights: Partial<Record<Timeframe, number>>;
  // LONG/SHORT 판단 기준값 ( 기본: 0.2 ) - strict inequality
  threshold?: number;
  // SMCAnalyzer lookback (기본: 5)
  lookback?: number;
}
