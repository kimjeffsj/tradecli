import { describe, expect, it } from 'vitest';
import { parsePairs } from '../../../src/core/report';

describe('parsePairs', () => {
  it('기본 쉼표 분리', () => {
    expect(parsePairs('XAUUSD,EURUSD')).toEqual(['XAUUSD', 'EURUSD']);
  });

  it('공백 처리', () => {
    expect(parsePairs(' XAUUSD , EURUSD ')).toEqual(['XAUUSD', 'EURUSD']);
  });

  it('단일 페어', () => {
    expect(parsePairs('XAUUSD')).toEqual(['XAUUSD']);
  });

  it('중복 제거', () => {
    expect(parsePairs('XAUUSD,XAUUSD')).toEqual(['XAUUSD']);
  });

  it('빈 문자열 제거', () => {
    expect(parsePairs('XAUUSD,,EURUSD')).toEqual(['XAUUSD', 'EURUSD']);
  });
});
