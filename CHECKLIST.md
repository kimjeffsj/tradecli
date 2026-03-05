# CHECKLIST.md — TradeLab CLI 구현 체크리스트

> Phase별 단계적 구현. 각 단계는 TDD로 진행: 테스트 → 구현 → 리팩터링

---

## 진행 로그

| 날짜       | Phase | 작업 내용                                               | 상태 |
| ---------- | ----- | ------------------------------------------------------- | ---- |
| 2026-03-01 | 1.1   | package.json 설정 (ESM, scripts, devDependencies)       | ✅   |
| 2026-03-01 | 1.1   | tsconfig.json (strict mode, ESM, incremental 제거)      | ✅   |
| 2026-03-01 | 1.1   | vitest.config.ts (globals, coverage 80%)                | ✅   |
| 2026-03-01 | 1.1   | .eslintrc.js + .prettierrc                              | ✅   |
| 2026-03-01 | 1.1   | tsup.config.ts (ESM, DTS, sourcemap)                    | ✅   |
| 2026-03-01 | 1.1   | .gitignore                                              | ✅   |
| 2026-03-01 | 1.1   | 디렉터리 구조 생성 (src/, tests/)                       | ✅   |
| 2026-03-01 | 1.1   | src/core/types/ 공유 타입 정의 4종                      | ✅   |
| 2026-03-01 | 1.2   | DataAdapter 인터페이스 + FetchOptions + DataFetchError  | ✅   |
| 2026-03-01 | 1.2   | MockDataAdapter 구현체                                  | ✅   |
| 2026-03-01 | 1.2   | tests/fixtures/helpers.ts (createCandles, createCandle) | ✅   |
| 2026-03-01 | 1.2   | tests/core/data/adapter.test.ts (7 tests passed)        | ✅   |
| 2026-03-03 | 1.3   | CacheEntry, CacheOptions 타입 정의                      | ✅   |
| 2026-03-03 | 1.3   | FileCache 구현 (get/set/clear, TTL, 키 생성)            | ✅   |
| 2026-03-03 | 1.3   | CachedDataAdapter 구현 (DataAdapter 데코레이터)         | ✅   |
| 2026-03-03 | 1.3   | tests/core/data/cache.test.ts (10 tests passed)         | ✅   |
| 2026-03-03 | 1.4   | detectSwingPoints() 구현 (SWING_HIGH/LOW, lookback)     | ✅   |
| 2026-03-03 | 1.4   | tests/core/smc/swing.test.ts (전체 통과)                | ✅   |
| 2026-03-04 | 1.5   | analyzeStructure() 구현 (BOS/CHoCH, direction 추적)    | ✅   |
| 2026-03-04 | 1.5   | tests/core/smc/structure.test.ts (6 tests passed)       | ✅   |
| 2026-03-05 | 1.6   | Oclif 초기 설정 (bin/run.js, bin/dev.js, package.json)  | ✅   |
| 2026-03-05 | 1.6   | analyze 커맨드 구현 (파이프라인 + JSON 출력)            | ✅   |
| 2026-03-05 | 1.6   | tests/core/commands/analyze.test.ts (통합 테스트)       | ✅   |

---

## Phase 1: Foundation (2~3주)

### 1.1 프로젝트 Scaffolding

- [x] pnpm init + package.json 설정
- [x] TypeScript 설정 (tsconfig.json, strict mode)
- [x] Vitest 설정 (vitest.config.ts)
- [x] ESLint + Prettier 설정
- [x] tsup 빌드 설정
- [x] 디렉터리 구조 생성 (src/, tests/, .claude/)
- [ ] Oclif 초기 설정 + 빈 커맨드 확인 → Phase 1.6으로 이동
- [x] 공유 타입 정의 (src/core/types/)
  - [x] Candle, Timeframe
  - [x] SMC 관련 타입 (SwingPoint, StructureBreak, etc.)
  - [x] Strategy, Signal 타입
  - [x] Backtest, Trade, RiskMetrics 타입

### 1.2 데이터 모듈

- [x] DataAdapter 인터페이스 정의
- [x] FetchOptions 타입 정의
- [x] 첫 DataAdapter 구현체 (Mock)
  - [x] fetchCandles() 구현
  - [x] getSupportedPairs() 구현
  - [x] getSupportedTimeframes() 구현
  - [x] API 에러 처리 (DataFetchError)
- [x] 테스트: 어댑터 인터페이스 준수 확인
- [x] 테스트: API 응답 파싱 검증
- [x] 테스트: 에러 시나리오 (network, rate limit)

### 1.3 로컬 캐시

- [x] CacheEntry 타입 정의
- [x] 파일 기반 캐시 구현
  - [x] 캐시 키 생성 (pair:tf:start:end)
  - [x] TTL 기반 만료 처리
  - [x] 캐시 hit/miss 로직
  - [x] 캐시 클리어 기능
- [x] 테스트: 캐시 hit 시나리오
- [x] 테스트: 캐시 miss 시나리오
- [x] 테스트: TTL 만료 시나리오

### 1.4 Swing Detection

- [x] detectSwingPoints() 함수 구현
  - [x] Lookback window 기반 로컬 최대값 탐지 (SWING_HIGH)
  - [x] Lookback window 기반 로컬 최소값 탐지 (SWING_LOW)
  - [x] 설정 가능한 lookback 파라미터 (기본값: 5)
- [x] 테스트: 명확한 swing high 감지
- [x] 테스트: 명확한 swing low 감지
- [x] 테스트: 동일 가격 연속 시 처리
- [x] 테스트: lookback window 변경 시 결과 변화
- [x] 테스트: 데이터 부족 시 빈 배열 반환
- [x] 테스트: 엣지 케이스 (캔들 수 < lookback)

### 1.5 BOS / CHoCH Detection

- [x] analyzeStructure() 함수 구현
  - [x] 이전 swing high 돌파 감지 (close 기준)
  - [x] 이전 swing low 돌파 감지 (close 기준)
  - [x] BOS 판단 (추세 유지 방향 돌파)
  - [x] CHoCH 판단 (추세 변경 방향 돌파)
  - [x] 현재 시장 방향(direction) 상태 추적
- [x] 테스트: 상승 추세에서 BOS 감지 (higher high)
- [x] 테스트: 하락 추세에서 BOS 감지 (lower low)
- [x] 테스트: 상승→하락 CHoCH 감지
- [x] 테스트: 하락→상승 CHoCH 감지
- [x] 테스트: 구조 변경 없는 횡보 구간
- [x] 테스트: 연속 BOS 시 방향 유지 확인

### 1.6 Oclif 설정 + 기본 CLI `analyze` 커맨드

- [x] Oclif 초기 설정 + 빈 커맨드 확인 (1.1에서 이동)
- [x] `trade analyze --pair --tf` 커맨드 구현
  - [x] 페어/타임프레임 인자 파싱
  - [x] 데이터 fetch → swing → structure 파이프라인
  - [x] 결과 JSON 포맷 출력
  - [x] `--output` 옵션 (파일 저장)
- [x] 유효하지 않은 페어/타임프레임 에러 처리
- [x] 테스트: CLI 인자 파싱
- [x] 테스트: 전체 파이프라인 통합 테스트 (mock 데이터)

---

## Phase 2: SMC Complete (2주)

### 2.1 Order Block Detection

- [ ] detectOrderBlocks() 함수 구현
  - [ ] BOS 직전 마지막 반대 캔들 영역 식별
  - [ ] Bullish OB: BOS 직전 마지막 bearish 캔들
  - [ ] Bearish OB: BOS 직전 마지막 bullish 캔들
  - [ ] OB 영역 (high/low price) 계산
  - [ ] 상태 관리: FRESH → TESTED → BROKEN
  - [ ] 재테스트 감지 (가격이 OB 영역 진입)
- [ ] 테스트: Bullish OB 감지
- [ ] 테스트: Bearish OB 감지
- [ ] 테스트: OB 재테스트 시 상태 변경
- [ ] 테스트: OB 돌파 시 BROKEN 처리
- [ ] 테스트: BOS 없으면 OB 생성 안 됨

### 2.2 Fair Value Gap Detection

- [ ] detectFVG() 함수 구현
  - [ ] 3캔들 구조 기반 갭 탐지
  - [ ] Bullish FVG: candle[i-1].high < candle[i+1].low
  - [ ] Bearish FVG: candle[i-1].low > candle[i+1].high
  - [ ] FVG 영역 (high/low) 계산
  - [ ] 갭 메워짐(fill) 비율 추적
  - [ ] 상태 관리: OPEN → PARTIALLY_FILLED → FILLED
- [ ] 테스트: Bullish FVG 감지
- [ ] 테스트: Bearish FVG 감지
- [ ] 테스트: FVG 부분 충전 시 상태 변경
- [ ] 테스트: FVG 완전 충전 시 FILLED
- [ ] 테스트: FVG 없는 구간 (갭 없음)

### 2.3 SMC 통합 분석기

- [ ] SMCAnalyzer 클래스 구현
  - [ ] 캔들 입력 → 전체 SMC 분석 파이프라인
  - [ ] Swing → Structure → OB → FVG 순차 실행
  - [ ] SMCAnalysis 결과 객체 생성
- [ ] 테스트: 전체 파이프라인 통합 테스트
- [ ] 테스트: 실제 시장 데이터 기반 검증 (fixtures)

### 2.4 Bias Engine

- [ ] MultiTimeframeBias 구현
  - [ ] 타임프레임별 SMC 분석 실행
  - [ ] 타임프레임별 가중치 적용 (D1: 0.5, H4: 0.3, H1: 0.2)
  - [ ] 종합 Bias 계산 (LONG / SHORT / NEUTRAL)
  - [ ] Confidence 점수 계산
  - [ ] 가중치 커스터마이징 지원
- [ ] 테스트: 전 타임프레임 동일 방향 → 높은 confidence
- [ ] 테스트: 타임프레임 혼합 → 중간 confidence
- [ ] 테스트: 전 타임프레임 반대 → NEUTRAL
- [ ] 테스트: 커스텀 가중치 적용

### 2.5 JSON 리포트

- [ ] 분석 결과 JSON 직렬화
  - [ ] SMCAnalysis → JSON
  - [ ] Bias → JSON
  - [ ] 날짜 포맷 (ISO 8601)
- [ ] `--output` 옵션으로 파일 저장
- [ ] CLI 포맷 출력 (테이블, 컬러)

### 2.6 CLI `scan` 커맨드

- [ ] `trade scan --pairs --tf` 커맨드 구현
  - [ ] 다중 페어 파싱 (쉼표 구분)
  - [ ] 각 페어별 분석 실행
  - [ ] `--bias-only` 옵션 (Bias만 출력)
  - [ ] 결과 요약 테이블 출력
- [ ] 테스트: 다중 페어 파싱
- [ ] 테스트: 병렬 분석 실행

---

## Phase 3: Strategy & Backtest (3주)

### 3.1 Strategy Interface & Registry

- [ ] Strategy 인터페이스 정의
  - [ ] name, version, description
  - [ ] requiredTimeframes
  - [ ] generateSignals(context)
  - [ ] getDefaultConfig()
- [ ] StrategyRegistry 구현
  - [ ] register()
  - [ ] get()
  - [ ] list()
- [ ] 테스트: 전략 등록/조회
- [ ] 테스트: 중복 등록 에러
- [ ] 테스트: 없는 전략 조회 시 undefined

### 3.2 SMC Strategy 모듈

- [ ] SMCStrategy 구현 (Strategy 인터페이스 준수)
  - [ ] OB 리테스트 기반 진입 시그널
  - [ ] FVG 기반 진입 시그널
  - [ ] Bias 방향 일치 필터
  - [ ] SL: 구조적 위치 기반 (이전 swing)
  - [ ] TP: RRR 기반 계산
  - [ ] Signal.reason에 진입 근거 기록
- [ ] 테스트: OB 리테스트 시그널 생성
- [ ] 테스트: FVG 시그널 생성
- [ ] 테스트: Bias 불일치 시 시그널 필터링
- [ ] 테스트: SL/TP 계산 정확성

### 3.3 Backtest Engine

- [ ] BacktestEngine 구현
  - [ ] 시그널 기반 트레이드 시뮬레이션
  - [ ] SL 도달 시 청산
  - [ ] TP 도달 시 청산
  - [ ] 동시 포지션 제한 (기본: 1)
  - [ ] 캔들별 순차 시뮬레이션 (look-ahead bias 방지)
  - [ ] 슬리피지/수수료 적용
- [ ] 테스트: 기본 Long 트레이드 (TP 도달)
- [ ] 테스트: 기본 Short 트레이드 (SL 도달)
- [ ] 테스트: 데이터 종료 시 포지션 청산
- [ ] 테스트: 슬리피지 적용 확인
- [ ] 테스트: look-ahead bias 방지 확인

### 3.4 Position Sizer

- [ ] PositionSizer 구현
  - [ ] FIXED_PERCENT 방식
  - [ ] KELLY 방식
  - [ ] 잔고 기반 사이징 계산
- [ ] 테스트: 고정 % 사이징 계산
- [ ] 테스트: Kelly Criterion 사이징 계산
- [ ] 테스트: 잔고 변동 시 사이징 업데이트

### 3.5 Equity Tracker

- [ ] EquityTracker 구현
  - [ ] 매 트레이드 후 잔고 기록
  - [ ] 에쿼티 커브 생성
  - [ ] Drawdown 계산 (현재, 최대)
- [ ] 테스트: 에쿼티 커브 정확성
- [ ] 테스트: Drawdown 계산

### 3.6 Risk Module

- [ ] Sharpe Ratio 계산
  - [ ] 일별 수익률 기반
  - [ ] 무위험 수익률 설정 가능
- [ ] Sortino Ratio 계산
  - [ ] 하방 편차만 사용
- [ ] Value at Risk (VaR) 계산
  - [ ] Historical Simulation 방식
  - [ ] 95%, 99% 신뢰구간
- [ ] Max Drawdown + Duration
- [ ] Calmar Ratio
- [ ] 통합 RiskCalculator
  - [ ] 모든 메트릭 한번에 계산
  - [ ] RiskMetrics 객체 반환
- [ ] 테스트: Sharpe Ratio (알려진 데이터셋으로 검증)
- [ ] 테스트: Sortino Ratio
- [ ] 테스트: VaR 계산
- [ ] 테스트: Drawdown 계산
- [ ] 테스트: 전체 메트릭 통합 테스트

### 3.7 Backtest Result 조립

- [ ] BacktestResult 조립 로직
  - [ ] 기본 통계 (승률, PF, expectancy, RRR)
  - [ ] 연속 승/패 기록
  - [ ] RiskMetrics 통합
  - [ ] 에쿼티 커브 포함
  - [ ] 실행 시간 측정
- [ ] JSON 리포트 출력
- [ ] 테스트: 전체 백테스트 결과 통합 테스트

### 3.8 CLI `backtest` + `strategy` 커맨드

- [ ] `trade backtest` 커맨드 구현
  - [ ] --pair, --tf, --strategy 인자
  - [ ] --sl, --tp 옵션 (pips)
  - [ ] --risk 옵션 (% 리스크)
  - [ ] --sizing 옵션 (fixed / kelly)
  - [ ] 결과 테이블 + JSON 출력
- [ ] `trade strategy list` 커맨드 구현
- [ ] `trade strategy info <name>` 커맨드 구현
- [ ] 테스트: CLI 인자 파싱
- [ ] 테스트: 전체 백테스트 파이프라인 통합 테스트

---

## Phase 4: Extension (선택)

### 4.1 추가 데이터 어댑터

- [ ] CCXT 어댑터 (크립토)
- [ ] 어댑터 선택 CLI 옵션 (--source)

### 4.2 추가 전략

- [ ] ICT 전략 모듈 (Killzone, Liquidity Sweep 등)
- [ ] 기술적 지표 전략 (RSI + EMA)

### 4.3 인프라

- [ ] Dockerfile + docker-compose
- [ ] GitHub Actions CI/CD
- [ ] npm 패키지 배포

### 4.4 Web Dashboard (별도 프로젝트)

- [ ] REST API 레이어
- [ ] 차트 시각화
- [ ] 실시간 WebSocket 피드

---

## 진행 규칙

1. **순서대로 진행**: Phase 1 완료 → Phase 2 시작
2. **TDD**: 각 단계에서 테스트 먼저 작성
3. **체크 표시**: 완료된 항목은 `[x]`로 업데이트
4. **블로커**: 막히면 CLAUDE.md의 주의사항 참고
5. **리팩터링**: 각 Phase 끝에 코드 정리
