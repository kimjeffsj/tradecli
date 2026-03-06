# ERD — TradeLab CLI Data Models

> 핵심 데이터 모델 및 관계 정의

---

## Entity Relationship Diagram

```mermaid
erDiagram
    Candle {
        string pair
        string timeframe
        float open
        float high
        float low
        float close
        float volume
        datetime timestamp
    }

    SwingPoint {
        string id
        string type "SWING_HIGH | SWING_LOW"
        float price
        int candleIndex
        datetime timestamp
        boolean broken
    }

    StructureBreak {
        string id
        string type "BOS | CHoCH"
        string direction "BULLISH | BEARISH"
        float breakPrice
        int breakCandleIndex
        datetime timestamp
        string swingPointId
    }

    OrderBlock {
        string id
        string direction "BULLISH | BEARISH"
        float highPrice
        float lowPrice
        int startIndex
        int endIndex
        string status "FRESH | TESTED | BROKEN"
        string structureBreakId
        datetime timestamp
    }

    FairValueGap {
        string id
        string direction "BULLISH | BEARISH"
        float highPrice
        float lowPrice
        float fillPercentage
        int candleIndex
        string status "OPEN | PARTIALLY_FILLED | FILLED"
        datetime timestamp
    }

    Bias {
        string pair
        string bias "LONG | SHORT | NEUTRAL"
        float confidence
        datetime timestamp
    }

    TimeframeBias {
        string timeframe
        string direction "BULLISH | BEARISH | NEUTRAL"
        float weight
    }

    Signal {
        string id
        string strategyName
        string pair
        string timeframe
        string direction "LONG | SHORT"
        float entryPrice
        float stopLoss
        float takeProfit
        float confidence
        datetime timestamp
        string reason
    }

    Trade {
        string id
        string signalId
        string direction "LONG | SHORT"
        float entryPrice
        float exitPrice
        float stopLoss
        float takeProfit
        float positionSize
        float pnl
        float pnlPercent
        string exitReason "TP | SL | SIGNAL"
        datetime entryTime
        datetime exitTime
        int holdingPeriodBars
    }

    BacktestResult {
        string id
        string strategyName
        string pair
        string timeframe
        int totalTrades
        float winRate
        float profitFactor
        float maxDrawdown
        float sharpeRatio
        float sortinoRatio
        float valueAtRisk95
        float expectancy
        float averageRRR
        int consecutiveWins
        int consecutiveLosses
        datetime startDate
        datetime endDate
    }

    LiveSignal {
        string action "BUY | SELL | HOLD"
        string pair
        string timeframe
        string direction "LONG | SHORT"
        float entryPrice
        float stopLoss
        float takeProfit
        float confidence
        string strategyName
        string reason
        datetime generatedAt
    }

    Position {
        string positionId
        string pair
        string direction "LONG | SHORT"
        float entryPrice
        float currentPrice
        float stopLoss
        float takeProfit
        float volume
        float pnl
        datetime openedAt
    }

    OrderResult {
        string orderId
        string status "FILLED | REJECTED | PENDING"
        float filledPrice
        datetime filledAt
        string reason
    }

    CloseResult {
        string positionId
        string status "CLOSED | FAILED"
        float exitPrice
        float pnl
        datetime closedAt
        string reason
    }

    TradingEvent {
        string type "SIGNAL_GENERATED | ORDER_FILLED | POSITION_CLOSED | ..."
        datetime timestamp
        string message
    }

    RiskGuardConfig {
        float maxDailyDrawdown
        int maxPositions
        float maxRiskPerTrade
        int maxDailyTrades
    }

    Candle ||--o{ SwingPoint : "produces"
    SwingPoint ||--o{ StructureBreak : "breaks"
    StructureBreak ||--o| OrderBlock : "creates"
    Candle ||--o{ FairValueGap : "contains"
    Bias ||--|{ TimeframeBias : "composed of"
    Signal }o--|| Trade : "generates"
    Trade }o--|| BacktestResult : "aggregates into"
    Signal ||--o| LiveSignal : "extends to"
    LiveSignal ||--o| OrderResult : "executes"
    LiveSignal ||--o| Position : "opens"
    Position ||--o| CloseResult : "closes"
    LiveSignal ||--o{ TradingEvent : "emits"
    OrderResult ||--o| TradingEvent : "emits"
    CloseResult ||--o| TradingEvent : "emits"
    RiskGuardConfig ||--|| LiveSignal : "validates"
```

---

## Core Types (TypeScript)

### Market Data

```typescript
// === Timeframe ===
type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1';

// === Candle (OHLCV) ===
interface Candle {
  pair: string;
  timeframe: Timeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}
```

### SMC Structures

```typescript
// === Swing Point ===
type SwingType = 'SWING_HIGH' | 'SWING_LOW';

interface SwingPoint {
  id: string;
  type: SwingType;
  price: number;
  candleIndex: number;
  timestamp: Date;
  broken: boolean;
}

// === Structure Break (BOS / CHoCH) ===
type BreakType = 'BOS' | 'CHoCH';
type MarketDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

interface StructureBreak {
  id: string;
  type: BreakType;
  direction: MarketDirection;
  breakPrice: number;
  breakCandleIndex: number;
  timestamp: Date;
  swingPointId: string; // 돌파된 swing point 참조
}

// === Order Block ===
type OBStatus = 'FRESH' | 'TESTED' | 'BROKEN';

interface OrderBlock {
  id: string;
  direction: MarketDirection;
  highPrice: number;
  lowPrice: number;
  startIndex: number;
  endIndex: number;
  status: OBStatus;
  structureBreakId: string; // 관련 BOS 참조
  timestamp: Date;
}

// === Fair Value Gap ===
type FVGStatus = 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED';

interface FairValueGap {
  id: string;
  direction: MarketDirection;
  highPrice: number;
  lowPrice: number;
  fillPercentage: number; // 0.0 ~ 1.0
  candleIndex: number;
  status: FVGStatus;
  timestamp: Date;
}
```

### Analysis Results

```typescript
// === SMC Analysis Result ===
interface SMCAnalysis {
  pair: string;
  timeframe: Timeframe;
  candles: Candle[];
  swingPoints: SwingPoint[];
  structureBreaks: StructureBreak[];
  orderBlocks: OrderBlock[];
  fairValueGaps: FairValueGap[];
  currentDirection: MarketDirection;
  analyzedAt: Date;
}

// === Timeframe Bias ===
interface TimeframeBias {
  timeframe: Timeframe;
  direction: MarketDirection;
  weight: number; // 0.0 ~ 1.0
}

// === Composite Bias ===
interface Bias {
  pair: string;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number; // 0.0 ~ 1.0
  structure: TimeframeBias[];
  timestamp: Date;
}
```

### Strategy & Signals

```typescript
// === Signal ===
type SignalDirection = 'LONG' | 'SHORT';

interface Signal {
  id: string;
  strategyName: string;
  pair: string;
  timeframe: Timeframe;
  direction: SignalDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  timestamp: Date;
  reason: string; // 진입 근거 설명
  metadata?: Record<string, unknown>; // 전략별 추가 데이터
}

// === Strategy Context ===
interface StrategyContext {
  pair: string;
  timeframe: Timeframe;
  candles: Candle[];
  analysis: SMCAnalysis;
  bias?: Bias;
  config: StrategyConfig;
}

// === Strategy Config ===
interface StrategyConfig {
  [key: string]: unknown;
}
```

### Backtest

```typescript
// === Trade ===
type ExitReason = 'TP' | 'SL' | 'SIGNAL' | 'END_OF_DATA';

interface Trade {
  id: string;
  signalId: string;
  direction: SignalDirection;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  pnl: number;
  pnlPercent: number;
  exitReason: ExitReason;
  entryTime: Date;
  exitTime: Date;
  holdingPeriodBars: number;
}

// === Position Sizing ===
type SizingMethod = 'FIXED_PERCENT' | 'KELLY';

interface PositionSizingConfig {
  method: SizingMethod;
  riskPercent: number;       // FIXED_PERCENT: 계좌 대비 %
  initialBalance: number;
  kellyFraction?: number;    // KELLY: 분수 적용 비율 (기본 0.5)
}

// === Backtest Config ===
interface BacktestConfig {
  pair: string;
  timeframe: Timeframe;
  strategyName: string;
  startDate?: Date;
  endDate?: Date;
  sizing: PositionSizingConfig;
  slippage?: number;         // 슬리피지 (pips)
  commission?: number;       // 수수료 (per trade)
}

// === Risk Metrics ===
interface RiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  valueAtRisk95: number;     // 95% VaR
  valueAtRisk99: number;     // 99% VaR
  maxDrawdown: number;
  maxDrawdownDuration: number; // bars
  calmarRatio: number;
}

// === Backtest Result ===
interface BacktestResult {
  id: string;
  config: BacktestConfig;
  trades: Trade[];
  // 기본 통계
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  averageRRR: number;
  // 연속 기록
  consecutiveWins: number;
  consecutiveLosses: number;
  // 리스크 메트릭스
  risk: RiskMetrics;
  // 에쿼티
  equityCurve: EquityPoint[];
  // 메타
  startDate: Date;
  endDate: Date;
  executionTimeMs: number;
}

// === Equity Point ===
interface EquityPoint {
  timestamp: Date;
  balance: number;
  drawdown: number;
  tradeIndex?: number;
}
```

### Live Signal (Phase 4 — TypeScript)

```typescript
// === Live Signal ===
interface LiveSignal {
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  pair: string;
  timeframe: Timeframe;
  strategyName: string;
  reason: string;
  generatedAt: number;
}

// === Signal Engine Config ===
type DeliveryMode = 'file' | 'http' | 'both';

interface SignalEngineConfig {
  pair: string;
  timeframe: Timeframe;
  strategyName: string;
  interval: string;
  dataAdapter: string;
  lookback: number;
  deliveryMode: DeliveryMode;
  httpEndpoint?: string;
  outputDir?: string;
}
```

### Execution & Notification (Phase 5-6 — Python Pydantic)

```python
# === Execution Types (Phase 5) ===

class LiveSignal(BaseModel):
    """TS SignalEngine에서 HTTP POST로 수신하는 시그널."""
    action: str           # "BUY" | "SELL" | "HOLD"
    pair: str
    timeframe: str
    direction: str        # "LONG" | "SHORT"
    entry_price: float
    stop_loss: float
    take_profit: float
    confidence: float
    strategy_name: str
    reason: str
    generated_at: int     # Unix timestamp (ms)

class OrderResult(BaseModel):
    order_id: str
    status: str           # "FILLED" | "REJECTED" | "PENDING"
    filled_price: float
    filled_at: int
    reason: str | None = None

class Position(BaseModel):
    position_id: str
    pair: str
    direction: str
    entry_price: float
    current_price: float
    stop_loss: float
    take_profit: float
    volume: float
    pnl: float
    opened_at: int

class CloseResult(BaseModel):
    position_id: str
    status: str           # "CLOSED" | "FAILED"
    exit_price: float
    pnl: float
    closed_at: int
    reason: str | None = None

class AccountInfo(BaseModel):
    balance: float
    equity: float
    margin: float
    free_margin: float
    currency: str

# === Risk Guard (Phase 5) ===

class RiskGuardConfig(BaseModel):
    max_daily_drawdown: float
    max_positions: int
    max_risk_per_trade: float
    max_daily_trades: int
    trading_hours: TradingHours | None = None

# === Trading Event (Phase 6) ===

class TradingEvent(BaseModel):
    type: str             # "SIGNAL_GENERATED" | "ORDER_FILLED" | ...
    timestamp: int
    data: dict
    message: str
```

### Data Adapter

```typescript
// === Fetch Options ===
interface FetchOptions {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  useCache?: boolean;
  cacheTTL?: number; // seconds
}

// === Data Adapter Interface ===
interface DataAdapter {
  name: string;
  fetchCandles(pair: string, timeframe: Timeframe, options?: FetchOptions): Promise<Candle[]>;
  getSupportedPairs(): Promise<string[]>;
  getSupportedTimeframes(): Timeframe[];
}

// === Cache Entry ===
interface CacheEntry {
  key: string;           // pair:timeframe:startDate:endDate
  data: Candle[];
  fetchedAt: Date;
  expiresAt: Date;
}
```

---

## Data Flow

### Phase 1-3: Analysis & Backtest

```
DataAdapter.fetchCandles()
    → Candle[]
        → SwingDetector.detect()
            → SwingPoint[]
                → StructureAnalyzer.analyze()
                    → StructureBreak[]
                        → OrderBlockDetector.detect()
                            → OrderBlock[]
        → FVGDetector.detect()
            → FairValueGap[]

SMCAnalysis (all above combined)
    → BiasEngine.calculate()
        → Bias
    → Strategy.generateSignals()
        → Signal[]
            → BacktestEngine.run()
                → Trade[]
                    → RiskCalculator.calculate()
                        → BacktestResult
```

### Phase 4-6: Live Signal → HTTP → Python Execution → Telegram

```
[TypeScript]
SignalEngine (cron/interval)
    → DataAdapter.fetchCandles()
        → SMC Analysis Pipeline
            → Strategy.analyze()
                → LiveSignal
                    → HTTP POST /api/signals (JSON)
                        ↓
[Python — executor/]
FastAPI Server
    → POST /api/signals 수신
        → RiskGuard.validate()
            ├─ allowed: true
            │   → MT5.execute() (MetaTrader5)
            │       → OrderResult
            │           → TelegramBot.notify(ORDER_FILLED)
            └─ allowed: false
                → TelegramBot.notify(RISK_GUARD_BLOCKED)

Position lifecycle (Python REST API):
    GET /api/positions → Position[]
    POST /api/close/{id} → CloseResult → TelegramBot.notify(POSITION_CLOSED)
    POST /api/close-all → CloseResult[] → TelegramBot.notify(POSITION_CLOSED)
```

---

## TS ↔ Python Communication Protocol

TypeScript SignalEngine이 LiveSignal을 생성하면 Python executor 서버로 HTTP POST 전송.

### POST /api/signals — Request (TS → Python)

```json
{
  "action": "BUY",
  "pair": "XAUUSD",
  "timeframe": "H1",
  "direction": "LONG",
  "entryPrice": 2350.50,
  "stopLoss": 2340.00,
  "takeProfit": 2371.50,
  "confidence": 0.78,
  "strategyName": "smc",
  "reason": "Bullish OB retest at H1 + D1 bullish bias",
  "generatedAt": 1709726400000
}
```

### POST /api/signals — Response (Python → TS)

```json
{
  "orderId": "mt5-12345",
  "status": "FILLED",
  "filledPrice": 2350.60,
  "filledAt": 1709726401000,
  "reason": null
}
```

### JSON 필드 매핑 (TS camelCase ↔ Python snake_case)

| TypeScript | Python | 타입 |
|-----------|--------|------|
| entryPrice | entry_price | float |
| stopLoss | stop_loss | float |
| takeProfit | take_profit | float |
| strategyName | strategy_name | str |
| generatedAt | generated_at | int (ms) |
| filledPrice | filled_price | float |
| filledAt | filled_at | int (ms) |

> Note: HTTP JSON 전송 시 camelCase 사용 (TS 기준). Python 서버에서 Pydantic `alias_generator`로 자동 변환.

---

## Key Relationships

| From | To | Relationship | Description |
|------|----|-------------|-------------|
| Candle[] | SwingPoint[] | 1:N | 캔들 시퀀스에서 스윙 포인트 탐지 |
| SwingPoint | StructureBreak | 1:N | 스윙 포인트 돌파 시 구조 변경 생성 |
| StructureBreak | OrderBlock | 1:1 | BOS 직전 반대 캔들이 OB |
| Candle[] | FairValueGap | 1:N | 3캔들 구조에서 갭 탐지 |
| SMCAnalysis + Bias | Signal | N:N | 분석 결과 + Bias로 시그널 생성 |
| Signal | Trade | 1:1 | 시그널 하나가 트레이드 하나 |
| Trade[] | BacktestResult | N:1 | 트레이드 모음이 백테스트 결과 |
| BacktestResult | RiskMetrics | 1:1 | 결과에서 리스크 메트릭 계산 |
| Signal | LiveSignal | 1:1 | 백테스트 시그널을 라이브로 확장 |
| LiveSignal | RiskGuard | N:1 | 주문 전 리스크 검증 |
| LiveSignal | OrderResult | 1:1 | 주문 실행 결과 |
| LiveSignal | Position | 1:1 | 실행된 포지션 |
| Position | CloseResult | 1:1 | 포지션 청산 결과 |
| LiveSignal/OrderResult/CloseResult | TradingEvent | 1:N | 이벤트 발생 → 알림 전달 |

---

## Index / Lookup Patterns

분석 엔진에서 자주 사용되는 조회 패턴:

- **캔들 by index**: `candles[i]` — O(1) 배열 인덱스
- **스윙 포인트 by range**: 특정 캔들 범위 내 스윙 포인트 — 정렬된 배열 이진 탐색
- **OB by status**: `FRESH` 상태 OB만 필터링 — 상태별 필터
- **FVG by status**: `OPEN` 상태 FVG만 필터링 — 상태별 필터
- **최근 N개 구조 변경**: 최신 BOS/CHoCH 조회 — 역순 정렬

> 참고: MVP에서는 DB 없이 인메모리 배열 기반. 모든 데이터는 분석 실행 시 생성되고 JSON으로 직렬화.