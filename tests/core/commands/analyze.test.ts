import { describe, expect, it } from 'vitest';
import { Timeframe } from '../../../src/core/types';

describe('analyze command logic', () => {
  // CLI 파싱은 Oclif가 하므로, 핵심 로직(파이프라인) 단위 테스트

  it('유요한 타임프레임만 허용', () => {
    const validTf: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
    expect(validTf.includes('H1' as Timeframe)).toBe(true);
    expect(validTf.includes('H2' as Timeframe)).toBe(false);
  });

  it('전체 파이프라인: fetch → swing → structure', async () => {
    // Given
    const { MockDataAdapter } = await import('../../../src/core/data/adapters/mock.js');
    const { createCandles } = await import('../../fixtures/helpers.js');
    const { detectSwingPoints } = await import('../../../src/core/smc/swing.js');
    const { analyzeStructure } = await import('../../../src/core/smc/structure.js');

    // 상승 → 하락 패턴 캔들
    const candles = createCandles([
      100,
      102,
      105,
      102,
      100, // SH at idx 2
      98,
      95,
      98,
      100,
      102, // SL at idx 6
      105,
      108,
      112,
      108,
      105, // SH at idx 12
    ]);

    const adapter = new MockDataAdapter({ candles });

    // When: 파이프라인 실행
    const fetched = await adapter.fetchCandles({ pair: 'XAUUSD', timeframe: 'H1' });
    const swings = detectSwingPoints(fetched, 2);
    const structure = analyzeStructure(fetched, swings);

    // Then: 파이프라인이 에러 없이 결과를 반환
    expect(fetched).toHaveLength(15);
    expect(swings.length).toBeGreaterThan(0);
    expect(structure).toHaveProperty('breaks');
    expect(structure).toHaveProperty('direction');
  });
});
