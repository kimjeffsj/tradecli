import { DataAdapter } from '../data/adapters/adapter';
import { SMCAnalyzer } from '../smc';
import { BiasEngineConfig, BiasResult, Timeframe, TimeframeBias } from '../types';
import { calculateBias, DEFAULT_THRESHOLD, DEFAULT_WEIGHTS } from './calculate-bias';

/**
 * 여러 타임프레임의 SMC 분석을 오케스트레이션하여 종합 Bias 산출
 *
 * 클래스 사용 이유: DataAdapter(외부 의존)을 DI로 주입 받아 재사용
 * 순수 로직은 calculateBias()에 위임 - 이 클래스는 async 조율만 담당
 */
export class BiasEngine {
  private readonly weights: Partial<Record<Timeframe, number>>;
  private readonly threshold: number;
  private readonly analyzer: SMCAnalyzer;

  constructor(
    // 데이터 소스 - Moc/TwelveData/CCXT 교체 가능
    private readonly adapter: DataAdapter,
    config?: BiasEngineConfig
  ) {
    this.weights = config?.weights ?? DEFAULT_WEIGHTS;
    this.threshold = config?.threshold ?? DEFAULT_THRESHOLD;
    // lookback을 주입받아 SMCAnalyzer 생성 - 동일 설정으로 모든 TF 분석
    this.analyzer = new SMCAnalyzer(config?.lookback ?? 5);
  }

  async calculate(pair: string): Promise<BiasResult> {
    // 1. weights의 key에서 분석할 타임프레임 추출
    const timeframes = Object.keys(this.weights) as Timeframe[];

    // 2. 모든 타임프레임 캔들을 병렬 fetch - I/O 병목 최소화
    const candlesByTf = await Promise.all(
      timeframes.map((tf) => this.adapter.fetchCandles({ pair, timeframe: tf }))
    );

    // 3. 각 TF별 SMC 분석 -> structure.direction 추출
    const entries: TimeframeBias[] = timeframes.map((tf, i) => {
      const analysis = this.analyzer.analyze(candlesByTf[i]);
      return {
        timeframe: tf,
        direction: analysis.structure.direction,
        weight: this.weights[tf]!, // timeframes는 weights의 key에서 추출했으므로 반드시 존재
      };
    });

    // 4. 순수 함수에 위임 - 점수 계산 + Bias 결정
    const { bias, confidence, weightedScore } = calculateBias(entries, this.threshold);

    return {
      pair,
      bias,
      confidence,
      weightedScore,
      timeframes: entries,
      timestamp: new Date().toISOString(),
    };
  }
}
