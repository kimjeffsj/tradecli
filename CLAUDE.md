# CLAUDE.md — TradeLab CLI

> Claude Code를 위한 프로젝트 컨텍스트 문서

---

## 프로젝트 개요

TradeLab CLI는 SMC(Smart Money Concepts) 기반 전략 연구 플랫폼이다.
Phase 1-3(분석 + 백테스트)을 기반으로, **실시간 시그널 생성 → MT5 자동매매 → 텔레그램 모니터링**까지 확장한다.

**핵심 철학:**
- CLI는 인터페이스일 뿐 — Core Engine은 CLI 없이도 동작해야 한다
- 데이터 → 전략 → 백테스트 → 실행은 완전 분리
- 데이터 소스/실행 엔진/알림 채널은 어댑터 패턴으로 교체 가능

---

## Tech Stack

| 영역 | 기술 |
|------|------|
| 언어 | TypeScript 5.x (strict mode 필수) |
| CLI | Oclif |
| 테스트 | Vitest |
| 패키지 매니저 | pnpm |
| 빌드 | tsup (ESM) |
| 린팅 | ESLint + Prettier |

---

## 핵심 아키텍처 원칙

- **Core Engine은 CLI를 import하지 않는다** (역방향 의존 금지)
- **각 모듈은 인터페이스를 통해 소통한다**
- **순수 함수 우선** — 부수 효과는 경계(boundary)에서만
- **실행(Execution)은 드라이런이 기본값** — 명시적 플래그 없이 실주문 불가
- **모든 주문은 리스크 한도 검증을 통과해야 한다** (RiskGuard)
- `any` 금지 — `unknown` + 타입 가드 사용
- 함수형 스타일 우선, 클래스는 상태가 필요할 때만

---

## 프로젝트 구조 (핵심)

```
src/
├── index.ts                  # CLI 진입점
├── commands/                 # Oclif 커맨드 (analyze, backtest, scan)
└── core/                     # Core Engine (CLI 독립)
    ├── types/                # 공유 타입 (Candle, SMC, Strategy, Backtest)
    ├── data/                 # DataAdapter 인터페이스 + 구현체
    ├── smc/                  # Swing, Structure, OB, FVG, Analyzer
    ├── bias/                 # Multi-timeframe Bias Engine
    ├── strategy/             # Strategy 인터페이스 + Registry
    ├── backtest/             # Backtest Engine + PositionSizer
    ├── risk/                 # Sharpe, Sortino, VaR, Drawdown
    ├── signal/               # Live Signal Engine (Phase 4)
    ├── execution/            # ExecutionAdapter + MetaAPI (Phase 5)
    └── notification/         # NotificationAdapter + Telegram (Phase 6)
tests/
├── fixtures/                 # 테스트용 캔들 데이터 + helpers.ts
└── core/                     # 유닛 테스트 (smc, bias, backtest, risk)
```

---

## 주요 커맨드

```bash
pnpm build          # tsup 빌드
pnpm test           # Vitest 전체
pnpm test:watch     # Watch 모드
pnpm test:coverage  # 커버리지 (목표 80%)
pnpm lint           # ESLint
pnpm format         # Prettier
```

---

## 개발 워크플로우

1. **CHECKLIST.md** 에서 현재 단계 확인
2. 테스트 먼저 작성 (TDD)
3. 테스트 통과하는 최소 구현
4. `pnpm test` 확인
5. CHECKLIST.md 진행 로그 업데이트
6. 커밋 메시지 추천
7. 다음 단계

---

## Claude 협업 방식

- **설명 우선**: 코드 각 줄/블록에 "왜"를 주석으로 설명
- **직접 타이핑**: 코드는 사용자가 직접 타이핑 — Claude는 소스 파일을 직접 수정하지 않는다
- **이해 기반 진행**: 복사/붙여넣기가 아닌 이해하며 작성

### 단계별 진행 형식

```
1. 무엇을 만드는지 한 줄 설명
2. 코드 (각 줄에 이유 주석 포함)
3. 확인 커맨드 (pnpm build / pnpm test)
4. CHECKLIST.md 진행 로그 업데이트
5. 커밋 메시지 추천
```

### 커밋 메시지

```
<type>(<scope>): <요약>
```

| type | 시점 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `chore` | 빌드/설정 |
| `test` | 테스트 |
| `refactor` | 동작 변경 없는 개선 |
| `docs` | 문서 |

---

## 참고 문서

| 문서 | 설명 |
|------|------|
| `prd.md` | 제품 요구사항 (Phase 1-3) |
| `prd-v2.md` | 확장 기획서 (Phase 4-6: Signal, Execution, Notification) |
| `erd.md` | 데이터 모델 |
| `CHECKLIST.md` | Phase별 구현 체크리스트 + 진행 로그 |
| `.claude/skills/conventions.md` | 네이밍·테스트·주석·에러 처리 패턴 |
| `.claude/skills/smc-concepts.md` | SMC 개념 레퍼런스 |
| `.claude/skills/risk-metrics.md` | 리스크 메트릭 계산 레퍼런스 |
