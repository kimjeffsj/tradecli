# PRD v2 — TradeLab CLI Extended

> SMC 기반 전략 연구 + 실시간 시그널 + MT5 자동매매 + 텔레그램 모니터링

> **NOTE:** Phase 5-7은 `prd-v3.md`에서 멀티 언어 아키텍처(TypeScript + Python)로 재설계되었다.
> 이 문서의 Phase 5-6 TypeScript 인터페이스는 **참고용으로 유지**하며, 실제 구현은 prd-v3의 Python 기반 설계를 따른다.

---

## 1. Product Overview

### 1.1 확장 비전

TradeLab CLI는 SMC 분석 엔진과 백테스트를 넘어, **실시간 시그널 생성 → MT5 자동매매 → 텔레그램 모니터링**까지 이어지는 end-to-end 트레이딩 파이프라인을 구축한다.

### 1.2 핵심 원칙 (기존 유지 + 확장)

1. CLI는 인터페이스일 뿐 — Core Engine은 CLI 없이도 동작
2. 데이터 → 전략 → 백테스트 → 실행은 완전 분리
3. 어댑터 패턴으로 데이터 소스/실행 엔진/알림 채널 교체 가능
4. **실행(Execution)은 반드시 드라이런을 기본값으로 한다**
5. **모든 주문은 리스크 한도 검증을 통과해야 한다**

---

## 2. Phase 1-3 요약 (완료된 기반)

Phase 1-3은 분석 엔진과 백테스트 기반으로, 상세 사양은 `prd.md` 참조.

| Phase | 영역 | 핵심 산출물 |
|-------|------|------------|
| Phase 1 | Foundation | DataAdapter, 캐시, Swing Detection, BOS/CHoCH, CLI `analyze` |
| Phase 2 | SMC Complete | Order Block, FVG, Bias Engine, SMC 통합 분석기, CLI `scan` |
| Phase 3 | Strategy & Backtest | Strategy Registry, SMC Strategy, Backtest Engine, Risk Metrics, CLI `backtest` |

이 기반 위에 Phase 4-6이 확장된다.

---

## 3. 전체 시스템 아키텍처

```
CLI Layer (Oclif)
    ├─ analyze, scan, backtest          ← Phase 1-3
    ├─ live                             ← Phase 4
    ├─ execute, positions, close        ← Phase 5
    └─ notify (내부)                    ← Phase 6
        ↓
Application Layer
        ↓
Core Engine
    ├─ Data Module (Adapter Pattern)
    │   ├─ DataAdapter Interface
    │   ├─ MockDataAdapter
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
    ├─ Risk Module
    │   └─ RiskCalculator
    ├─ Signal Engine                    ← Phase 4 (NEW)
    │   ├─ SignalEngine (cron/interval)
    │   └─ LiveSignal
    ├─ Execution Module                 ← Phase 5 (NEW)
    │   ├─ ExecutionAdapter Interface
    │   ├─ MetaAPIAdapter (MT5)
    │   └─ RiskGuard
    └─ Notification Module              ← Phase 6 (NEW)
        ├─ NotificationAdapter Interface
        └─ TelegramAdapter (grammy)
```

**데이터 플로우 (Phase 4-6):**

```
DataAdapter.fetchCandles()
    → SMC Analysis Pipeline
        → Strategy.generateSignals()
            → LiveSignal (Phase 4)
                → RiskGuard.validate() (Phase 5)
                    → ExecutionAdapter.execute() (Phase 5)
                        → NotificationAdapter.notify() (Phase 6)
```

---

## 4. Phase 4: Live Signal Engine

### 4.1 목표

백테스트용 Signal을 실시간 환경으로 확장하여, 설정된 주기(cron/interval)마다 분석 파이프라인을 실행하고 라이브 시그널을 발생시킨다.

### 4.2 Functional Requirements

**FR-13: LiveSignal 타입**

기존 `Signal`(strategy.ts)은 백테스트용으로 유지. `LiveSignal`은 이를 확장하여 실행에 필요한 정보를 추가한다.

```typescript
// 기존 Signal을 확장
interface LiveSignal {
  // Signal 기반 필드
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;

  // Live 전용 필드
  action: 'BUY' | 'SELL' | 'HOLD';
  pair: string;
  timeframe: Timeframe;
  strategyName: string;
  reason: string;           // 진입 근거 설명
  generatedAt: number;      // timestamp
}
```

**FR-14: SignalEngine**

```typescript
interface SignalEngineConfig {
  pair: string;
  timeframe: Timeframe;
  strategyName: string;
  interval: string;          // cron expression 또는 '5m', '15m' 등
  dataAdapter: string;       // 사용할 DataAdapter 이름
  lookback: number;          // 분석에 사용할 캔들 수
}

// EventEmitter 패턴으로 시그널 이벤트 처리
class SignalEngine extends EventEmitter {
  constructor(config: SignalEngineConfig);

  start(): void;             // cron/interval 시작
  stop(): void;              // 중지
  runOnce(): Promise<LiveSignal | null>;  // 1회 실행 (테스트용)

  // Events
  on(event: 'signal', listener: (signal: LiveSignal) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'tick', listener: (info: TickInfo) => void): this;
}
```

**FR-15: 설정 파일**

```json
// live-config.json
{
  "engines": [
    {
      "pair": "XAUUSD",
      "timeframe": "H1",
      "strategy": "smc",
      "interval": "5m",
      "lookback": 200
    }
  ],
  "dataAdapter": "twelvedata",
  "minConfidence": 0.6
}
```

### 4.3 에러 핸들링

| 상황 | 처리 |
|------|------|
| 데이터 fetch 실패 | 최대 3회 재시도 (exponential backoff), 실패 시 `error` 이벤트 |
| 분석 파이프라인 오류 | 해당 tick 스킵, `error` 이벤트 발생, 다음 tick 정상 실행 |
| 설정 파일 누락 | 명확한 에러 메시지 + 예시 설정 출력 |

### 4.4 CLI

```bash
trade live --pair XAUUSD --strategy smc --interval 5m
trade live --config live-config.json
trade live --pair XAUUSD --strategy smc --once    # 1회 실행 (디버깅용)
```

---

## 5. Phase 5: MT5 Execution

> **Python 전환:** 이 Phase는 prd-v3.md에서 Python(FastAPI + MetaTrader5 공식 패키지)으로 재설계되었다.
> 아래 TypeScript 인터페이스는 설계 참고용으로 유지한다.

### 5.1 목표

LiveSignal을 받아 MT5에서 실제(또는 시뮬레이션) 주문을 실행한다. DataAdapter 철학과 동일하게 ExecutionAdapter 인터페이스로 추상화한다.

### 5.2 Functional Requirements

**FR-16: ExecutionAdapter 인터페이스**

```typescript
interface OrderResult {
  orderId: string;
  status: 'FILLED' | 'REJECTED' | 'PENDING';
  filledPrice: number;
  filledAt: number;          // timestamp
  reason?: string;           // 거부 시 사유
}

interface Position {
  positionId: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  volume: number;
  pnl: number;
  openedAt: number;          // timestamp
}

interface CloseResult {
  positionId: string;
  status: 'CLOSED' | 'FAILED';
  exitPrice: number;
  pnl: number;
  closedAt: number;          // timestamp
  reason?: string;
}

interface ExecutionAdapter {
  name: string;
  execute(signal: LiveSignal): Promise<OrderResult>;
  getPositions(): Promise<Position[]>;
  closePosition(positionId: string): Promise<CloseResult>;
  closeAll(): Promise<CloseResult[]>;
  getAccountInfo(): Promise<AccountInfo>;
}

interface AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
}
```

**FR-17: MetaAPIAdapter 구현체**

- metaapi.cloud REST API를 사용하여 MT5와 통신
- Python 브릿지 대안도 문서화 (MetaTrader5 Python 패키지 → child process 호출)
- 구현 우선순위: MetaAPI (REST, cross-platform) > Python 브릿지 (Windows 전용)

**FR-18: RiskGuard (필수 안전장치)**

```typescript
interface RiskGuardConfig {
  maxDailyDrawdown: number;    // % (예: 0.05 = 5%)
  maxPositions: number;        // 최대 동시 포지션 수
  maxRiskPerTrade: number;     // % (예: 0.02 = 2%)
  maxDailyTrades: number;      // 일일 최대 거래 수
  tradingHours?: {             // 허용 거래 시간 (선택)
    start: string;             // "08:00"
    end: string;               // "22:00"
    timezone: string;          // "UTC"
  };
}

class RiskGuard {
  constructor(config: RiskGuardConfig, adapter: ExecutionAdapter);

  // 주문 전 검증 — 통과 실패 시 거부 사유 반환
  validate(signal: LiveSignal): Promise<{
    allowed: boolean;
    reason?: string;
  }>;

  // 일일 통계 조회
  getDailyStats(): Promise<DailyStats>;
}

interface DailyStats {
  tradesCount: number;
  totalPnl: number;
  drawdown: number;
  openPositions: number;
}
```

### 5.3 실행 모드

| 플래그 | 동작 | 기본값 |
|--------|------|--------|
| `--dry-run` | 시그널 로그만 출력, 주문 미실행 | **기본값** |
| `--confirm` | 각 주문 전 사용자 확인 프롬프트 | - |
| `--force` | 확인 없이 즉시 실행 (RiskGuard는 유지) | - |

### 5.4 CLI

```bash
trade execute --dry-run                  # 기본: 드라이런
trade execute --confirm                  # 주문마다 확인
trade execute --force                    # 확인 없이 실행 (RiskGuard 유지)
trade positions                          # 현재 포지션 조회
trade close <positionId>                 # 특정 포지션 청산
trade close --all                        # 전체 포지션 청산
```

### 5.5 설정 파일

```json
// execution-config.json
{
  "adapter": "metaapi",
  "metaapi": {
    "accountId": "${METAAPI_ACCOUNT_ID}",
    "token": "${METAAPI_TOKEN}"
  },
  "riskGuard": {
    "maxDailyDrawdown": 0.05,
    "maxPositions": 3,
    "maxRiskPerTrade": 0.02,
    "maxDailyTrades": 10,
    "tradingHours": {
      "start": "08:00",
      "end": "22:00",
      "timezone": "UTC"
    }
  }
}
```

---

## 6. Phase 6: Telegram Monitoring

> **Python 전환:** 이 Phase는 prd-v3.md에서 Python(python-telegram-bot)으로 재설계되었다.
> Phase 5 FastAPI 서버에 통합 구현. 아래 TypeScript 인터페이스는 설계 참고용으로 유지한다.

### 6.1 목표

트레이딩 이벤트(시그널, 체결, 청산, 에러)를 텔레그램으로 실시간 알림하고, 봇 커맨드로 상태 조회 및 원격 제어를 제공한다.

### 6.2 Functional Requirements

**FR-19: NotificationAdapter 인터페이스**

```typescript
type TradingEventType =
  | 'SIGNAL_GENERATED'
  | 'ORDER_FILLED'
  | 'POSITION_CLOSED'
  | 'RISK_GUARD_BLOCKED'
  | 'ERROR'
  | 'DAILY_REPORT';

interface TradingEvent {
  type: TradingEventType;
  timestamp: number;
  data: Record<string, unknown>;  // 이벤트별 상세 데이터
  message: string;                // 사람이 읽을 수 있는 요약
}

interface NotificationAdapter {
  name: string;
  notify(event: TradingEvent): Promise<void>;
  start?(): Promise<void>;       // 봇 시작 (양방향 통신용)
  stop?(): Promise<void>;        // 봇 종료
}
```

**FR-20: TelegramAdapter 구현체 (grammy)**

알림 기능:
- 시그널 발생 알림 (페어, 방향, 진입가, SL, TP, 근거)
- 주문 체결 알림 (체결가, 볼륨)
- 포지션 청산 알림 (PnL, 사유)
- RiskGuard 차단 알림 (차단 사유)
- 에러 알림
- 일일 리포트 자동 전송 (설정 시간)

봇 커맨드:
| 커맨드 | 기능 |
|--------|------|
| `/status` | 엔진 상태 (실행 중인 페어, 전략, 마지막 tick 시간) |
| `/positions` | 현재 오픈 포지션 목록 |
| `/pnl` | 오늘 PnL 요약 |
| `/closeall` | 전체 포지션 청산 (확인 메시지 후 실행) |

**FR-21: 설정**

```bash
# .env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

```json
// notification-config.json (선택)
{
  "adapter": "telegram",
  "dailyReport": {
    "enabled": true,
    "time": "23:00",
    "timezone": "Asia/Seoul"
  },
  "filters": {
    "minConfidence": 0.7,
    "events": ["SIGNAL_GENERATED", "ORDER_FILLED", "POSITION_CLOSED", "DAILY_REPORT"]
  }
}
```

---

## 7. Phase 8+: Future

기존 `prd.md` Phase 4(Extension)에서 이동. Phase 7(데이터 분석)은 prd-v3.md 참조. 우선순위 낮음.

- **CCXT 어댑터**: 크립토 데이터 소스
- **ICT 전략 모듈**: Killzone, Liquidity Sweep 등
- **기술적 지표 전략**: RSI + EMA 조합
- **Dockerization**: Dockerfile + docker-compose
- **GitHub Actions CI/CD**
- **npm 패키지 배포**
- **Web Dashboard**: REST API, 차트 시각화, 실시간 WebSocket 피드

---

## 8. 새로운 의존성 패키지

### TypeScript (Phase 4)

| Phase | 패키지 | 용도 |
|-------|--------|------|
| Phase 4 | `node-cron` | 주기적 분석 파이프라인 실행 (또는 `setInterval` 대안) |

### Python (Phase 5-6) — 상세는 prd-v3.md 참조

| Phase | 패키지 | 용도 |
|-------|--------|------|
| Phase 5 | `fastapi`, `uvicorn` | REST API 서버 |
| Phase 5 | `MetaTrader5` | MT5 공식 Python 패키지 |
| Phase 5 | `pydantic` | 데이터 검증 |
| Phase 6 | `python-telegram-bot` | Telegram Bot API |

---

## 9. 로드맵

| Phase | 기간 | 핵심 마일스톤 |
|-------|------|--------------|
| Phase 4: Live Signal Engine | 3주 | SignalEngine, LiveSignal, cron 실행, `trade live` CLI |
| Phase 5: MT5 Execution (Python) | 3주 | FastAPI, MetaTrader5, RiskGuard, REST API |
| Phase 6: Telegram (Python) | 2주 | python-telegram-bot, 봇 커맨드, 일일 리포트 |
| Phase 7: Analysis (Python) | 2주 | pandas, Jupyter, 자동 리포트 — prd-v3.md |
| Phase 8+: Future | TBD | CCXT, ICT, Web Dashboard 등 |

---

## 10. 성공 메트릭

| 메트릭 | 목표 |
|--------|------|
| 시그널 발생 지연 | < 5초 (데이터 fetch ~ 시그널 발생) |
| MT5 주문 실행 지연 | < 3초 (시그널 → 주문 체결) |
| RiskGuard 차단 정확도 | 100% (한도 초과 시 반드시 차단) |
| 텔레그램 알림 전달 | < 2초 (이벤트 → 메시지 수신) |
| 드라이런 기본값 | 명시적 플래그 없이 절대 실주문 불가 |
| 일일 리포트 자동 전송 | 설정 시간 ±1분 이내 |

---

## 11. 기존 타입과의 관계

| 기존 타입 | 위치 | Phase 4-6과의 관계 |
|-----------|------|-------------------|
| `Signal` | `strategy.ts` | 백테스트용 유지. LiveSignal은 이를 확장 |
| `Trade` | `backtest.ts` | 백테스트 트레이드 기록. Position은 라이브 포지션 |
| `DataAdapter` | `data/` | ExecutionAdapter, NotificationAdapter의 설계 철학 원본 |
| `Strategy` | `strategy.ts` | SignalEngine이 Strategy.analyze()를 호출하여 LiveSignal 생성 |
