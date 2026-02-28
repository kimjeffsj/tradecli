# Risk Metrics Reference — TradeLab CLI

> Claude Code가 리스크 모듈 구현 시 참조하는 계산 레퍼런스

---

## 1. 기본 통계

### Win Rate (승률)

```
winRate = winningTrades / totalTrades
```

### Profit Factor (수익 팩터)

```
profitFactor = grossProfit / |grossLoss|

grossProfit = Σ(pnl) where pnl > 0
grossLoss = Σ(pnl) where pnl < 0
```

- PF > 1.0: 수익 시스템
- PF > 1.5: 양호
- PF > 2.0: 우수

### Expectancy (기대값)

```
expectancy = (winRate × avgWin) - ((1 - winRate) × avgLoss)

avgWin = grossProfit / winningTrades
avgLoss = |grossLoss| / losingTrades
```

pips 또는 R-multiple 단위로 표현.

### Average Risk-Reward Ratio (평균 RRR)

```
averageRRR = avgWin / avgLoss
```

---

## 2. Sharpe Ratio

### 정의

위험 조정 수익률. 초과 수익을 총 변동성으로 나눈 값.

### 계산

```
Sharpe = (Rp - Rf) / σp

Rp = 평균 수익률 (per period)
Rf = 무위험 수익률 (per period, 기본: 0)
σp = 수익률의 표준편차
```

### 구현

```typescript
function calculateSharpe(returns: number[], riskFreeRate: number = 0): number {
  const n = returns.length;
  if (n < 2) return 0;

  const meanReturn = returns.reduce((a, b) => a + b, 0) / n;
  const excessReturns = meanReturn - riskFreeRate;

  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  return excessReturns / stdDev;
}
```

### Annualized Sharpe

```
Annualized Sharpe = Sharpe × √(periodsPerYear)

periodsPerYear:
  Daily returns → √252
  Weekly returns → √52
  Monthly returns → √12
```

### 해석

- < 0: 무위험보다 나쁨
- 0~1: 보통
- 1~2: 양호
- > 2: 우수

---

## 3. Sortino Ratio

### 정의

Sharpe의 변형. 하방 변동성만 사용 → 수익 방향의 변동성은 패널티 없음.

### 계산

```
Sortino = (Rp - Rf) / σd

σd = 하방 편차 (Downside Deviation)
```

### 구현

```typescript
function calculateSortino(returns: number[], riskFreeRate: number = 0, mar: number = 0): number {
  const n = returns.length;
  if (n < 2) return 0;

  const meanReturn = returns.reduce((a, b) => a + b, 0) / n;

  // 하방 편차: MAR(Minimum Acceptable Return) 이하 수익률만
  const downsideReturns = returns.filter(r => r < mar);
  if (downsideReturns.length === 0) return Infinity; // 하방 없음 = 완벽

  const downsideVariance = downsideReturns.reduce((sum, r) => sum + (r - mar) ** 2, 0) / n;
  const downsideDeviation = Math.sqrt(downsideVariance);

  if (downsideDeviation === 0) return 0;

  return (meanReturn - riskFreeRate) / downsideDeviation;
}
```

### 해석

- Sharpe보다 높으면: 하방보다 상방 변동성이 큼 (좋은 신호)
- Sortino > 2: 우수한 하방 리스크 관리

---

## 4. Value at Risk (VaR)

### 정의

특정 신뢰구간에서 예상되는 최대 손실.

### Historical Simulation 방식 (구현 대상)

```
1. 모든 수익률을 오름차순 정렬
2. 신뢰구간에 해당하는 percentile 값 선택
3. 해당 값이 VaR
```

### 구현

```typescript
function calculateVaR(returns: number[], confidenceLevel: number = 0.95): number {
  if (returns.length === 0) return 0;

  const sorted = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sorted.length);

  return sorted[Math.max(0, index)];
}

// 95% VaR: "95%의 확률로 하루 손실이 X%를 넘지 않음"
// 99% VaR: 더 극단적 시나리오
```

### 해석

- VaR(95%) = -0.034 → "95%의 확률로 일일 손실이 3.4%를 넘지 않음"
- 음수값이 더 클수록 리스크 높음

### 주의사항

- Historical VaR은 과거 데이터 기반 → tail risk 과소평가 가능
- 최소 30개 이상의 수익률 데이터 필요
- 정규분포를 가정하지 않음 (장점)

---

## 5. Maximum Drawdown

### 정의

에쿼티 커브에서 고점(peak) 대비 최대 하락폭.

### 계산

```
drawdown[i] = (peak[i] - equity[i]) / peak[i]
maxDrawdown = max(drawdown[i]) for all i
```

### 구현

```typescript
interface DrawdownResult {
  maxDrawdown: number;        // 최대 DD (음수)
  maxDrawdownDuration: number; // 최대 DD 기간 (bars)
  currentDrawdown: number;    // 현재 DD
}

function calculateDrawdown(equityCurve: number[]): DrawdownResult {
  let peak = equityCurve[0];
  let maxDD = 0;
  let maxDDDuration = 0;
  let currentDDStart = 0;
  let inDrawdown = false;

  for (let i = 0; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
      if (inDrawdown) {
        maxDDDuration = Math.max(maxDDDuration, i - currentDDStart);
        inDrawdown = false;
      }
    }

    const dd = (equityCurve[i] - peak) / peak;
    if (dd < maxDD) {
      maxDD = dd;
    }

    if (dd < 0 && !inDrawdown) {
      inDrawdown = true;
      currentDDStart = i;
    }
  }

  const currentDD = (equityCurve[equityCurve.length - 1] - peak) / peak;

  return {
    maxDrawdown: maxDD,
    maxDrawdownDuration: maxDDDuration,
    currentDrawdown: currentDD,
  };
}
```

---

## 6. Calmar Ratio

### 정의

연간 수익률을 최대 Drawdown으로 나눈 값.

### 계산

```
Calmar = AnnualizedReturn / |MaxDrawdown|
```

### 해석

- > 1: 양호
- > 3: 우수
- < 0.5: 위험/수익 비율 불균형

---

## 7. Kelly Criterion (포지션 사이징)

### 정의

최적 배팅 비율. 장기 자산 성장률을 최대화하는 포지션 크기.

### 계산

```
Kelly% = W - (1 - W) / R

W = 승률
R = 평균 승리 / 평균 손실 (payoff ratio)
```

### 실전 적용

```typescript
function calculateKelly(winRate: number, avgWin: number, avgLoss: number): number {
  if (avgLoss === 0) return 0;
  const R = avgWin / avgLoss;
  const kelly = winRate - (1 - winRate) / R;
  return Math.max(0, kelly); // 음수면 배팅하지 않음
}

// Fractional Kelly (실전에서는 풀 Kelly의 일부만 사용)
function fractionalKelly(kelly: number, fraction: number = 0.5): number {
  return kelly * fraction; // Half-Kelly가 일반적
}
```

### 주의사항

- 풀 Kelly는 변동성이 매우 큼 → Half Kelly (fraction=0.5) 권장
- 음수 Kelly = 시스템에 edge 없음 → 배팅 금지
- 최대 리스크 cap 설정 필요 (예: 계좌의 5% 초과 금지)

---

## 8. 수익률 계산

### Trade 수익률

```
Long:
  pnl = (exitPrice - entryPrice) × positionSize
  pnlPercent = (exitPrice - entryPrice) / entryPrice

Short:
  pnl = (entryPrice - exitPrice) × positionSize
  pnlPercent = (entryPrice - exitPrice) / entryPrice
```

### Period Returns (Sharpe/Sortino/VaR 입력용)

```
백테스트에서 period return 계산:
  각 트레이드 종료 시점의 equity 변화율

  return[i] = (equity[i] - equity[i-1]) / equity[i-1]
```

---

## 9. 구현 순서 권장

```
1. 기본 통계 (winRate, PF, expectancy, RRR) — 가장 단순
2. Drawdown — 에쿼티 커브만 있으면 계산 가능
3. Sharpe Ratio — 수익률 배열 필요
4. Sortino Ratio — Sharpe 구조 재활용
5. VaR — 수익률 정렬만 하면 됨
6. Calmar — Drawdown + 연간 수익률
7. Kelly — 승률/RRR만 있으면 계산 가능 (포지션 사이징에 사용)
```

---

## 10. 검증용 테스트 데이터

### 예시 트레이드 세트

```json
[
  { "pnl": 100, "pnlPercent": 0.02 },
  { "pnl": -50, "pnlPercent": -0.01 },
  { "pnl": 150, "pnlPercent": 0.03 },
  { "pnl": -75, "pnlPercent": -0.015 },
  { "pnl": 200, "pnlPercent": 0.04 },
  { "pnl": -60, "pnlPercent": -0.012 },
  { "pnl": 80, "pnlPercent": 0.016 },
  { "pnl": 120, "pnlPercent": 0.024 },
  { "pnl": -90, "pnlPercent": -0.018 },
  { "pnl": 50, "pnlPercent": 0.01 }
]
```

### 수동 검증 값

```
totalTrades: 10
winningTrades: 6
losingTrades: 4
winRate: 0.60
grossProfit: 700
grossLoss: -275
profitFactor: 2.545
avgWin: 116.67
avgLoss: 68.75
expectancy: 42.50
averageRRR: 1.697
```

> 이 값들로 구현체의 정확도를 검증한다.