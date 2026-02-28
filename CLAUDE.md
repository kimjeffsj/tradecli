# CLAUDE.md — TradeLab CLI

> Claude Code를 위한 프로젝트 컨텍스트 문서

---

## 프로젝트 개요

TradeLab CLI는 SMC(Smart Money Concepts) 기반 전략 연구 플랫폼이다. CLI-first 아키텍처로, 향후 Web Dashboard 확장을 전제로 설계한다.

**핵심 철학:**
- SMC는 "특별한 기능"이 아니라 "전략 중 하나"다
- CLI는 인터페이스일 뿐이다 — Core Engine은 CLI 없이도 동작해야 한다
- 데이터 → 전략 → 백테스트는 완전 분리되어야 한다
- 데이터 소스는 어댑터 패턴으로 교체 가능해야 한다

---

## Tech Stack

| 영역 | 기술 | 비고 |
|------|------|------|
| 언어 | TypeScript 5.x | strict mode 필수 |
| 런타임 | Node.js 20+ | LTS |
| CLI | Oclif | 커맨드 프레임워크 |
| 테스트 | Vitest | 유닛 + 통합 |
| 패키지 매니저 | pnpm | workspace 불필요 (단일 패키지) |
| 린팅 | ESLint flat config + Prettier | |
| 빌드 | tsup | 번들링 |

---

## 프로젝트 구조

```
tradelab-cli/
├── CLAUDE.md
├── CHECKLIST.md
├── prd.md
├── erd.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.js
├── .prettierrc
├── src/
│   ├── index.ts                    # Oclif entry
│   ├── commands/                   # CLI 커맨드 (Oclif)
│   │   ├── analyze.ts
│   │   ├── backtest.ts
│   │   ├── scan.ts
│   │   └── strategy/
│   │       ├── list.ts
│   │       └── info.ts
│   ├── core/                       # Core Engine (CLI 독립)
│   │   ├── types/                  # 공유 타입 정의
│   │   │   ├── candle.ts
│   │   │   ├── smc.ts
│   │   │   ├── strategy.ts
│   │   │   ├── backtest.ts
│   │   │   └── index.ts
│   │   ├── data/                   # 데이터 수집 모듈
│   │   │   ├── adapter.ts          # DataAdapter 인터페이스
│   │   │   ├── adapters/
│   │   │   │   └── twelve-data.ts  # (또는 다른 첫 구현체)
│   │   │   └── cache.ts            # 로컬 캐시
│   │   ├── smc/                    # SMC 분석 엔진
│   │   │   ├── swing.ts            # Swing Detection
│   │   │   ├── structure.ts        # BOS / CHoCH
│   │   │   ├── order-block.ts      # Order Block
│   │   │   ├── fvg.ts              # Fair Value Gap
│   │   │   └── analyzer.ts         # SMC 통합 분석기
│   │   ├── bias/                   # Bias Engine
│   │   │   └── multi-timeframe.ts
│   │   ├── strategy/               # Strategy Engine
│   │   │   ├── interface.ts        # Strategy 인터페이스
│   │   │   ├── registry.ts         # Strategy Registry
│   │   │   └── strategies/
│   │   │       └── smc-strategy.ts
│   │   ├── backtest/               # Backtest Engine
│   │   │   ├── engine.ts           # 백테스트 실행기
│   │   │   ├── position-sizer.ts   # 포지션 사이징
│   │   │   └── equity-tracker.ts   # 에쿼티 추적
│   │   └── risk/                   # Risk Module
│   │       ├── sharpe.ts
│   │       ├── sortino.ts
│   │       ├── var.ts
│   │       ├── drawdown.ts
│   │       └── calculator.ts       # 통합 리스크 계산기
│   ├── utils/                      # 유틸리티
│   │   ├── id.ts                   # ID 생성
│   │   ├── math.ts                 # 수학 헬퍼
│   │   └── format.ts              # CLI 포맷팅
│   └── config/                     # 설정
│       └── defaults.ts
├── tests/
│   ├── fixtures/                   # 테스트용 캔들 데이터
│   │   ├── xauusd-h4.json
│   │   └── helpers.ts              # 테스트 헬퍼 (캔들 생성 등)
│   ├── core/
│   │   ├── smc/
│   │   │   ├── swing.test.ts
│   │   │   ├── structure.test.ts
│   │   │   ├── order-block.test.ts
│   │   │   └── fvg.test.ts
│   │   ├── bias/
│   │   │   └── multi-timeframe.test.ts
│   │   ├── backtest/
│   │   │   └── engine.test.ts
│   │   └── risk/
│   │       ├── sharpe.test.ts
│   │       ├── sortino.test.ts
│   │       └── var.test.ts
│   └── integration/
│       └── analyze-pipeline.test.ts
└── .claude/
    └── skills/
        ├── smc-concepts.md
        └── risk-metrics.md
```

---

## 주요 커맨드

```bash
# 개발
pnpm dev                  # ts-node로 직접 실행
pnpm build                # tsup 빌드
pnpm lint                 # ESLint
pnpm format               # Prettier

# 테스트
pnpm test                 # Vitest 전체 실행
pnpm test:watch           # Watch 모드
pnpm test:coverage        # 커버리지 리포트
pnpm test -- --grep "swing" # 특정 테스트만

# CLI (개발 중)
pnpm dev -- analyze --pair XAUUSD --tf H4
pnpm dev -- backtest --pair XAUUSD --tf H1 --strategy smc
```

---

## 코딩 컨벤션

### TypeScript

- **strict mode** 필수 (`"strict": true`)
- `any` 사용 금지 — `unknown` + 타입 가드 사용
- 인터페이스 우선 (type alias 대신)
- Barrel exports (`index.ts`) 사용
- 함수형 스타일 우선, 클래스는 상태가 필요할 때만

### 네이밍

| 대상 | 컨벤션 | 예시 |
|------|--------|------|
| 파일 | kebab-case | `order-block.ts` |
| 인터페이스 | PascalCase | `OrderBlock` |
| 타입 | PascalCase | `MarketDirection` |
| 함수 | camelCase | `detectSwingPoints()` |
| 상수 | UPPER_SNAKE | `DEFAULT_LOOKBACK` |
| Enum-like | UPPER_SNAKE (union) | `'SWING_HIGH' \| 'SWING_LOW'` |

### 테스트

- **TDD 원칙**: 테스트 먼저, 구현 후
- 파일명: `*.test.ts`
- 테스트 구조: `describe` → `it` (Given-When-Then)
- 테스트 픽스처: `tests/fixtures/` 에 JSON 데이터
- 핵심 엔진 커버리지 목표: 80% 이상

```typescript
// 테스트 예시
describe('SwingDetector', () => {
  describe('detect()', () => {
    it('should identify swing high when price is highest in lookback window', () => {
      // Given
      const candles = createCandles([100, 105, 110, 108, 103]);
      // When
      const swings = detectSwingPoints(candles, { lookback: 2 });
      // Then
      expect(swings).toHaveLength(1);
      expect(swings[0].type).toBe('SWING_HIGH');
      expect(swings[0].price).toBe(110);
    });
  });
});
```

### 에러 처리

- 커스텀 에러 클래스 사용 (`TradeLabError`, `DataFetchError` 등)
- 절대 에러를 삼키지 않는다
- CLI 레이어에서 사용자 친화적 메시지로 변환

### 코드 구조 원칙

- **Core Engine은 CLI를 import하지 않는다** (역방향 의존 금지)
- **각 모듈은 인터페이스를 통해 소통한다** (직접 의존 최소화)
- **순수 함수 우선** — 부수 효과는 가능한 경계(boundary)에서만

---

## 구현 시 주의사항

### SMC 로직

- Swing Detection에서 lookback window는 설정 가능해야 함 (기본 5)
- BOS/CHoCH 판단 시 close 가격 기준 (wick 아님)
- Order Block은 BOS가 확인된 후에만 유효
- FVG는 방향성을 반드시 포함 (BULLISH/BEARISH)

### 데이터

- 캔들 데이터는 항상 timestamp 오름차순 정렬
- 빈 캔들(volume=0) 처리 로직 필요
- API 호출 실패 시 캐시 폴백
- Rate limit 대응 (exponential backoff)

### 백테스트

- 미래 데이터 참조 금지 (look-ahead bias 방지)
- 슬리피지/수수료 기본값 설정
- 에쿼티 커브는 매 트레이드 후 기록
- VaR 계산은 historical simulation 방식

---

## 개발 워크플로우

1. **CHECKLIST.md** 에서 현재 Phase/단계 확인
2. 해당 단계의 테스트 먼저 작성
3. 테스트 통과하는 최소 구현
4. 구현한 내용을 `.claude/docs/implementation/{YYYY-MM-DD}-{제목}.md` 에 기록
5. 문제 해결 시 `.claude/docs/troubleshoot/{YYYY-MM-DD}-{제목}.md` 에 기록
6. 리팩터링
7. CHECKLIST.md 체크 표시 업데이트
8. 다음 단계로 이동

---

## 참고 문서

| 문서 | 설명 |
|------|------|
| `prd.md` | 제품 요구사항 정의서 |
| `erd.md` | 데이터 모델 및 관계 |
| `CHECKLIST.md` | 구현 체크리스트 (Phase별) |
| `.claude/skills/smc-concepts.md` | SMC 개념 레퍼런스 |
| `.claude/skills/risk-metrics.md` | 리스크 메트릭 계산 레퍼런스 |
| `.claude/docs/_TEMPLATE.md` | 구현 템플릿 |
| `.claude/docs/_TEMPLATE.md` | 트러블슈팅 템플릿 |
