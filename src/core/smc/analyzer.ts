import { Candle, SMCAnalysis } from '../types';
import { detectFVG } from './fvg';
import { detectOrderBlocks } from './orderblock';
import { analyzeStructure } from './structure';
import { detectSwingPoints } from './swing';

/**
 * SMC 전체 분석 파이프라인을 단일 진입점으로 제공
 *
 * 파이프라인: Swing -> Structure -> OrderBlock -> FVG
 * 각 단계 결과를 다음 단계 입력으로 전달
 *
 * 클래스 사용 이유: Phase 2.4 BiasEngine에서
 * lookback 등 설정을 주입받아 재사용하기 위함
 */
export class SMCAnalyzer {
  // lookback을 생성 시 설정 - 동일 설정으로 여러 페어 분석 가능
  constructor(private readonly lookback: number = 5) {}

  analyze(candles: Candle[]): SMCAnalysis {
    // 1. Swing Detection - 모든 후속 분석의 기반
    const swingPoints = detectSwingPoints(candles, this.lookback);

    // 2. Structure Analysis - swing 돌파로 BOS/CHoCH 판별
    const structure = analyzeStructure(candles, swingPoints);

    // 3. Order Blocks - BOS 직전 반대 캔들 식별
    const orderBlocks = detectOrderBlocks(candles, structure.breaks);

    // 4. Fair Value Gaps - 3캔들 갭 감지(독립 실행, swing 불필요)
    const fairValueGaps = detectFVG(candles);

    return { swingPoints, structure, orderBlocks, fairValueGaps };
  }
}
