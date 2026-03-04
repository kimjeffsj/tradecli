import { Candle, StructureBreak, SwingPoint } from '../types';

// 분석 결과 타입 - breaks 배열 + 최정 시장 방향
export interface StructureResult {
  breaks: StructureBreak[];
  direction: 'BULLISH' | 'BEARISH' | undefined;
}

/**
 * Swing Point 돌파를 감지하여 BOS/CHoCH를 판별
 *
 * 알고리즘:
 * 1. Swing point를 시간순으로 추적 "가장 최근 SH / SL" 갱신
 * 2. 각 캔들의 close가 최근 SH/SL을 돌파하는지 확인
 * 3. 현재 direction과 돌파 방향을 비교하여 BOS vs CHoCH 결정
 *
 * 판단 기준: close 가격 (wick 아님)
 */
export function analyzeStructure(candles: Candle[], swingPoints: SwingPoint[]): StructureResult {
  const breaks: StructureBreak[] = [];
  let direction: 'BULLISH' | 'BEARISH' | undefined;

  // 현재까지 유효한 최근 swing high / swing low 추적
  let lastSwingHigh: SwingPoint | undefined;
  let lastSwingLow: SwingPoint | undefined;

  // swing point를 index 순으로 정렬 (이미 정렬돼 있을테지만 안전 장치)
  const sortedSwings = [...swingPoints].sort((a, b) => a.index - b.index);

  // 다음에 확인할 swing의 인덱스
  let swingCursor = 0;

  // 캔들을 하나씩 순회하며 돌파 검사
  for (let i = 0; i < candles.length; i++) {
    // 현재 캔들 index 이전(또는 같은)에 위치한 swing을 반영
    // swing이 "형성된 후"에 돌파 판단해야 look-ahead 방지
    while (swingCursor < sortedSwings.length && sortedSwings[swingCursor].index <= i) {
      const sw = sortedSwings[swingCursor];
      if (sw.type === 'SWING_HIGH') {
        lastSwingHigh = sw;
      } else {
        lastSwingLow = sw;
      }
      swingCursor++;
    }

    const close = candles[i].close;

    // 상방 돌파: close > 최근
    if (lastSwingHigh && close > lastSwingHigh.price) {
      const breakType: 'BOS' | 'CHOCH' =
        // 방향 미정이거나 이미 BULLISH면 -> 추세 유지 = BOS
        direction === undefined || direction === 'BULLISH'
          ? 'BOS'
          : // BEARISH 였는데 상방 돌파 -> 추세 전환 = CHoCH
            'CHOCH';

      breaks.push({
        type: breakType,
        direction: 'BULLISH',
        brokenSwing: lastSwingHigh,
        confirmedAt: candles[i],
        confirmedIndex: i,
      });

      direction = 'BULLISH';
      // 돌파된 swing high는 소비됨 -> 다음 돌파는 새로운 SH가 필요
      lastSwingHigh = undefined;
    }

    // 하방 돌파: close < 최근 swing low의 price
    if (lastSwingLow && close < lastSwingLow.price) {
      const breakType: 'BOS' | 'CHOCH' =
        direction === undefined || direction === 'BEARISH' ? 'BOS' : 'CHOCH';

      breaks.push({
        type: breakType,
        direction: 'BEARISH',
        brokenSwing: lastSwingLow,
        confirmedAt: candles[i],
        confirmedIndex: i,
      });

      direction = 'BEARISH';
      lastSwingLow = undefined;
    }
  }

  return { breaks, direction };
}
