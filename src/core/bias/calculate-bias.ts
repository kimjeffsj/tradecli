import { BiasDirection, Timeframe, TimeframeBias } from '../types';

// 기본 가중치 - 상위 TF일수록 높은 비중
export const DEFAULT_WEIGHTS: Partial<Record<Timeframe, number>> = {
  D1: 0.5,
  H4: 0.3,
  H1: 0.2,
};

// LONG/SHORT 판단 최소 기준 - 이 이하면 NEUTRAL
export const DEFAULT_THRESHOLD = 0.2;

/**
 * 타임프레임별 방향 + 가중치를 합산하여 bias 결정
 *
 * 순수 함수 - 외부 의존 없이 결정론적 결과 보장
 * MockDataAdapter의 랜덤 데이터와 무관하게 테스트 가능
 */
export function calculateBias(
  entries: TimeframeBias[],
  threshold: number = DEFAULT_THRESHOLD
): { bias: BiasDirection; confidence: number; weightedScore: number } {
  // 빈 입력 -> 판단 불가 = NEUTRAL
  if (entries.length === 0) {
    return { bias: 'NEUTRAL', confidence: 0, weightedScore: 0 };
  }

  // 1. direction -> 숫자 변환: BULLISH = +1, BEARISH = -1, undefined = 0
  // 2. 각 score에 weight 곱하여 합산
  const weightedScore = entries.reduce((sum, entry) => {
    const score = entry.direction === 'BULLISH' ? 1 : entry.direction === 'BEARISH' ? -1 : 0;

    return sum + score * entry.weight;
  }, 0);

  const confidence = Math.abs(weightedScore);

  // strict inequality - 정확히 threshold 일 때는 NEUTRAL
  const bias: BiasDirection =
    weightedScore > threshold ? 'LONG' : weightedScore < -threshold ? 'SHORT' : 'NEUTRAL';

  return { bias, confidence, weightedScore };
}
