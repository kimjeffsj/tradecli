# PRD — TradeLab CLI

> SMC 기반 전략 연구 플랫폼 (CLI-first, Web-ready)

---

## 1. Product Overview

### 1.1 제품명

**TradeLab CLI**

### 1.2 비전

SMC 기반 분석을 자동화하고, 전략을 플러그인 형태로 확장하며, 백테스트 및 리스크 모델링까지 가능한 CLI 중심 전략 연구 플랫폼을 구축한다.

### 1.3 핵심 목표

- SMC 패턴 자동 감지 (Swing, BOS/CHoCH, OB, FVG)
- 멀티 타임프레임 Bias 판단
- 전략 플러그인 아키텍처 (MVP: SMC → 이후 ICT, 기술적 지표 확장)
- 풀 리스크 모델링 백테스트 엔진 (Sharpe, Sortino, VaR)
- 데이터 소스 어댑터 패턴 (Twelve Data, CCXT 등 교체 가능)
- CLI 기반 연구 워크플로우 확립
- 향후 Web Dashboard 확장 가능 구조 확보

---

## 2. Target User

- 개인 트레이더 (SMC/ICT 사용자)
- 전략 연구 목적의 개발자
- CLI 기반 워크플로우 선호 사용자
- 향후 자동매매 시스템 확장을 고려하는 사용자

---

## 3. Scope

### 3.1 MVP (Phase 1–3)

| 영역 | 포함 |
|------|------|
| 데이터 | OHLCV 수집, 어댑터 패턴, 로컬 캐시 |
| SMC 엔진 | Swing H/L, BOS/CHoCH, Order Block, FVG |
| Bias | 멀티 타임프레임 정렬 (D1 → H4 → H1) |
| 전략 | 플러그인 인터페이스, SMC 전략 모듈 |
| 백테스트 | 진입/청산, 풀 리스크 메트릭스 |
| 출력 | JSON 리포트, CLI 포맷 출력 |

### 3.2 제외 (Phase 4+)

- 실시간 자동매매
- 웹 UI / Dashboard
- ML 기반 예측
- ICT 확장 전략
- 기술적 지표 조합 전략 (RSI, EMA 등)

---

## 4. Functional Requirements

### 4.1 데이터 수집

**FR-1: 데이터 소스 어댑터**

```typescript
interface DataAdapter {
  name: string;
  fetchCandles(pair: string, timeframe: Timeframe, options?: FetchOptions): Promise<Candle[]>;
  getSupportedPairs(): Promise<string[]>;
  getSupportedTimeframes(): Timeframe[];
}
```

어댑터 패턴으로 데이터 소스 교체 가능. MVP에서는 하나의 구현체로 시작하되, 인터페이스는 확정.

**FR-2: CLI 데이터 조회**

```bash
trade analyze --pair XAUUSD --tf H4
trade scan --pairs XAUUSD,EURUSD --tf H4
```

**FR-3: 로컬 캐시**

동일 요청에 대한 API 호출 최소화를 위한 파일 기반 캐시. TTL 설정 가능.

---

### 4.2 SMC 분석 엔진

**FR-4: Swing Detection**

- 로컬 최대/최소 탐지
- 설정 가능한 lookback window (기본값: 5)
- SwingPoint 타입: `SWING_HIGH` | `SWING_LOW`

**FR-5: BOS / CHoCH**

- 이전 구조 고점/저점 돌파 감지
- BOS: 추세 방향 유지 돌파
- CHoCH: 추세 방향 변경 돌파
- 구조 방향성 상태 추적 (`BULLISH` | `BEARISH` | `NEUTRAL`)

**FR-6: Order Block**

- BOS 직전 마지막 반대 캔들 영역 탐색
- OB 상태: `FRESH` | `TESTED` | `BROKEN`
- 재테스트 여부 추적

**FR-7: Fair Value Gap**

- 3캔들 구조 기반 갭 탐지
- FVG 상태: `OPEN` | `PARTIALLY_FILLED` | `FILLED`
- 갭 메워짐 비율 추적

---

### 4.3 Bias Engine

**FR-8: 멀티 타임프레임 Bias**

D1 → H4 → H1 정렬 기반 종합 Bias 판단. 각 타임프레임 가중치 적용.

```json
{
  "pair": "XAUUSD",
  "bias": "LONG",
  "confidence": 0.72,
  "structure": {
    "D1": { "direction": "BULLISH", "weight": 0.5 },
    "H4": { "direction": "BULLISH", "weight": 0.3 },
    "H1": { "direction": "BEARISH", "weight": 0.2 }
  },
  "timestamp": "2025-01-15T10:00:00Z"
}
```

---

### 4.4 Strategy Engine

**FR-9: 전략 플러그인 인터페이스**

```typescript
interface Strategy {
  name: string;
  version: string;
  description: string;
  requiredTimeframes: Timeframe[];
  generateSignals(context: StrategyContext): Signal[];
  getDefaultConfig(): StrategyConfig;
}
```

SMC는 하나의 전략 모듈. 향후 ICT, 기술적 지표 전략도 동일 인터페이스로 추가.

**FR-10: Strategy Registry**

```typescript
interface StrategyRegistry {
  register(strategy: Strategy): void;
  get(name: string): Strategy | undefined;
  list(): StrategyInfo[];
}
```

---

### 4.5 Backtest Engine

**FR-11: 백테스트 실행**

- Long/Short 진입
- SL/TP 기반 청산
- 포지션 사이징 (고정 %, Kelly Criterion)
- 트레이드별 손익 추적

**FR-12: 풀 리스크 메트릭스**

```json
{
  "totalTrades": 48,
  "winRate": 0.58,
  "profitFactor": 1.42,
  "maxDrawdown": -0.12,
  "sharpeRatio": 1.25,
  "sortinoRatio": 1.68,
  "valueAtRisk95": -0.034,
  "averageRRR": 2.1,
  "expectancy": 0.42,
  "consecutiveWins": 7,
  "consecutiveLosses": 4,
  "equityCurve": [...]
}
```

---

## 5. Non-Functional Requirements

| 요구사항 | 설명 |
|----------|------|
| 확장성 | 전략/데이터소스 플러그인 추가 시 기존 코드 수정 최소화 |
| 모듈 독립성 | 각 엔진(SMC, Backtest, Risk)은 독립 테스트 가능 |
| 인터페이스 분리 | CLI ↔ Core Engine 완전 분리 |
| 데이터 포맷 | JSON 기반 입출력 |
| 테스트 커버리지 | 핵심 엔진 80% 이상 |
| 성능 | 백테스트 1000캔들 기준 < 3초 |

---

## 6. System Architecture

```
CLI Layer (TypeScript, Oclif)
        ↓
Application Layer (Use Cases)
        ↓
Core Engine
    ├─ Data Module (Adapter Pattern)
    │   ├─ DataAdapter Interface
    │   ├─ TwelveDataAdapter
    │   ├─ CCXTAdapter (Phase 4+)
    │   └─ LocalCache
    ├─ SMC Module
    │   ├─ SwingDetector
    │   ├─ StructureAnalyzer (BOS/CHoCH)
    │   ├─ OrderBlockDetector
    │   └─ FVGDetector
    ├─ Bias Engine
    │   └─ MultiTimeframeBias
    ├─ Strategy Registry
    │   ├─ Strategy Interface
    │   └─ SMCStrategy (built-in)
    ├─ Backtest Engine
    │   ├─ TradeSimulator
    │   ├─ PositionSizer
    │   └─ EquityTracker
    └─ Risk Module
        ├─ SharpeCalculator
        ├─ SortinoCalculator
        ├─ VaRCalculator
        └─ DrawdownAnalyzer
```

---

## 7. Data Pipeline

```
1. CLI Input (pair, timeframe, strategy, options)
       ↓
2. DataAdapter.fetchCandles() → 로컬 캐시 확인
       ↓
3. OHLCV 파싱 + 검증
       ↓
4. SMC 분석 (Swing → BOS/CHoCH → OB → FVG)
       ↓
5. Bias 판단 (멀티 타임프레임 정렬)
       ↓
6. Strategy.generateSignals()
       ↓
7. BacktestEngine.run(signals, candles)
       ↓
8. RiskModule.calculate(trades)
       ↓
9. JSON 리포트 생성
       ↓
10. CLI 포맷 출력 (테이블/컬러)
```

---

## 8. CLI Commands

### `analyze`

```bash
trade analyze --pair XAUUSD --tf H4
trade analyze --pair XAUUSD --tf H4 --mtf --output report.json
trade analyze --pair XAUUSD --tf H4 --strategy smc
```

### `backtest`

```bash
trade backtest --pair XAUUSD --tf H1 --strategy smc
trade backtest --pair XAUUSD --tf H1 --strategy smc --sl 20 --tp 40 --risk 1
trade backtest --pair XAUUSD --tf H1 --strategy smc --sizing kelly
```

### `scan`

```bash
trade scan --pairs XAUUSD,EURUSD --tf H4
trade scan --pairs XAUUSD,EURUSD --tf H4 --bias-only
```

### `strategy`

```bash
trade strategy list
trade strategy info smc
```

---

## 9. Success Metrics (MVP)

| 메트릭 | 목표 |
|--------|------|
| SMC 패턴 정확도 | ≥ 80% (수동 검증 기준) |
| 백테스트 실행 속도 | < 3초 (1000 캔들) |
| 전략 모듈 추가 | 기존 코드 수정 0 (인터페이스 준수 시) |
| 테스트 커버리지 | Core Engine ≥ 80% |
| 리스크 메트릭 정확도 | ≥ 95% (수동 계산 대비) |

---

## 10. Roadmap

### Phase 1: Foundation (2~3주)

- 프로젝트 scaffolding (TypeScript, Oclif, Vitest)
- 데이터 어댑터 인터페이스 + 첫 구현체
- 로컬 캐시
- Swing Detection
- BOS / CHoCH
- 기본 CLI `analyze` 커맨드

### Phase 2: SMC Complete (2주)

- Order Block 감지
- Fair Value Gap 감지
- Bias Engine (멀티 타임프레임)
- JSON 리포트 출력
- CLI `scan` 커맨드

### Phase 3: Strategy & Backtest (3주)

- Strategy 인터페이스 + Registry
- SMC Strategy 모듈
- Backtest Engine (진입/청산 시뮬레이션)
- 풀 리스크 메트릭스 (Sharpe, Sortino, VaR)
- CLI `backtest` + `strategy` 커맨드

### Phase 4: Extension (선택)

- CCXT 어댑터 (크립토)
- ICT 전략 모듈
- 기술적 지표 전략 (RSI, EMA 등)
- Dockerization
- Web Dashboard
- 실시간 WebSocket 피드

---

## 11. Tech Stack

| 영역 | 기술 |
|------|------|
| 언어 | TypeScript 5.x (strict mode) |
| CLI 프레임워크 | Oclif |
| 테스트 | Vitest |
| 패키지 매니저 | pnpm |
| 린팅 | ESLint + Prettier |
| 빌드 | tsup 또는 tsc |
| CI | GitHub Actions |

---

## 12. 핵심 설계 원칙

1. **SMC는 "특별한 기능"이 아니라 "전략 중 하나"다.**
2. **CLI는 인터페이스일 뿐이다.** Core Engine은 CLI 없이도 동작해야 한다.
3. **엔진은 독립적으로 동작해야 한다.** 각 모듈은 단독 테스트 가능.
4. **데이터 → 전략 → 백테스트는 완전 분리되어야 한다.**
5. **데이터 소스는 교체 가능해야 한다.** 어댑터 패턴 필수.
6. **모든 출력은 JSON-first.** CLI 포매팅은 최종 레이어.