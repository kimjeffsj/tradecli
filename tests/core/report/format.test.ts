import { describe, expect, it } from 'vitest';
import { BiasReportJSON, SMCReportJSON } from '../../../src/core/report/serialize';
import { formatBiasSummary, formatScanTable, formatSMCSummary } from '../../../src/core/report';

// ANSI 이스케이프 코드 제거 — 텍스트 내용만 검증하기 위해
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

describe('formatSMCSummary', () => {
  it('pair, direction, swing/OB/FVG 카운트 포함', () => {
    const report: SMCReportJSON = {
      pair: 'XAUUSD',
      timeframe: 'H1',
      candleCount: 100,
      swingPoints: [
        { type: 'SWING_HIGH', price: 1910, index: 3 },
        { type: 'SWING_LOW', price: 1890, index: 7 },
        { type: 'SWING_HIGH', price: 1920, index: 12 },
      ],
      structure: {
        direction: 'BULLISH',
        breaks: [{ type: 'BOS', direction: 'BULLISH', brokenSwingPrice: 1910, confirmedIndex: 10 }],
      },
      orderBlocks: [{ direction: 'BULLISH', high: 1905, low: 1895, status: 'FRESH' }],
      fairValueGaps: [],
    };

    const result = stripAnsi(formatSMCSummary(report));

    expect(result).toContain('XAUUSD');
    expect(result).toContain('H1');
    expect(result).toContain('BULLISH');
    expect(result).toContain('3 swings');
    expect(result).toContain('1 BOS');
    expect(result).toContain('1 OB');
    expect(result).toContain('FRESH');
    expect(result).toContain('0 FVG');
  });
});

describe('formatBiasSummary', () => {
  it('direction, confidence, TF별 방향 포함', () => {
    const report: BiasReportJSON = {
      pair: 'XAUUSD',
      bias: 'LONG',
      confidence: 0.8,
      weightedScore: 0.8,
      timeframes: [
        { timeframe: 'D1', direction: 'BULLISH', weight: 0.5 },
        { timeframe: 'H4', direction: 'BULLISH', weight: 0.3 },
        { timeframe: 'H1', direction: 'BEARISH', weight: 0.2 },
      ],
      timestamp: '2026-03-08T12:00:00.000Z',
    };

    const result = stripAnsi(formatBiasSummary(report));

    expect(result).toContain('XAUUSD');
    expect(result).toContain('LONG');
    expect(result).toContain('0.80');
    expect(result).toContain('D1:BULLISH');
    expect(result).toContain('H4:BULLISH');
    expect(result).toContain('H1:BEARISH');
  });

  it('NEUTRAL일 때 올바른 표시', () => {
    const report: BiasReportJSON = {
      pair: 'EURUSD',
      bias: 'NEUTRAL',
      confidence: 0.1,
      weightedScore: 0.1,
      timeframes: [
        { timeframe: 'D1', direction: 'BULLISH', weight: 0.5 },
        { timeframe: 'H4', direction: 'BEARISH', weight: 0.5 },
      ],
      timestamp: '2026-03-08T12:00:00.000Z',
    };

    const result = stripAnsi(formatBiasSummary(report));

    expect(result).toContain('NEUTRAL');
    expect(result).toContain('EURUSD');
  });
});

describe('formatScanTable', () => {
  it('여러 행 + 헤더 포함', () => {
    const rows = [
      { pair: 'XAUUSD', timeframe: 'H1', direction: 'BULLISH', bias: 'LONG', confidence: 0.8 },
      { pair: 'EURUSD', timeframe: 'H1', direction: 'BEARISH', bias: 'SHORT', confidence: 0.6 },
    ];

    const result = stripAnsi(formatScanTable(rows));

    // 헤더 존재
    expect(result).toContain('PAIR');
    expect(result).toContain('DIRECTION');
    expect(result).toContain('BIAS');
    // 데이터 존재
    expect(result).toContain('XAUUSD');
    expect(result).toContain('EURUSD');
    expect(result).toContain('LONG');
    expect(result).toContain('SHORT');
  });
});
