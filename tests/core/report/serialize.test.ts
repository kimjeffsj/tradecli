import { describe, expect, it } from 'vitest';
import { BiasResult, SMCAnalysis } from '../../../src/core/types';
import { createCandle } from '../../fixtures/helpers';
import {
  serializeAnalysisReport,
  serializeBiasResult,
  serializeSMCAnalysis,
} from '../../../src/core/report/serialize';

// 테스트용 최소 SMCAnalysis 생성 — Candle 참조 포함
function makeSMCAnalysis(): SMCAnalysis {
  const candle = createCandle({ close: 1900, high: 1910, low: 1890 });
  return {
    swingPoints: [
      { type: 'SWING_HIGH', price: 1910, index: 3, candle },
      { type: 'SWING_LOW', price: 1890, index: 7, candle },
    ],
    structure: {
      direction: 'BULLISH',
      breaks: [
        {
          type: 'BOS',
          direction: 'BULLISH',
          brokenSwing: { type: 'SWING_HIGH', price: 1910, index: 3, candle },
          confirmedAt: candle,
          confirmedIndex: 10,
        },
      ],
    },
    orderBlocks: [
      {
        direction: 'BULLISH',
        high: 1905,
        low: 1895,
        status: 'FRESH',
        structureBreak: {
          type: 'BOS',
          direction: 'BULLISH',
          brokenSwing: { type: 'SWING_HIGH', price: 1910, index: 3, candle },
          confirmedAt: candle,
          confirmedIndex: 10,
        },
        createdAt: candle,
      },
    ],
    fairValueGaps: [
      {
        direction: 'BULLISH',
        high: 1920,
        low: 1910,
        formedAt: candle,
        formedIndex: 5,
        status: 'OPEN',
        fillPercentage: 0,
      },
    ],
  };
}

// 테스트용 BiasResult
function makeBiasResult(): BiasResult {
  return {
    pair: 'XAUUSD',
    bias: 'LONG',
    confidence: 0.8,
    weightedScore: 0.8,
    timeframes: [
      { timeframe: 'D1', direction: 'BULLISH', weight: 0.5 },
      { timeframe: 'H4', direction: 'BULLISH', weight: 0.3 },
    ],
    timestamp: '2026-03-08T12:00:00.000Z',
  };
}

const META = { pair: 'XAUUSD', timeframe: 'H1', candleCount: 100 };

describe('serializeSMCAnalysis', () => {
  it('Candle 객체 제거, 핵심 필드만 남김', () => {
    const analysis = makeSMCAnalysis();
    const result = serializeSMCAnalysis(analysis, META);

    // Candle 객체가 직렬화 결과에 포함되지 않아야 함
    const json = JSON.stringify(result);
    expect(json).not.toContain('timestamp'); // Candle.timestamp
    expect(json).not.toContain('volume'); // Candle.volume

    // 핵심 필드는 보존
    expect(result.pair).toBe('XAUUSD');
    expect(result.timeframe).toBe('H1');
    expect(result.candleCount).toBe(100);
    expect(result.swingPoints).toHaveLength(2);
    expect(result.swingPoints[0].type).toBe('SWING_HIGH');
    expect(result.structure.direction).toBe('BULLISH');
    expect(result.structure.breaks).toHaveLength(1);
    expect(result.orderBlocks[0].status).toBe('FRESH');
    expect(result.fairValueGaps[0].status).toBe('OPEN');
  });

  it('빈 분석 결과 직렬화: swing 0개, break 0개', () => {
    const empty: SMCAnalysis = {
      swingPoints: [],
      structure: { breaks: [], direction: undefined },
      orderBlocks: [],
      fairValueGaps: [],
    };
    const result = serializeSMCAnalysis(empty, META);

    expect(result.swingPoints).toHaveLength(0);
    expect(result.structure.breaks).toHaveLength(0);
    expect(result.structure.direction).toBe('UNDEFINED');
    expect(result.orderBlocks).toHaveLength(0);
    expect(result.fairValueGaps).toHaveLength(0);
  });
});

describe('serializeBiasResult', () => {
  it('모든 필드 보존', () => {
    const bias = makeBiasResult();
    const result = serializeBiasResult(bias);

    expect(result.pair).toBe('XAUUSD');
    expect(result.bias).toBe('LONG');
    expect(result.confidence).toBe(0.8);
    expect(result.weightedScore).toBe(0.8);
    expect(result.timeframes).toHaveLength(2);
    expect(result.timestamp).toBe('2026-03-08T12:00:00.000Z');
  });
});

describe('serializeAnalysisReport', () => {
  it('SMC + Bias 모두 포함', () => {
    const analysis = makeSMCAnalysis();
    const bias = makeBiasResult();
    const result = serializeAnalysisReport(analysis, META, bias);

    // SMC 부분 존재
    expect(result.pair).toBe('XAUUSD');
    expect(result.swingPoints).toBeDefined();
    // Bias 부분 존재
    expect(result.bias).toBeDefined();
    expect(result.bias?.bias).toBe('LONG');
    // 타임스탬프 존재
    expect(result.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('Bias 없는 통합 리포트: bias 필드 undefined', () => {
    const analysis = makeSMCAnalysis();
    const result = serializeAnalysisReport(analysis, META);

    expect(result.pair).toBe('XAUUSD');
    expect(result.bias).toBeUndefined();
  });
});
