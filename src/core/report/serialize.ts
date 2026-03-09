// --- 프레젠테이션 타입 (JSON-save, Candle 참조 없음) ---

import { BiasResult, SMCAnalysis } from '../types';

// SwingPoint에서 candle 제거
export interface SwingPointJSON {
  type: string;
  price: number;
  index: number;
}

// StructureBreak에서 Candle 참조 제거, brokenSwing.price만 보존
export interface StructureBreakJSON {
  type: string;
  direction: string;
  brokenSwingPrice: number;
  confirmedIndex: number;
}

export interface OrderBlockJSON {
  direction: string;
  high: number;
  low: number;
  status: string;
}

export interface FairValueGapJSON {
  direction: string;
  high: number;
  low: number;
  status: string;
  fillPercentage: number;
}

// SMCAnalysis -> JSON-safe 리포트
export interface SMCReportJSON {
  pair: string;
  timeframe: string;
  candleCount: number;
  swingPoints: SwingPointJSON[];
  structure: {
    direction: string;
    breaks: StructureBreakJSON[];
  };
  orderBlocks: OrderBlockJSON[];
  fairValueGaps: FairValueGapJSON[];
}

// BiasResult는 이미 JSON-safe지만, 일관된 인터페이스 제공
export interface BiasReportJSON {
  pair: string;
  bias: string;
  confidence: number;
  weightedScore: number;
  timeframes: Array<{
    timeframe: string;
    direction: string | undefined;
    weight: number;
  }>;
  timestamp: string;
}

// SMC + Bias 통합 리포트
export interface AnalysisReportJSON extends SMCReportJSON {
  bias?: BiasReportJSON;
  analyzedAt: string;
}

// --- 직렬화 함수 ---

/**
 * SMCAnalysis -> JSON-safe 객체 (Candle 참조 제거)
 */
export function serializeSMCAnalysis(
  analysis: SMCAnalysis,
  meta: { pair: string; timeframe: string; candleCount: number }
): SMCReportJSON {
  return {
    pair: meta.pair,
    timeframe: meta.timeframe,
    candleCount: meta.candleCount,
    // candle 객체 제거 - type/price/index만 보존
    swingPoints: analysis.swingPoints.map((sp) => ({
      type: sp.type,
      price: sp.price,
      index: sp.index,
    })),
    structure: {
      // undefined -> 문자열 'UNDEFINED' 변환 - JSON 누락 방지
      direction: analysis.structure.direction ?? 'UNDEFINED',
      breaks: analysis.structure.breaks.map((b) => ({
        type: b.type,
        direction: b.direction,
        brokenSwingPrice: b.brokenSwing.price,
        confirmedIndex: b.confirmedIndex,
      })),
    },
    // OB: structureBreak/createdAt 제거 - 상태와 가격 범위만
    orderBlocks: analysis.orderBlocks.map((ob) => ({
      direction: ob.direction,
      high: ob.high,
      low: ob.low,
      status: ob.status,
    })),
    // FVG: formedAt 제거 - 상태와 fill 정보만
    fairValueGaps: analysis.fairValueGaps.map((fvg) => ({
      direction: fvg.direction,
      high: fvg.high,
      low: fvg.low,
      status: fvg.status,
      fillPercentage: fvg.fillPercentage,
    })),
  };
}

/**
 * BiasResult -> BiasReportJSON (이미 JSON-safe지만 일관된 인터페이스)
 */
export function serializeBiasResult(bias: BiasResult): BiasReportJSON {
  return {
    pair: bias.pair,
    bias: bias.bias,
    confidence: bias.confidence,
    weightedScore: bias.weightedScore,
    timeframes: bias.timeframes.map((tf) => ({
      timeframe: tf.timeframe,
      direction: tf.direction,
      weight: tf.weight,
    })),
    timestamp: bias.timestamp,
  };
}

/**
 * SMC + Bias 통합 리포트 - bias는 선택
 */
export function serializeAnalysisReport(
  analysis: SMCAnalysis,
  meta: {
    pair: string;
    timeframe: string;
    candleCount: number;
  },
  bias?: BiasResult
): AnalysisReportJSON {
  return {
    ...serializeSMCAnalysis(analysis, meta),
    bias: bias ? serializeBiasResult(bias) : undefined,
    analyzedAt: new Date().toISOString(),
  };
}
