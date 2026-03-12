import { colorize } from '@oclif/core/ux';
import { BiasReportJSON, SMCReportJSON } from './serialize';

// 스캔 테이블 행 데이터 - scan 커맨드에서 사용
export interface ScanRowData {
  pair: string;
  timeframe: string;
  direction: string;
  bias: string;
  confidence: number;
}

// --- 색상 헬퍼 ---
/**
 * 방향에 따른 색상 적용 - BULLISH/LONG=green, BEARISH/SHORT=red, 그 외=yellow
 */
function colorByDirection(text: string): string {
  if (text === 'BULLISH' || text === 'LONG') return colorize('green', text);
  if (text === 'BEARISH' || text === 'SHORT') return colorize('red', text);
  return colorize('yellow', text);
}

// --- 포맷 함수 ---
/**
 * SMC 요약: "XAUUSD H1 | BULLISH | 3 swings | 2 BOS | 1 OB (FRESH) | 0 FVG"
 */
export function formatSMCSummary(report: SMCReportJSON): string {
  const dir = colorByDirection(report.structure.direction);

  // OB 상태별 카운트
  const freshOB = report.orderBlocks.filter((ob) => ob.status === 'FRESH').length;
  const obSuffix = freshOB > 0 ? ` (${freshOB} FRESH)` : '';

  // BOS/CHoCH 카운트
  const bosCount = report.structure.breaks.filter((b) => b.type === 'BOS').length;
  const chochCount = report.structure.breaks.filter((b) => b.type === 'CHOCH').length;
  const breakParts: string[] = [];
  if (bosCount > 0) breakParts.push(`${bosCount} BOS`);
  if (chochCount > 0) breakParts.push(`${chochCount} CHoCH`);
  const breakStr = breakParts.length > 0 ? breakParts.join(', ') : '0 BOS';

  return [
    `${report.pair} ${report.timeframe}`,
    dir,
    `${report.swingPoints.length} swings`,
    breakStr,
    `${report.orderBlocks.length} OB${obSuffix}`,
    `${report.fairValueGaps.length} FVG`,
  ].join(' | ');
}

/**
 * Bias 요약 한 줄 : "XAUUSD | LONG (0.80) | D1:BULLISH H4:BULLISH H1:BEARISH"
 */
export function formatBiasSummary(report: BiasReportJSON): string {
  const biasColored = colorByDirection(report.bias);
  const conf = report.confidence.toFixed(2);

  // 각 타임프레임 방향 표시
  const tfDetails = report.timeframes
    .map((tf) => {
      const dir = tf.direction ?? 'NONE';
      return `${tf.timeframe}:${colorByDirection(dir)}`;
    })
    .join(' ');

  return `${report.pair} | ${biasColored} (${conf}) | ${tfDetails}`;
}

/**
 * 스캔 결과 테이블 - padEnd로 고정폭 컬럼
 */
export function formatScanTable(results: ScanRowData[]): string {
  // 컬럼 너비 정의
  const cols = { pair: 10, tf: 6, dir: 10, bias: 8, conf: 6 };
  const sep = '-'.repeat(cols.pair + cols.tf + cols.dir + cols.bias + cols.conf + 12);

  // 헤더
  const header = [
    'PAIR'.padEnd(cols.pair),
    'TF'.padEnd(cols.tf),
    'DIRECTION'.padEnd(cols.dir),
    'BIAS'.padEnd(cols.bias),
    'CONF'.padEnd(cols.conf),
  ].join(' | ');

  // 데이터 행
  const rows = results.map((r) =>
    [
      r.pair.padEnd(cols.pair),
      r.timeframe.padEnd(cols.tf),
      colorByDirection(r.direction).padEnd(cols.dir),
      colorByDirection(r.bias).padEnd(cols.bias),
      r.confidence.toFixed(2).padEnd(cols.conf),
    ].join(' | ')
  );

  return [sep, header, sep, ...rows, sep].join('\n');
}
