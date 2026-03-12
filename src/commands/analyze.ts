import { Command, Flags } from '@oclif/core';
import { Timeframe } from '../core/types';
import { writeFileSync } from 'node:fs';
import { MockDataAdapter } from '../core/data/adapters/mock';
import { SMCAnalyzer } from '../core/smc';
import { BiasEngine } from '../core/bias';
import { formatBiasSummary, formatSMCSummary, serializeAnalysisReport } from '../core/report';

export default class Analyze extends Command {
  // CLI에서 "trade analyze" 시 표시되는 설명
  static override description = 'Analyze market structure (swing points + BOS/CHoCH)';

  // 사용 예시 (--help)
  static override examples = [
    '<%= config.bin %> analyze --pair XAUUSD --tf H1',
    '<%= config.bin %> analyze --pair EURUSD --tf D1 --output result.json',
    '<%= config.bin %> analyze --pair XAUUSD --tf H1 --bias --format table',
  ];

  // 플래그 정의
  static override flags = {
    // 분석할 pair (필수)
    pair: Flags.string({
      char: 'p',
      description: 'Trading pair (e.g. XAUUSD)',
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
    // BiasEngine 실행 여부
    bias: Flags.boolean({
      char: 'b',
      description: 'Include multi-timeframe bias analysis',
      default: false,
    }),
    // 출력 포맷: json (기본) | table
    format: Flags.string({
      char: 'f',
      description: 'Output format: json | table',
      default: 'json',
      options: ['json', 'table'],
    }),
  };

  // 커맨드 실행 로직
  async run(): Promise<void> {
    const { flags } = await this.parse(Analyze);

    // 1. 타임프레임 유효성 검증
    const validTf: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
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

    // 5. Bias 분석 (--bias 플래그)
    let biasResult;
    if (flags.bias) {
      const biasEngine = new BiasEngine(adapter, { lookback: flags.lookback });
      biasResult = await biasEngine.calculate(flags.pair);
    }

    // 6. 직렬화 — 인라인 매핑 대신 재사용 가능한 함수 사용
    const meta = { pair: flags.pair, timeframe: flags.tf, candleCount: candles.length };
    const report = serializeAnalysisReport(analysis, meta, biasResult);

    // 7. 출력
    if (flags.output) {
      // --output 시 항상 JSON 저장
      writeFileSync(flags.output, JSON.stringify(report, null, 2));
      this.log(`Result saved to ${flags.output}`);
    }

    if (flags.format === 'table') {
      // 테이블 포맷 출력
      this.log(formatSMCSummary(report));
      if (report.bias) {
        this.log(formatBiasSummary(report.bias));
      }
    } else if (!flags.output) {
      // JSON 포맷 (기본) — --output 없을 때만 stdout
      this.log(JSON.stringify(report, null, 2));
    }
  }
}
