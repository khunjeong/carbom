# 차봄(ChaBom) — Claude Code 컨텍스트

AI Agent 기반 중고차 매물 비교 중계 플랫폼.
여러 중고차 플랫폼(엔카, KB차차차, 헤이딜러 등)의 매물을 AI가 실시간으로 비교하고,
자연어 입력 하나로 최적 매물을 자동 추천해주는 사이드 프로젝트.

---

## 핵심 차별화

- 자연어 입력 → AI가 5+ 플랫폼 동시 스캔 → 조건 맞는 매물 TOP5 제시
- 기존 플랫폼은 자사 매물만 노출. 차봄은 플랫폼 중립적 비교
- 성능점검 · 사고이력 · 리스/렌트 이력까지 통합 제공

---

## 기술 스택

### 모노레포
- **Turborepo** + **pnpm workspace**

### 앱 구조
```
chabom/
├── apps/
│   └── web/                  # Next.js 15 (메인 앱)
└── packages/
    ├── ui/                   # 공유 컴포넌트 (shadcn/ui 기반)
    ├── db/                   # Prisma 스키마 + 클라이언트
    ├── ai/                   # AI Agent 로직
    ├── api-clients/          # 외부 API 래퍼 (엔카 등)
    ├── config/               # ESLint, TypeScript, Tailwind 공유 설정
    └── types/                # 공유 TypeScript 타입
```

### 프론트엔드
- **Next.js 15** (App Router, RSC 우선)
- **TypeScript** (strict mode)
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query** (서버 상태)
- **Zustand** (클라이언트 UI 상태)
- **nuqs** (URL 쿼리 파라미터 상태)
- **React Hook Form** + **Zod** (폼/검증)

### AI Agent
- **Vercel AI SDK** (`ai` 패키지) — 스트리밍 우선
- **Claude claude-sonnet-4-6** (메인: 복잡한 추론, Tool 다중 호출)
- **Gemini 1.5 Flash** (무료 티어: 단순 파싱, 폴백)
- 듀얼 모델 자동 폴백: Claude 장애/Rate Limit 시 Gemini로 전환

### API 레이어
- **tRPC** (타입 안전 CRUD API)
- **SSE Stream** (`/api/ai/search`) — AI 응답 스트리밍

### 데이터베이스
- **Supabase** (PostgreSQL + Auth) — 무료 티어
  - Connection Pooler 포트 6543 사용 (Vercel Serverless 필수)
  - DIRECT_URL 포트 5432 (마이그레이션 전용)
- **Prisma** (ORM)

### 캐싱
- **Upstash Redis** — HTTP 기반, 무료 티어 (10,000 req/일)
- `@upstash/redis` 패키지 사용 (ioredis 아님)
- 매물 캐싱 TTL: 5분

### 배포 & 인프라 (전부 무료 티어)
- **Vercel Hobby** — Next.js 앱 배포
- **Vercel Cron** — 가격 알림(매시간), DB 정리(매일 새벽 3시)
- **Supabase Free** — DB 500MB, Auth 50K MAU
- **Upstash Free** — Redis 10,000 req/일, 256MB

---

## AI Agent 아키텍처

```
POST /api/ai/search
       │
       ▼
Orchestrator Agent (Claude claude-sonnet-4-6)
       │ tool_use
       ├── parseQuery Tool      → Gemini Flash (자연어 → CarSearchParams)
       ├── searchEncar Tool     → 엔카 API
       ├── searchKB Tool        → KB차차차 API
       └── searchHeydealer Tool → 헤이딜러 API
       │ tool_result
       ▼
결과 집계 → 중복 제거 → TOP5 랭킹 → SSE Stream → Client
```

### 폴백 전략
```
Claude API 호출
  └─ 성공 → 정상 응답
  └─ 실패 (429/529/5xx) → Gemini 1.5 Flash 폴백
```

### Tool 비용 최적화
- 단순 파싱(`parseQuery`) → Gemini Flash (무료)
- 복잡한 추론(집계, 랭킹) → Claude
- 각 Tool 결과는 Redis에 캐싱 (5분 TTL)

---

## DB 스키마 핵심 테이블

```
User
  ├── SearchHistory (자연어 쿼리 + 파싱 파라미터)
  │     └── SearchResult (TOP 5만 저장, 30일 후 삭제)
  ├── Bookmark
  └── PriceAlert
        └── AlertLog
```

### 데이터 용량 관리 (Supabase 500MB 한도)
- SearchResult: TOP 5만 저장, 30일 후 자동 삭제
- SearchHistory: 90일 후 삭제
- Cron이 매일 새벽 3시에 정리

---

## 런타임 분리 원칙

| 레이어 | 런타임 | 이유 |
|--------|--------|------|
| Middleware (인증/Rate Limit) | Edge | 전 세계 저지연 |
| tRPC API Routes | Node.js | Prisma Edge 미지원 |
| AI Agent Pipeline | Node.js | 스트리밍, 장기 실행 |

---

## 환경 변수

```bash
# AI
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # 서버 전용, 절대 클라이언트 노출 금지
DATABASE_URL=postgresql://...           # Pooler 포트 6543
DIRECT_URL=postgresql://...             # Direct 포트 5432 (마이그레이션 전용)

# Upstash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=AX...

# 중고차 플랫폼 API
ENCAR_API_KEY=...
KB_API_KEY=...
HEYDEALER_API_KEY=...

# Cron 보안
CRON_SECRET=랜덤_긴_문자열
```

---

## 외부 API 연동

### 중고차 플랫폼
- 엔카 Open API
- KB차차차 API
- 헤이딜러 API
- 보배드림 API

### 공통
- 모든 플랫폼 결과를 `NormalizedCar` 타입으로 변환
- `Promise.allSettled`로 병렬 호출 (개별 실패가 전체를 죽이지 않음)
- 결과 Redis 캐싱 (5분 TTL)

---

## 핵심 타입

```ts
NormalizedCar      // 중고차 매물 정규화 타입
CarSearchParams    // 자연어 파싱 결과
SearchResult       // TOP5 매물 결과
RankedCar          // 랭킹 + AI 요약 포함 매물
```

---

## 코드 컨벤션

- **TypeScript strict mode** 필수
- **Zod**로 모든 외부 입력 검증 (API 요청, Tool 파라미터, 환경 변수)
- **절대 경로** import (`@/`, `@tripagent/패키지명`)
- 컴포넌트: RSC 기본, 인터랙션 필요한 경우만 `'use client'`
- 에러 처리: Tool execute는 반드시 try/catch + 의미 있는 fallback
- 환경 변수: `NEXT_PUBLIC_` 접두사 없는 변수는 서버 전용

---

## 개발 명령어

```bash
pnpm install           # 의존성 설치
pnpm dev               # 전체 개발 서버 (Turborepo 병렬)
pnpm build             # 전체 빌드
pnpm type-check        # 타입 검사
pnpm lint              # 린트
pnpm db:generate       # Prisma 클라이언트 생성
pnpm db:migrate        # DB 마이그레이션
pnpm db:studio         # Prisma Studio
```

---

## MVP 개발 순서

1. ✅ 모노레포 초기 세팅 (Turborepo + pnpm)
2. ✅ `packages/db` — Prisma 스키마 + Supabase 연결
3. ✅ Supabase Auth 설정 (Google OAuth)
4. `packages/api-clients` — 엔카 클라이언트 + 정규화 타입
5. `packages/ai` — parseQuery Tool (Gemini) + searchCar Tool
6. `/api/ai/search` — SSE 스트리밍 Route + 클라이언트 훅
7. 검색 UI — 입력창 → 매물 카드
8. 관심 매물 + 가격 알림
9. Vercel 배포

---

## 업그레이드 트리거 (무료 → 유료)

| 서비스 | 트리거 | 비용 |
|--------|--------|------|
| Supabase | DB 400MB 또는 MAU 4만 | Pro $25/월 |
| Upstash | 일 req 8,000 초과 | Pay-per-use |
| Vercel | 월 대역폭 80GB 초과 | Pro $20/월 |
