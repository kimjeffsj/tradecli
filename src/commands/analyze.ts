import { Command, Flags } from '@oclif/core';
import { Timeframe } from '../core/types';
import { writeFileSync } from 'node:fs';
import { MockDataAdapter } from '../core/data/adapters/mock';
import { SMCAnalyzer } from '../core/smc';

export default class Analyze extends Command {
  // CLI에서 "trade analyze" 시 표시되는 설명
  static override description = 'Analyze market structure (swing points + BOS/CHoCH)';

  // 사용 예시 (--help)
  static override examples = [
    '<%= config.bin %> analyze --pair XAUUSD --tf H1',
    '<%= config.bin %> analyze --pair EURUSD --tf D1 --output result.json',
  ];

  // 플래그 정의
  static override flags = {
    // 분석할 pair (필수)
    pair: Flags.string({
      char: 'p',
      description: ' TRading pair (e.g. XAUUSD)',
      required: true,
    }),
    // 타임 프레임 (필수)
    tf: Flags.string({
      char: 't',
      description: 'Timeframe (M1, M5, M15, M30, H1, H4, D1, W1)',
      required: true,
    }),
    // 결과를 파일에 저장 (선택)
    output: Flags.string({
      char: 'o',
      description: 'Save result to JSON file',
    }),
    // Swing lookback 설정 (선택, 기본 5)
    lookback: Flags.integer({
      char: 'l',
      description: 'Swing detection lookback window',
      default: 5,
    }),
  };

  // 커맨드 실행 로직
  async run(): Promise<void> {
    const { flags } = await this.parse(Analyze);

    // 1. 타임프레임 유효성 검증
    const validTf: Timeframe[] = ['H1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
    if (!validTf.includes(flags.tf as Timeframe)) {
      this.error(`Invalid timeframe: ${flags.tf}. Valid: ${validTf.join(', ')}`);
    }

    // 2. 데이터 어댑터에서 지원 페어 확인
    const adapter = new MockDataAdapter();
    const supportedPairs = await adapter.getSupportedPairs();
    if (!supportedPairs.includes(flags.pair)) {
      this.error(`Unsupported pair: ${flags.pair}. Available: ${supportedPairs.join(', ')}`);
    }

    // 3. 데이터 Fetch
    const candles = await adapter.fetchCandles({
      pair: flags.pair,
      timeframe: flags.tf as Timeframe,
    });

    // 4. SMC 통합 분석 (기존 swing+structure 수동 호출 -> 단일 파이프라인)
    const analyzer = new SMCAnalyzer(flags.lookback);
    const analysis = analyzer.analyze(candles);

    // 5. 결과 조합 - OB/FVG 포함
    const result = {
      pair: flags.pair,
      timeframe: flags.tf,
      candleCount: candles.length,
      swingPoints: analysis.swingPoints.map((sp) => ({
        type: sp.type,
        price: sp.price,
        index: sp.index,
      })),
      structure: {
        direction: analysis.structure.direction ?? 'UNDEFINED',
        breaks: analysis.structure.breaks.map((b) => ({
          type: b.type,
          direction: b.direction,
          brokenSwingPrice: b.brokenSwing.price,
          confirmedIndex: b.confirmedIndex,
        })),
      },
      // OB 요약 - 상태별 개수 + 각 OB 핵심 정보
      orderBlocks: analysis.orderBlocks.map((ob) => ({
        direction: ob.direction,
        high: ob.high,
        low: ob.low,
        status: ob.status,
      })),
      // FVG 요약 - fill 상태 포함
      fairValueGaps: analysis.fairValueGaps.map((fvg) => ({
        direction: fvg.direction,
        high: fvg.high,
        low: fvg.low,
        status: fvg.status,
        fillPercentage: fvg.fillPercentage,
      })),
      analyzedAt: new Date().toISOString(),
    };

    // 6. 출력
    if (flags.output) {
      writeFileSync(flags.output, JSON.stringify(result, null, 2));
      this.log(`Result saved to ${flags.output}`);
    } else {
      this.log(JSON.stringify(result, null, 2));
    }
  }
}
