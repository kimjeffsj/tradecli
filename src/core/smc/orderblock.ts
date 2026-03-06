import { Candle, OrderBlock, StructureBreak } from '../types';

/**
 * BOS 직전 마지막 반대 캔들을 Order Block으로 식별
 *
 * 알고리즘:
 * 1. breaks 중 BOS만 필터링 (CHoCH는 OB 대상 아님)
 * 2. 각 BOS의 confirmedIndex에서 역방향 탐색
 * 3. Bullish BOS -> 마지막 bearish 캔들 (close < open)
 * 4. Bearish BOS -> 마지막 bullish 캔들 (close > open)
 * 5. 생성 후 이후 캔들로 상태 업데이트
 */
export function detectOrderBlocks(candles: Candle[], breaks: StructureBreak[]): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];

  // BOS만 대상 - CHoCH는 추세 전환 시점이라 OB 식별 대상 아님
  const bosBreaks = breaks.filter((b) => b.type === 'BOS');

  for (const bos of bosBreaks) {
    // BOS 확정 캔들에서 역방향 탐색 -> 반대 방향 캔들 찾기
    const obCandle = findOppositeCandle(candles, bos);
    if (!obCandle) continue; // 반대 캔들 없으면 OB 생성 불가

    const ob: OrderBlock = {
      // Bullish BOS -> Bullish OB(매수 관심 영역)
      direction: bos.direction,
      high: obCandle.high,
      low: obCandle.low,
      structureBreak: bos,
      status: 'FRESH',
      createdAt: obCandle,
    };

    // OB 생성 이후 캔들들로 상태 업데이트
    // confirmedIndex 다음 캔들부터 검사(BOS캔들 자체는 이미 돌파한 캔들)
    updateOBStatus(ob, candles, bos.confirmedIndex + 1);

    orderBlocks.push(ob);
  }
  return orderBlocks;
}

/**
 * BOS 확정 캔들에서 역방향 탐색하여 마지막 반대 캔들 찾기
 *
 * - Bullish BOS -> bearish 캔들 (close < open) 찾기
 * - Bearish BOS -> bullish 캔들 (close > open) 찾기
 */
function findOppositeCandle(candles: Candle[], bos: StructureBreak): Candle | undefined {
  // confirmedIndex - 1 부터 역방향 탐색
  // confirmedIndex 자체는 돌파 캔들이므로 제외
  for (let i = bos.confirmedIndex - 1; i >= 0; i--) {
    const c = candles[i];

    if (bos.direction === 'BULLISH') {
      // Bullish BOS -> 마지막 bearish 캔들 (하락 캔들 = 매도 세력)
      if (c.close < c.open) return c;
    } else {
      // Bearish BOS -> 마지막 bullish 캔들 (상승 캔들 = 매수 세력)
      if (c.close > c.open) return c;
    }
  }

  return undefined;
}

/**
 * OB 생성 이후 캔들들로 상태 업데이트
 *
 * FRESH -> TESTED: 가격이 OB 영역에 진입
 *    조건: candle.low <= OB.high AND candle.high >= OB.low
 * TESTED -> BROKEN: 가격이 OB를 완전 관통 (close 기준)
 *    Bullish OB BROKEN: candle.close < OB.low
 *    Bearish OB BROKEN: candle.close > OB.high
 */
function updateOBStatus(ob: OrderBlock, candles: Candle[], startIndex: number): void {
  for (let i = startIndex; i < candles.length; i++) {
    const c = candles[i];

    // BROKEN 이후는 더 이상 상태 변경 불필요
    if (ob.status === 'BROKEN') break;

    // 가격이 OB 영역에 겹치는지 확인
    const touches = c.low <= ob.high && c.high >= ob.low;

    if (ob.status === 'FRESH' && touches) {
      ob.status = 'TESTED';
    }

    // BROKEN 체크 - TESTED든 방금 FRESH -> TESTED 전환했든 같은 캔들에서 BROKEN 가능
    if (ob.status === 'TESTED') {
      if (ob.direction === 'BULLISH' && c.close < ob.low) {
        ob.status = 'BROKEN';
      } else if (ob.direction === 'BEARISH' && c.close > ob.high) {
        ob.status = 'BROKEN';
      }
    }
  }
}
