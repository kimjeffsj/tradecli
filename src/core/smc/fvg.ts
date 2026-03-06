import { Candle, FairValueGap } from '../types';

/**
 * 3캔들 구조 기반 Fair Value Gap 감지
 *
 * 알고리즘:
 * 1. i=1 ~ length-2로 순회 (3캔들 윈도우: i-1, i, i+1)
 * 2. Bullish FVG: candle[i-1].high < candle[i+1].low -> gap 존재
 * 3. Bearish FVG: candle[i-1].low > candle[i+1].high -> gap 존재
 * 4. 생성 후 i+2부터 이후 캔들로 fill 상태 업데이트
 */
export function detectFVG(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];

  // 최소 3캔들 필요
  if (candles.length < 3) return fvgs;
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1]; // 첫째 캔들
    const impulse = candles[i]; // 중간 캔들
    const next = candles[i + 1]; // 셋째 캔들

    // Bullish FVG: 첫째 high < 셋째 low -> 상방 갭
    if (prev.high < next.low) {
      const fvg: FairValueGap = {
        direction: 'BULLISH',
        high: next.low, // 갭 상단 = 셋째 캔들 low
        low: prev.high, // 갭 하단 = 첫쨰 캔들 high
        formedAt: impulse,
        formedIndex: i,
        status: 'OPEN',
        fillPercentage: 0,
      };

      // i+2 부터 fill 추적(셋쨰 캔들 다음부터)
      updateFVGFill(fvg, candles, i + 2);
      fvgs.push(fvg);
    }

    // Bearish FVG: 첫째 low > 셋째 high -> 하방 갭
    if (prev.low > next.high) {
      const fvg: FairValueGap = {
        direction: 'BEARISH',
        high: prev.low, // 갭 상단 = 첫째 캔들 low
        low: next.high, // 갭 하단 = 셋째 캔들 high
        formedAt: impulse,
        formedIndex: i,
        status: 'OPEN',
        fillPercentage: 0,
      };

      updateFVGFill(fvg, candles, i + 2);
      fvgs.push(fvg);
    }
  }

  return fvgs;
}

/**
 * FVG 생성 이후 캔들들로 fill 상태 업데이트
 *
 * - Bullish FVG: 이후 캔들 low가 갭 영역 진입 -> 위에서 아래로 메움
 * - Bearish FVG: 이후 캔들 high가 갭 영역 진입 -> 아래에서 위로 메움
 * - fillPercentage는 단조증가 (한번 메워진 영역은 돌아가지 않음)
 */
function updateFVGFill(fvg: FairValueGap, candles: Candle[], startIndex: number): void {
  // 갭 크기 - 0 이면 division by zero 방지
  const gapSize = fvg.high - fvg.low;
  if (gapSize <= 0) return;

  for (let i = startIndex; i < candles.length; i++) {
    // FILLED 이후 더 이상 업데이트 불필요
    if (fvg.status === 'FILLED') break;

    const c = candles[i];
    let currentFill = 0;

    if (fvg.direction === 'BULLISH') {
      // Bullish FVG: 가격이 위에서 내려와 갭을 메움
      // candle.low가 갭 영역에 진입한 정도
      currentFill = (fvg.high - c.low) / gapSize;
    } else {
      // Bearish FVG: 가격이 아래에서 올라와 갭을 메움
      // candle.high가 갭 영역에 진입한 정도
      currentFill = (c.high - fvg.low) / gapSize;
    }

    // clamp [0, 1] + 단조 증가(max)
    const clamped = Math.min(Math.max(currentFill, 0), 1);
    fvg.fillPercentage = Math.max(fvg.fillPercentage, clamped);

    // 상태 전이
    if (fvg.fillPercentage >= 1) {
      fvg.status = 'FILLED';
    } else if (fvg.fillPercentage > 0) {
      fvg.status = 'PARTIALLY_FILLED';
    }
  }
}
