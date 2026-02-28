# SMC Concepts Reference — TradeLab CLI

> Claude Code가 SMC 로직 구현 시 참조하는 개념 문서

---

## 1. Swing Points (스윙 포인트)

### 정의

- **Swing High**: 특정 캔들의 high가 좌우 N개 캔들의 high보다 높은 지점
- **Swing Low**: 특정 캔들의 low가 좌우 N개 캔들의 low보다 낮은 지점

### 구현 로직

```
Swing High at index i:
  candle[i].high > candle[i-n].high AND
  candle[i].high > candle[i-n+1].high AND ... AND
  candle[i].high > candle[i+n].high
  (n = lookback window, 기본 5)

Swing Low at index i:
  candle[i].low < candle[i-n].low AND ... AND candle[i].low < candle[i+n].low
```

### 주의사항

- lookback window 양쪽 모두 확인 (과거 N개 + 미래 N개)
- 따라서 감지는 최소 N개 캔들 이후에만 가능 (실시간에서는 지연)
- 동일 가격 연속 시: 첫 번째 캔들을 swing으로 처리

---

## 2. Market Structure (시장 구조)

### BOS (Break of Structure)

- **정의**: 현재 추세 방향의 구조가 유지되는 돌파
- **Bullish BOS**: 상승 추세에서 이전 swing high를 close 기준으로 돌파
- **Bearish BOS**: 하락 추세에서 이전 swing low를 close 기준으로 돌파

```
상승 추세:
  HH (Higher High) = Bullish BOS
  HL (Higher Low) = 구조 유지

하락 추세:
  LL (Lower Low) = Bearish BOS
  LH (Lower High) = 구조 유지
```

### CHoCH (Change of Character)

- **정의**: 추세 방향이 변경되는 돌파
- **Bullish CHoCH**: 하락 추세에서 이전 swing high를 close 기준으로 돌파 → 상승 전환
- **Bearish CHoCH**: 상승 추세에서 이전 swing low를 close 기준으로 돌파 → 하락 전환

### 판단 기준

- **close 기준**: wick이 아닌 close 가격으로 돌파 여부 판단
- **초기 상태**: 첫 swing pair가 형성될 때까지 NEUTRAL
- **최소 요건**: BOS/CHoCH 판단에는 최소 2개의 swing point 필요

---

## 3. Order Block (OB)

### 정의

대규모 매수/매도 주문이 집중된 가격 영역. BOS 직전 마지막 반대 방향 캔들.

### 식별 로직

```
Bullish Order Block:
  1. Bullish BOS가 발생
  2. BOS 캔들 이전으로 거슬러 올라감
  3. 마지막 bearish 캔들 (close < open) 을 찾음
  4. 해당 캔들의 low ~ high가 OB 영역

Bearish Order Block:
  1. Bearish BOS가 발생
  2. BOS 캔들 이전으로 거슬러 올라감
  3. 마지막 bullish 캔들 (close > open) 을 찾음
  4. 해당 캔들의 low ~ high가 OB 영역
```

### 상태 변화

```
FRESH → TESTED → BROKEN

FRESH: 생성 직후, 가격이 아직 되돌아오지 않음
TESTED: 가격이 OB 영역에 진입 (재테스트)
  - 진입 조건: candle.low <= OB.highPrice AND candle.high >= OB.lowPrice
BROKEN: 가격이 OB를 완전히 관통
  - Bullish OB BROKEN: candle.close < OB.lowPrice
  - Bearish OB BROKEN: candle.close > OB.highPrice
```

### 트레이딩 의미

- FRESH OB → 강한 관심 영역
- TESTED OB → 반등 가능성 (진입 포인트)
- BROKEN OB → 무효화

---

## 4. Fair Value Gap (FVG)

### 정의

3캔들 구조에서 발생하는 가격 불균형 영역. 캔들 1과 캔들 3 사이에 캔들 2가 채우지 못한 가격 갭.

### 식별 로직

```
Bullish FVG (상승 갭):
  candle[i-1].high < candle[i+1].low
  갭 영역: candle[i-1].high ~ candle[i+1].low

Bearish FVG (하락 갭):
  candle[i-1].low > candle[i+1].high
  갭 영역: candle[i+1].high ~ candle[i-1].low
```

### Fill (갭 메워짐) 추적

```
Bullish FVG fill:
  이후 캔들의 low가 FVG 영역에 진입
  fillPercentage = (FVG.highPrice - candle.low) / (FVG.highPrice - FVG.lowPrice)
  clamp to [0, 1]

상태:
  OPEN: fillPercentage = 0
  PARTIALLY_FILLED: 0 < fillPercentage < 1
  FILLED: fillPercentage >= 1 (candle.low <= FVG.lowPrice)
```

### 트레이딩 의미

- OPEN FVG → 가격이 되돌아올 "자석" 역할
- PARTIALLY_FILLED → 부분 반응
- FILLED → 더 이상 유효하지 않음

---

## 5. Multi-Timeframe Bias

### 원리

상위 타임프레임의 구조가 하위 타임프레임보다 더 중요하다.

### 가중치 (기본값)

```
D1: 0.50  (최상위)
H4: 0.30  (중간)
H1: 0.20  (최하위)
```

### Bias 계산

```
각 타임프레임별 direction 점수:
  BULLISH = +1
  BEARISH = -1
  NEUTRAL = 0

weighted_score = Σ(direction_score × weight)

bias 판단:
  weighted_score > threshold  → LONG
  weighted_score < -threshold → SHORT
  otherwise                   → NEUTRAL
  (threshold = 0.2)

confidence = |weighted_score|
```

---

## 6. 분석 순서 (파이프라인)

```
1. Candle[] 수신
2. Swing Detection → SwingPoint[]
3. Structure Analysis (BOS/CHoCH) → StructureBreak[]
   - 의존: SwingPoint[]
4. Order Block Detection → OrderBlock[]
   - 의존: StructureBreak[], Candle[]
5. FVG Detection → FairValueGap[]
   - 의존: Candle[] (독립적)
6. 모든 결과 → SMCAnalysis 객체
```

> OB는 BOS에 의존하고, BOS는 Swing에 의존한다. FVG는 독립적이다.

---

## 7. Signal 생성 (SMC Strategy)

### 진입 조건 (예시)

```
Long 진입:
  1. Bias = LONG (confidence >= 0.5)
  2. Bullish OB가 TESTED 상태
  3. 또는 Bullish FVG가 OPEN/PARTIALLY_FILLED
  4. 현재 가격이 OB/FVG 영역 내

Short 진입:
  (반대 조건)
```

### SL/TP 결정

```
Long SL: OB.lowPrice 아래 N pips (또는 이전 swing low)
Long TP: RRR × (entry - SL) + entry

Short SL: OB.highPrice 위 N pips (또는 이전 swing high)
Short TP: entry - RRR × (SL - entry)
```