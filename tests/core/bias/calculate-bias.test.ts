import { describe, expect, it } from 'vitest';
import { calculateBias } from '../../../src/core/bias';
import { TimeframeBias } from '../../../src/core/types';

describe('calculateBias', () => {
  // 헬퍼: 기본 D1/H4/H1 가중치로 entries 생성
  function makeEntries(directions: Array<'BULLISH' | 'BEARISH' | undefined>): TimeframeBias[] {
    const tfs = ['D1', 'H4', 'H1'] as const;
    const weights = [0.5, 0.3, 0.2];
    return directions.map((dir, i) => ({
      timeframe: tfs[i],
      direction: dir,
      weight: weights[i],
    }));
  }

  it('전 TF BULLISH -> LONG, confidence=1.0', () => {
    const entries = makeEntries(['BULLISH', 'BULLISH', 'BULLISH']);
    const result = calculateBias(entries);

    expect(result.bias).toBe('LONG');
    // 0.5 + 0.3 + 0.2 = 1.0
    expect(result.confidence).toBeCloseTo(1.0);
    expect(result.weightedScore).toBeCloseTo(1.0);
  });

  it('전 TF BEARISH -> SHORT, confidence=1.0', () => {
    const entries = makeEntries(['BEARISH', 'BEARISH', 'BEARISH']);
    const result = calculateBias(entries);

    expect(result.bias).toBe('SHORT');
    expect(result.confidence).toBeCloseTo(1.0);
    // 음수 방향
    expect(result.weightedScore).toBeCloseTo(-1.0);
  });

  it('혼합: D1+H4 BULLISH, H1 BEARISH -> LONG (score=0.6)', () => {
    const entries = makeEntries(['BULLISH', 'BULLISH', 'BEARISH']);
    const result = calculateBias(entries);

    // 0.5*1 + 0.3*1 + 0.2*(-1) = 0.6
    expect(result.weightedScore).toBeCloseTo(0.6);
    expect(result.bias).toBe('LONG');
  });

  it('상쇄: D1 BULLISH, H4+H1 BEARISH -> NEUTRAL (score=0.0)', () => {
    const entries = makeEntries(['BULLISH', 'BEARISH', 'BEARISH']);
    const result = calculateBias(entries);

    // 0.5*1 + 0.3*(-1) + 0.2*(-1) = 0.0
    expect(result.weightedScore).toBeCloseTo(0.0);
    expect(result.bias).toBe('NEUTRAL');
  });

  it('undefined -> 0점 처리: D1 undefined, H4+H1 BULLISH -> LONG', () => {
    const entries = makeEntries([undefined, 'BULLISH', 'BULLISH']);
    const result = calculateBias(entries);

    // 0.5*0 + 0.3*1 + 0.2*1 = 0.5
    expect(result.weightedScore).toBeCloseTo(0.5);
    expect(result.bias).toBe('LONG');
  });

  it('빈 entries -> NEUTRAL, confidence=0', () => {
    const result = calculateBias([]);

    expect(result.bias).toBe('NEUTRAL');
    expect(result.confidence).toBe(0);
    expect(result.weightedScore).toBe(0);
  });

  it('커스텀 가중치: W1:0.6, D1:0.2, H4:0.2', () => {
    const entries: TimeframeBias[] = [
      { timeframe: 'W1', direction: 'BULLISH', weight: 0.6 },
      { timeframe: 'D1', direction: 'BEARISH', weight: 0.2 },
      { timeframe: 'H4', direction: 'BEARISH', weight: 0.2 },
    ];
    const result = calculateBias(entries);

    // 0.6*1 + 0.2*(-1) + 0.2*(-1) = 0.2
    // 정확히 threshold(0.2)일 때 -> strict inequality -> NEUTRAL
    expect(result.weightedScore).toBeCloseTo(0.2);
    expect(result.bias).toBe('NEUTRAL');
  });

  it('커스텀 threshold=0.1 -> 더 낮은 기준', () => {
    // D1 BULLISH, H4+H1 undefined -> score=0.5*1 = 0.5
    // 근데 threshold=0.1이면 score=0.2도 LONG이 됨
    const entries: TimeframeBias[] = [
      { timeframe: 'W1', direction: 'BULLISH', weight: 0.6 },
      { timeframe: 'D1', direction: 'BEARISH', weight: 0.2 },
      { timeframe: 'H4', direction: 'BEARISH', weight: 0.2 },
    ];
    // score = 0.2, threshold = 0.1 -> 0.2 > 0.1 -> LONG
    const result = calculateBias(entries, 0.1);

    expect(result.weightedScore).toBeCloseTo(0.2);
    expect(result.bias).toBe('LONG');
  });
});
