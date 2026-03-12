import { Command, Flags } from '@oclif/core';
import { Timeframe } from '../core/types';
import { parsePairs } from '../core/report/parse-pairs';
import { MockDataAdapter } from '../core/data/adapters/mock';
import { SMCAnalyzer } from '../core/smc';
import { BiasEngine } from '../core/bias';
import {
  formatBiasSummary,
  formatScanTable,
  ScanRowData,
  serializeAnalysisReport,
  serializeBiasResult,
} from '../core/report';
import { writeFileSync } from 'node:fs';

export default class Scan extends Command {
  static override description = 'Scan multiple pairs for SMC analysis and bias';

  static override examples = [
    '<%= config.bin %> scan --pairs XAUUSD,EURUSD --tf H1',
    '<%= config.bin %> scan --pairs XAUUSD,EURUSD --tf H1 --bias-only',
    '<%= config.bin %> scan --pairs XAUUSD --tf H1 --format json --output scan.json',
  ];

  static override flags = {
    // 쉼표 구분 페어 목록 (필수)
    pairs: Flags.string({
      description: `Comma-separated trading pairs(e.g. XAUUSD,EURUSD)`,
      required: true,
    }),
    // SMC 분석 타임프레임
    tf: Flags.string({
      char: 't',
      description: 'Timeframe for SMC analysis',
      default: 'H1',
    }),
    // Bias만 출력 - SMC 분석 건너뜀
    'bias-only': Flags.boolean({
      description: 'Show bias analysis only (skip SMC)',
      default: false,
    }),
    // JSON 파일 저장
    output: Flags.string({
      char: 'o',
      description: 'Save result to JSON file',
    }),
    lookback: Flags.integer({
      char: 'l',
      description: 'Swing detection lookback window',
      default: 5,
    }),
    // 출력 포맷
    format: Flags.string({
      char: 'f',
      description: 'Output format: json|table',
      default: 'table',
      options: ['json', 'table'],
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Scan);

    // 1. 타임프레임 유효성 검증
    const validTf: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

    if (!validTf.includes(flags.tf as Timeframe)) {
      this.error(`Invalid timeframe: ${flags.tf}. Valid: ${validTf.join(', ')}`);
    }

    // 2. 페어 파싱
    const pairs = parsePairs(flags.pairs);

    // 3. 지원 페어 검증
    const adapter = new MockDataAdapter();
    const supportedPairs = await adapter.getSupportedPairs();
    const unsupported = pairs.filter((p) => !supportedPairs.includes(p));
    if (unsupported.length > 0) {
      this.error(
        `Unsupported pairs: ${unsupported.join(', ')}. Available: ${supportedPairs.join(', ')}`
      );
    }

    // 4. 병렬 분석 실행
    const analyzer = new SMCAnalyzer(flags.lookback);
    const biasEngine = new BiasEngine(adapter, { lookback: flags.lookback });

    const results = await Promise.all(
      pairs.map(async (pair) => {
        // Bias는 항상 계산
        const biasResult = await biasEngine.calculate(pair);

        if (flags['bias-only']) {
          // bias-only: SMC 분석 건너뜀
          return { pair, bias: serializeBiasResult(biasResult), report: undefined };
        }

        // 전체 분석: SMC + Bias
        const candles = await adapter.fetchCandles({
          pair,
          timeframe: flags.tf as Timeframe,
        });

        const analysis = analyzer.analyze(candles);
        const meta = { pair, timeframe: flags.tf, candleCount: candles.length };
        const report = serializeAnalysisReport(analysis, meta, biasResult);

        return { pair, bias: serializeBiasResult(biasResult), report };
      })
    );

    // 5. 출력
    if (flags.output) {
      const jsonData = flags['bias-only']
        ? results.map((r) => r.bias)
        : results.map((r) => r.report);
      writeFileSync(flags.output, JSON.stringify(jsonData, null, 2));
      this.log(`Result saved to ${flags.output}`);
    }

    if (flags.format === 'table') {
      if (flags['bias-only']) {
        // bias-only: 각 페어의 Bias 요약 출력
        for (const r of results) {
          this.log(formatBiasSummary(r.bias));
        }
      } else {
        // 스캔 테이블 — SMC direction + Bias 함께 표시
        const rows: ScanRowData[] = results.map((r) => ({
          pair: r.pair,
          timeframe: flags.tf,
          direction: r.report?.structure.direction ?? 'UNDEFINED',
          bias: r.bias.bias,
          confidence: r.bias.confidence,
        }));
        this.log(formatScanTable(rows));
      }
    } else if (!flags.output) {
      // JSON 출력
      const jsonData = flags['bias-only']
        ? results.map((r) => r.bias)
        : results.map((r) => r.report);
      this.log(JSON.stringify(jsonData, null, 2));
    }
  }
}
