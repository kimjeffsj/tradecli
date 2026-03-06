# PRD v3 — TradeLab Multi-Language Architecture

> SMC 분석(TypeScript) + MT5 실행/텔레그램/데이터 분석(Python) 멀티 언어 아키텍처

---

## 1. Product Overview

### 1.1 확장 비전

TradeLab은 **TypeScript Core Engine + Python Execution/Analysis**의 멀티 언어 아키텍처로 확장한다.

- **TypeScript** (Phase 1-4): SMC 분석, 전략, 백테스트, 라이브 시그널
- **Python** (Phase 5-7): MT5 실행, 텔레그램 모니터링, 데이터 분석/시각화

### 1.2 prd-v2.md와의 핵심 차이

| 항목 | prd-v2 | prd-v3 |
|------|--------|--------|
| Phase 5 MT5 | TypeScript + MetaAPI SDK | **Python + MetaTrader5 공식 패키지** |
| Phase 6 Telegram | TypeScript + grammy | **Python + python-telegram-bot** |
| Phase 7 | Future (CCXT, ICT 등) | **데이터 분석 (pandas, Jupyter)** |
| 통신 | 단일 프로세스 | **REST API (TS → Python HTTP POST)** |
| 구조 | 단일 TypeScript | **Monorepo (src/ + executor/ + analysis/)** |

### 1.3 핵심 원칙 (기존 유지 + 확장)

1. CLI는 인터페이스일 뿐 — Core Engine은 CLI 없이도 동작
2. 데이터 → 전략 → 백테스트 → 실행은 완전 분리
3. 어댑터 패턴으로 데이터 소스/실행 엔진/알림 채널 교체 가능
4. **실행(Execution)은 반드시 드라이런을 기본값으로 한다**
5. **모든 주문은 리스크 한도 검증을 통과해야 한다**
6. **TypeScript는 분석/전략, Python은 실행/연동/분석 — 역할을 명확히 분리**

---

## 2. Phase 1-3 요약 (완료된 기반)

Phase 1-3은 분석 엔진과 백테스트 기반으로, 상세 사양은 `prd.md` 참조.

| Phase | 영역 | 핵심 산출물 |
|-------|------|------------|
| Phase 1 | Foundation | DataAdapter, 캐시, Swing Detection, BOS/CHoCH, CLI `analyze` |
| Phase 2 | SMC Complete | Order Block, FVG, Bias Engine, SMC 통합 분석기, CLI `scan` |
| Phase 3 | Strategy & Backtest | Strategy Registry, SMC Strategy, Backtest Engine, Risk Metrics, CLI `backtest` |

---

## 3. 전체 시스템 아키텍처

### 3.1 통합 뷰 (Phase 1-7)

```
[TypeScript — src/]
  CLI Layer (Oclif)
      ├─ analyze, scan, backtest          ← Phase 1-3
      └─ live                             ← Phase 4
          ↓
  Core Engine
      ├─ Data Module (DataAdapter)
      ├─ SMC Module (Swing, Structure, OB, FVG)
      ├─ Bias Engine
      ├─ Strategy Registry
      ├─ Backtest Engine + Risk Module
      └─ Signal Engine                    ← Phase 4
          ↓
      HTTP POST /api/signals (JSON)
          ↓
[Python — executor/]
  FastAPI Server                          ← Phase 5
      ├─ POST /api/signals    (시그널 수신 + 주문 실행)
      ├─ GET  /api/positions  (오픈 포지션 조회)
      ├─ POST /api/close/{id} (개별 청산)
      ├─ POST /api/close-all  (전체 청산)
      ├─ GET  /api/account    (잔고/마진 조회)
      └─ GET  /api/health     (서버 상태)
      ├─ RiskGuard (주문 전 리스크 검증)
      ├─ MetaTrader5 (MT5 직접 연동)
      └─ Telegram Bot                     ← Phase 6
          ├─ 알림 전송 (시그널, 체결, 청산, 에러)
          └─ 봇 커맨드 (/status, /positions, /pnl, /closeall)

[Python — analysis/]
  데이터 분석 + 시각화                     ← Phase 7
      ├─ Jupyter Notebooks
      └─ 자동 리포트 스크립트
```

### 3.2 Monorepo 디렉터리 구조

```
tradecli/
├── src/                      # TypeScript (Phase 1-4)
│   ├── index.ts
│   ├── commands/
│   └── core/
│       ├── types/
│       ├── data/
│       ├── smc/
│       ├── bias/
│       ├── strategy/
│       ├── backtest/
│       ├── risk/
│       └── signal/           # Phase 4
├── tests/                    # TypeScript 테스트
├── executor/                 # Python (Phase 5-6)
│   ├── pyproject.toml
│   ├── src/
│   │   └── executor/
│   │       ├── __init__.py
│   │       ├── main.py       # FastAPI app
│   │       ├── mt5.py        # MetaTrader5 연동
│   │       ├── risk_guard.py
│   │       ├── models.py     # Pydantic 모델
│   │       ├── telegram_bot.py  # Phase 6
│   │       └── config.py
│   └── tests/
├── analysis/                 # Python (Phase 7)
│   ├── pyproject.toml
│   ├── notebooks/
│   ├── scripts/
│   └── tests/
├── package.json              # TypeScript
├── tsconfig.json
├── prd.md
├── prd-v2.md
├── prd-v3.md
└── CHECKLIST.md
```

### 3.3 TS ↔ Python 통신 프로토콜

**방식:** REST API (HTTP POST)

TypeScript SignalEngine이 LiveSignal을 생성하면 Python executor 서버로 HTTP POST 전송.

**시그널 JSON 스키마:**

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

**응답 스키마:**

```json
{
  "orderId": "mt5-12345",
  "status": "FILLED",
  "filledPrice": 2350.60,
  "filledAt": 1709726401000,
  "reason": null
}
```

---

## 4. Phase 4: Live Signal Engine (TypeScript)

### 4.0 TwelveData DataAdapter (사전 조건)

실시간 시그널을 위해 실제 데이터 소스가 필요하다. TwelveData REST API 기반 DataAdapter를 Phase 4의 첫 태스크로 구현한다.

```typescript
// TwelveDataAdapter는 기존 DataAdapter 인터페이스를 준수
// API Key: 환경 변수 TWELVEDATA_API_KEY
// 엔드포인트: GET /time_series
// 레이트 리밋: 8 req/min (Free), 800 req/min (Basic)
```

### 4.1 LiveSignal 타입 + SignalEngine

prd-v2의 FR-13, FR-14 기반. 추가 보강:

**SignalEngine 출력 모드:**

```typescript
type DeliveryMode = 'file' | 'http' | 'both';

interface SignalEngineConfig {
  pair: string;
  timeframe: Timeframe;
  strategyName: string;
  interval: string;          // cron expression 또는 '5m', '15m' 등
  dataAdapter: string;       // 사용할 DataAdapter 이름
  lookback: number;          // 분석에 사용할 캔들 수
  deliveryMode: DeliveryMode;
  httpEndpoint?: string;     // 'http' | 'both' 시 필수 (예: http://localhost:8000/api/signals)
  outputDir?: string;        // 'file' | 'both' 시 JSON 파일 저장 디렉터리
}
```

- **file**: LiveSignal을 JSON 파일로 저장 (디버깅, 분석용)
- **http**: Python executor 서버로 HTTP POST 전송 (프로덕션)
- **both**: 파일 저장 + HTTP POST 동시

### 4.2 에러 핸들링

| 상황 | 처리 |
|------|------|
| 데이터 fetch 실패 | 최대 3회 재시도 (exponential backoff) |
| HTTP POST 실패 | 최대 3회 재시도, 실패 시 파일로 폴백 저장 |
| 분석 파이프라인 오류 | 해당 tick 스킵, 다음 tick 정상 실행 |
| 설정 파일 누락 | 명확한 에러 메시지 + 예시 설정 출력 |

### 4.3 CLI

```bash
trade live --pair XAUUSD --strategy smc --interval 5m
trade live --config live-config.json
trade live --pair XAUUSD --strategy smc --once    # 1회 실행
```

---

## 5. Phase 5: MT5 Execution (Python — executor/)

### 5.1 목표

Python FastAPI 서버로 MT5 주문을 실행한다. TypeScript SignalEngine이 HTTP POST로 시그널을 전달하면, Python 서버가 RiskGuard 검증 후 MetaTrader5 패키지로 주문을 실행한다.

### 5.2 기술 스택

| 영역 | 기술 |
|------|------|
| 언어 | Python 3.12+ |
| 웹 프레임워크 | FastAPI |
| MT5 연동 | MetaTrader5 (공식 Python 패키지) |
| 타입 검증 | Pydantic v2 |
| 패키지 매니저 | uv |
| 테스트 | pytest + pytest-asyncio |
| 타입 체크 | mypy (strict) |
| 린팅 | ruff |

### 5.3 API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/signals` | 시그널 수신 → RiskGuard 검증 → 주문 실행 |
| GET | `/api/positions` | 현재 오픈 포지션 목록 |
| POST | `/api/close/{id}` | 특정 포지션 청산 |
| POST | `/api/close-all` | 전체 포지션 청산 |
| GET | `/api/account` | 계좌 정보 (잔고, 마진) |
| GET | `/api/health` | 서버 + MT5 연결 상태 |

### 5.4 Pydantic 모델 (핵심)

```python
from pydantic import BaseModel
from enum import Enum

class Action(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"

class OrderStatus(str, Enum):
    FILLED = "FILLED"
    REJECTED = "REJECTED"
    PENDING = "PENDING"

class LiveSignal(BaseModel):
    action: Action
    pair: str
    timeframe: str
    direction: str           # "LONG" | "SHORT"
    entry_price: float
    stop_loss: float
    take_profit: float
    confidence: float
    strategy_name: str
    reason: str
    generated_at: int        # Unix timestamp (ms)

class OrderResult(BaseModel):
    order_id: str
    status: OrderStatus
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
    status: str              # "CLOSED" | "FAILED"
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
```

### 5.5 RiskGuard (Python)

prd-v2의 FR-18 로직을 Python으로 포팅한다.

```python
class RiskGuardConfig(BaseModel):
    max_daily_drawdown: float    # 0.05 = 5%
    max_positions: int
    max_risk_per_trade: float    # 0.02 = 2%
    max_daily_trades: int
    trading_hours: TradingHours | None = None

class RiskGuard:
    def validate(self, signal: LiveSignal) -> tuple[bool, str | None]:
        """주문 전 리스크 검증. (allowed, reason) 반환."""
        ...
```

### 5.6 실행 모드

| 모드 | 설명 | 기본값 |
|------|------|--------|
| dry-run | 시그널 로그만 출력, 주문 미실행 | **기본값** |
| live | MT5 실주문 실행 (RiskGuard 유지) | 명시적 설정 필요 |

서버 시작 시 `--mode dry-run` (기본) 또는 `--mode live`로 설정.

### 5.7 MetaTrader5 참고

- MetaTrader5 Python 패키지는 **Windows 전용** (MT5 터미널 필요)
- macOS/Linux: MetaAPI.cloud REST API를 대안으로 사용 가능 (환경 변수로 백엔드 전환)
- 설정: `executor/.env`에 MT5 계정 정보

### 5.8 디렉터리 구조

```
executor/
├── pyproject.toml
├── .env.example
├── src/
│   └── executor/
│       ├── __init__.py
│       ├── main.py           # FastAPI app + 라우터 등록
│       ├── models.py         # Pydantic 모델 (위 5.4)
│       ├── mt5.py            # MetaTrader5 연동 래퍼
│       ├── risk_guard.py     # RiskGuard 구현
│       ├── config.py         # 설정 로딩 (.env, YAML)
│       └── telegram_bot.py   # Phase 6에서 추가
└── tests/
    ├── test_models.py
    ├── test_risk_guard.py
    ├── test_mt5.py           # Mock 기반
    └── test_api.py           # FastAPI TestClient
```

---

## 6. Phase 6: Telegram Monitoring (Python — executor/ 통합)

### 6.1 목표

Phase 5 FastAPI 서버에 텔레그램 봇을 통합한다. 트레이딩 이벤트를 실시간 알림하고, 봇 커맨드로 상태 조회 및 원격 제어를 제공한다.

### 6.2 기술

- `python-telegram-bot` (또는 `aiogram` 대안)
- FastAPI lifespan에서 봇 시작/종료 관리

### 6.3 알림 기능

| 이벤트 | 알림 내용 |
|--------|----------|
| SIGNAL_GENERATED | 페어, 방향, 진입가, SL, TP, 근거 |
| ORDER_FILLED | 체결가, 볼륨 |
| POSITION_CLOSED | PnL, 사유 |
| RISK_GUARD_BLOCKED | 차단 사유 |
| ERROR | 에러 상세 |
| DAILY_REPORT | 일일 PnL 요약, 거래 수, 드로우다운 |

### 6.4 봇 커맨드

| 커맨드 | 기능 |
|--------|------|
| `/status` | 엔진 상태 (MT5 연결, 모드, 마지막 시그널 시간) |
| `/positions` | 현재 오픈 포지션 목록 |
| `/pnl` | 오늘 PnL 요약 |
| `/closeall` | 전체 포지션 청산 (확인 메시지 후 실행) |

### 6.5 설정

```bash
# executor/.env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 선택: 일일 리포트
DAILY_REPORT_ENABLED=true
DAILY_REPORT_TIME=23:00
DAILY_REPORT_TIMEZONE=Asia/Seoul
```

---

## 7. Phase 7: 데이터 분석 (Python — analysis/)

### 7.1 목표

백테스트 결과와 트레이딩 로그를 체계적으로 분석하고 시각화한다. Jupyter Notebook 기반 인터랙티브 분석 + 자동화 스크립트 제공.

### 7.2 기술

| 영역 | 기술 |
|------|------|
| 데이터 처리 | pandas, numpy |
| 시각화 | matplotlib, plotly |
| 노트북 | Jupyter Lab |
| 패키지 매니저 | uv |

### 7.3 분석 항목

**백테스트 결과 분석:**
- 에쿼티 커브 시각화
- 드로우다운 히트맵
- 승률/수익 분포 히스토그램
- 타임프레임별/페어별 성능 비교

**트레이딩 로그 분석 (Phase 5-6 이후):**
- 실시간 PnL 추적
- 시그널 vs 실제 체결 슬리피지 분석
- RiskGuard 차단 통계

### 7.4 디렉터리 구조

```
analysis/
├── pyproject.toml
├── notebooks/
│   ├── backtest_analysis.ipynb
│   ├── performance_report.ipynb
│   └── signal_review.ipynb
├── scripts/
│   ├── generate_report.py    # CLI 스크립트: python -m scripts.generate_report
│   └── plot_equity.py
└── tests/
    └── test_report.py
```

---

## 8. Phase 8+: Future

기존 prd-v2의 Phase 7+에서 이동. 우선순위 낮음.

- **CCXT 어댑터**: 크립토 데이터 소스
- **ICT 전략 모듈**: Killzone, Liquidity Sweep 등
- **기술적 지표 전략**: RSI + EMA 조합
- **Dockerization**: Dockerfile + docker-compose (TS + Python 통합)
- **GitHub Actions CI/CD**
- **Web Dashboard**: REST API, 차트 시각화, 실시간 WebSocket 피드

---

## 9. 의존성 패키지

### TypeScript (Phase 1-4)

| Phase | 패키지 | 용도 |
|-------|--------|------|
| Phase 1 | `oclif`, `vitest`, `tsup` | CLI, 테스트, 빌드 |
| Phase 4 | `node-cron` | 주기적 분석 파이프라인 실행 |
| Phase 4 | `twelvedata` 또는 `fetch` | TwelveData REST API |

### Python (Phase 5-7)

| Phase | 패키지 | 용도 |
|-------|--------|------|
| Phase 5 | `fastapi`, `uvicorn` | REST API 서버 |
| Phase 5 | `MetaTrader5` | MT5 공식 Python 패키지 |
| Phase 5 | `pydantic` | 데이터 검증 + 직렬화 |
| Phase 5 | `python-dotenv` | 환경 변수 |
| Phase 5 | `pytest`, `httpx` | 테스트 |
| Phase 5 | `mypy`, `ruff` | 타입 체크, 린팅 |
| Phase 6 | `python-telegram-bot` | Telegram Bot API |
| Phase 7 | `pandas`, `numpy` | 데이터 분석 |
| Phase 7 | `matplotlib`, `plotly` | 시각화 |
| Phase 7 | `jupyterlab` | 인터랙티브 분석 |

---

## 10. 로드맵

| Phase | 기간 | 핵심 마일스톤 |
|-------|------|--------------|
| Phase 4: Live Signal | 3주 | TwelveData 어댑터, SignalEngine, HTTP 출력, `trade live` CLI |
| Phase 5: MT5 Execution | 3주 | FastAPI 서버, MetaTrader5 연동, RiskGuard, REST API |
| Phase 6: Telegram | 2주 | 봇 통합, 알림, 커맨드, 일일 리포트 |
| Phase 7: Analysis | 2주 | Jupyter 노트북, 자동 리포트, 시각화 |
| Phase 8+: Future | TBD | CCXT, ICT, Docker, Web Dashboard |

---

## 11. 성공 메트릭

| 메트릭 | 목표 |
|--------|------|
| 시그널 발생 지연 | < 5초 (데이터 fetch ~ 시그널 발생) |
| TS→Python 통신 지연 | < 1초 (HTTP POST ~ 응답) |
| MT5 주문 실행 지연 | < 3초 (시그널 수신 → 주문 체결) |
| RiskGuard 차단 정확도 | 100% (한도 초과 시 반드시 차단) |
| 텔레그램 알림 전달 | < 2초 (이벤트 → 메시지 수신) |
| 드라이런 기본값 | 명시적 플래그 없이 절대 실주문 불가 |
| 일일 리포트 자동 전송 | 설정 시간 +-1분 이내 |

---

## 12. 포트폴리오 기술 스택 요약

| 영역 | TypeScript | Python |
|------|-----------|--------|
| 분석/전략 | SMC Engine, Bias, Strategy | - |
| 백테스트 | Backtest Engine, Risk Metrics | - |
| 시그널 | SignalEngine, LiveSignal | - |
| 실행 | - | FastAPI, MetaTrader5 |
| 모니터링 | - | python-telegram-bot |
| 데이터 분석 | - | pandas, plotly, Jupyter |
| 통신 | HTTP POST (client) | REST API (server) |
