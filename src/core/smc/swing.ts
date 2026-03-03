import { Candle, SwingPoint } from '../types';

// 기본 lookback: 5 -> 양쪽 5개 캔들과 비교
const DEFAULT_LOOKBACK = 5;

/**
 * 캔들 배열에서 스윙 포인트를 탐지
 *
 * 알고리즘: 인덱스 i가 스윙 포인트가 되려면
 *  SWING_HIGH: candles[i].high가 [i-lookback...i-1] 및 [i+1..i+lookback] 보다 모두 크다
 *  SWING_LOW: candles[i].low가 [i-lookback...i-1] 및 [i+1..i+lookback] 보다 모두 작다
 *
 * 순수 함수 -> 입력 배열 변경 없음
 */
export function detectSwingPoints(
  candles: Candle[],
  lookback: number = DEFAULT_LOOKBACK
): SwingPoint[] {
  const result: SwingPoint[] = [];

  // 캔들이 lookback*2+1개 미만이면 스윙 포인트를 판단할 수 없음
  if (candles.length < lookback * 2 + 1) {
    return result;
  }

  // 경계에서 lookback만큼 안쪽만 순회
  // (양쪽 lookback개가 존재해야 비교 가능)
  for (let i = lookback; i < candles.length - lookback; i++) {
    if (isSwingHigh(candles, i, lookback)) {
      result.push({
        type: 'SWING_HIGH',
        price: candles[i].high, // 스윙 포인트의 가격은 high/low 사용
        index: i,
        candle: candles[i],
      });
    }

    if (isSwingLow(candles, i, lookback)) {
      result.push({
        type: 'SWING_LOW',
        price: candles[i].low,
        index: i,
        candle: candles[i],
      });
    }
  }

  // index 오름차순 보장 (for 루프 순서상 이미 정렬되어 있지만 명시)
  return result.sort((a, b) => a.index - b.index);
}

/**
 * 인덱스 i의 캔들이 SWING_HIGH인지 확인
 * 엄격한 부등호 (>) 사용 -> 동일 가격은 스윙으로 인정하지 않음
 */
function isSwingHigh(candles: Candle[], i: number, lookback: number): boolean {
  const currentHigh = candles[i].high;

  for (let offset = 1; offset <= lookback; offset++) {
    // 왼쪽 비교
    if (currentHigh <= candles[i - offset].high) return false;
    // 오른쪽 비교
    if (currentHigh <= candles[i + offset].high) return false;
  }

  return true;
}

/**
 * 인덱스 i의 캔들이 SWING_LOW인지 확인
 */
function isSwingLow(candles: Candle[], i: number, lookback: number): boolean {
  const currentLow = candles[i].low;

  for (let offset = 1; offset <= lookback; offset++) {
    // 왼쪽 비교
    if (currentLow >= candles[i - offset].low) return false;
    // 오른쪽 비교
    if (currentLow >= candles[i + offset].low) return false;
  }

  return true;
}
