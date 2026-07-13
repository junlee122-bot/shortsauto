# ShortsAuto

아이디어 발굴부터 대본, 장면 구성, 검수, 예약 발행까지 YouTube Shorts 제작 흐름을 한곳에서 운영하기 위한 자동화 콘솔입니다. 현재 버전은 완성도 높은 **데모 대시보드**와 선택적으로 AI Gateway를 사용하는 **AI 기획 생성 엔드포인트**를 제공합니다. Google OAuth, 실제 YouTube 업로드, 영속 데이터베이스, 외부 미디어 worker는 운영 아키텍처가 설계되어 있으며 다음 구현 단계에 포함됩니다.

> 기본 원칙: AI가 초안을 빠르게 만들되, 저작권·사실성·브랜드 안전·공개 발행은 사람이 통제합니다. 프로덕션에서도 기본 공개 범위는 `private`이며 명시적인 승인 없이 자동 공개하지 않습니다.

## 무엇을 제공하나요?

- 채널 성과, 최근 콘텐츠, 작업량을 한눈에 보는 운영 대시보드
- 아이디어 → 대본 → 렌더 → 검수 → 예약 → 게시 상태를 보여주는 제작 파이프라인
- 제목·훅·대본·장면 구성·해시태그를 생성하는 구조화된 AI 기획 흐름
- 예약 캘린더, 검수 큐, 오류·재시도 상태를 포함한 운영 중심 UI
- 데모 데이터만으로 즉시 체험할 수 있는 안전한 로컬 모드
- AI Gateway 모델을 환경 변수로 교체할 수 있는 공급자 독립형 구성
- 장기 실행 렌더링과 업로드를 웹 요청에서 분리하는 production-ready 설계
- 실험, 평가, canary, 즉시 rollback을 전제로 한 self-improvement 운영 모델

## 현재 범위

| 영역 | 상태 | 설명 |
| --- | --- | --- |
| 운영 대시보드 | 제공 | 데모 채널·콘텐츠·파이프라인·일정 데이터로 전체 UX를 확인할 수 있습니다. |
| AI 기획 생성 | 제공 | AI Gateway 인증이 있으면 실제 모델을, 없으면 결정론적 데모 응답을 사용합니다. |
| 데모 모드 | 제공 | 외부 서비스나 실제 채널을 변경하지 않습니다. |
| Google OAuth / YouTube 업로드 | 준비 항목 | 운영 설계와 환경 변수 계약만 정의되어 있습니다. |
| DB / Object Storage / Queue | 준비 항목 | 영속화 및 장기 미디어 처리 단계에서 연결합니다. |
| 외부 media worker | 준비 항목 | FFmpeg 렌더링, TTS, 자막 합성, resumable upload를 담당하도록 설계했습니다. |
| 성과 기반 self-improvement | 준비 항목 | analytics 수집 후 실험 레지스트리와 안전한 승격/rollback으로 구현합니다. |

## 빠른 시작

요구 사항은 Node.js 20 이상과 pnpm입니다.

```bash
git clone https://github.com/junlee122-bot/shortsauto.git
cd shortsauto
corepack enable
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

macOS/Linux에서는 환경 파일 복사 명령만 `cp .env.example .env.local`로 바꾸면 됩니다. 브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

기본값은 `SHORTSAUTO_DEMO_MODE=true`입니다. API 키와 Google 자격 증명이 없어도 UI와 생성 흐름을 안전하게 살펴볼 수 있습니다. 환경 변수를 바꿨다면 개발 서버를 다시 시작하세요.

## 스크립트

```bash
pnpm dev        # 로컬 개발 서버
pnpm build      # 프로덕션 빌드 검증
pnpm start      # 빌드 결과 실행
pnpm lint       # ESLint 검사
pnpm typecheck  # TypeScript 검사
pnpm test       # Node 기반 단위 테스트
```

배포 전 최소 검증 기준은 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`입니다.

## 데모 모드

데모 모드는 제품 탐색과 UI 리뷰를 위한 기본 실행 방식입니다.

```dotenv
SHORTSAUTO_DEMO_MODE=true
```

데모 모드에서는 다음 안전장치를 유지합니다.

- 샘플 채널과 콘텐츠 데이터만 사용합니다.
- YouTube 채널에 연결하거나 외부에 영상을 게시하지 않습니다.
- AI 자격 증명이 없을 때는 재현 가능한 샘플 기획을 반환합니다.
- `DATABASE_URL`, Storage, worker 설정이 없어도 앱을 실행할 수 있습니다.
- 공개 발행을 흉내 내는 UI 동작은 로컬 상태 표현일 뿐 실제 부작용이 없습니다.

데모 모드를 끄는 것만으로 운영 연동이 활성화되지는 않습니다. OAuth, DB, Storage, Queue, worker, 감사 로그와 승인 정책을 모두 연결한 뒤 staging에서 검증해야 합니다.

## AI Gateway 선택 설정

AI 기능은 선택 사항입니다. 인증이 없으면 앱의 데모 fallback을 사용합니다. 실제 생성 결과를 사용하려면 `.env.local`에 다음 중 하나를 설정합니다.

### 정적 키

```dotenv
AI_GATEWAY_API_KEY=your_gateway_key
AI_MODEL=openai/gpt-5.4
```

### Vercel OIDC

Vercel에 연결된 개발 환경에서는 짧은 수명의 OIDC 토큰을 사용할 수 있습니다.

```bash
vercel link
vercel env pull .env.local
```

이 방식은 `VERCEL_OIDC_TOKEN`을 제공합니다. 토큰은 만료될 수 있으므로 로컬 인증 오류가 나면 `vercel env pull .env.local --yes`로 갱신하세요. 배포 환경에서는 Vercel이 OIDC를 관리합니다.

`AI_MODEL`은 반드시 현재 AI Gateway에서 제공하는 `provider/model` 형식의 ID여야 합니다. 모델 목록과 가격·기능은 변경될 수 있으므로 배포 전에 [AI Gateway 모델 목록](https://vercel.com/docs/ai-gateway/models-and-providers)을 확인하세요. 운영 환경에서는 요청에 기능·환경·작업 ID 태그를 붙이고, 월 예산과 rate limit, 모델 fallback을 Gateway에서 설정하는 것을 권장합니다.

인증 방식과 BYOK에 대한 최신 내용은 [Vercel AI Gateway 인증 문서](https://vercel.com/docs/ai-gateway/authentication-and-byok)를 참고하세요.

## YouTube 연결 및 업로드 정책

이 저장소의 현재 버전은 실제 OAuth와 업로드를 수행하지 않습니다. 다음 항목은 운영 연동 시 반드시 지켜야 하는 계약입니다.

### OAuth 설정

1. Google Cloud 프로젝트에서 YouTube Data API v3를 활성화합니다.
2. OAuth 동의 화면과 Web application client를 생성합니다.
3. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`를 서버 환경 변수로 설정합니다.
4. 최소 권한인 `https://www.googleapis.com/auth/youtube.upload`부터 요청합니다.
5. 백그라운드 예약 업로드가 필요하면 `access_type=offline`을 사용하고, refresh token은 암호화해 서버 측에만 저장합니다.
6. OAuth `state`를 일회성으로 검증하고 redirect URI를 Google Console의 값과 정확히 일치시킵니다.

비밀번호, access token, refresh token, client secret은 브라우저 저장소·클라이언트 번들·로그에 남기지 않습니다. 사용자가 채널 연결을 해제하면 저장된 토큰을 폐기하고 Google 측 grant도 revoke할 수 있어야 합니다. 자세한 흐름은 [YouTube 서버측 OAuth 가이드](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)를 따릅니다.

### 업로드 안전장치

- 업로드 기본값은 항상 `private`입니다. `unlisted` 또는 `public` 전환은 검수 승인과 정책 검사를 통과한 별도 명령으로 처리합니다.
- 네트워크 중단을 견디도록 `videos.insert`의 resumable upload를 사용하고 같은 작업의 중복 업로드를 idempotency key로 차단합니다.
- 예약 공개는 비공개 영상에 `status.publishAt`을 설정하는 YouTube 규칙을 따릅니다.
- 아동용 콘텐츠 여부, 현실적인 altered/synthetic media 여부, 카테고리, 라이선스 등 필수 선언을 게시 전 확인합니다.
- 저작권이 불명확한 영상·음원·인물 이미지, 오도성 메타데이터, 반복적 스팸 콘텐츠는 자동 게시 대상에서 제외합니다.
- 업로드 전에 사람이 최종 영상, 자막, 제목, 설명, 공개 범위를 확인할 수 있어야 합니다.

2020년 7월 28일 이후 생성된 **감사받지 않은 API 프로젝트**의 `videos.insert` 업로드는 private로 제한됩니다. 공개 업로드가 필요하면 YouTube API Services 감사 절차를 완료해야 합니다. 최신 제한은 [`videos.insert` 공식 문서](https://developers.google.com/youtube/v3/docs/videos/insert)에서 확인하세요.

2026년 6월부터 `videos.insert`는 별도의 granular quota bucket을 사용하며 기본 한도는 일 100회, 호출당 1 unit입니다. 이 정책은 변경될 수 있으므로 운영 용량을 결정할 때 [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)를 다시 확인하고, 403 `quotaExceeded`와 채널별 업로드 제한을 정상적인 지연 상태로 처리해야 합니다.

## 운영 아키텍처 요약

ShortsAuto는 웹 앱을 **제어면(control plane)** 으로 두고, 오래 걸리는 미디어 작업을 **외부 worker**로 분리합니다.

```text
브라우저
   │ HTTPS
   ▼
Next.js 제어면 ── PostgreSQL (프로젝트, 승인, 작업, 감사 로그)
   │  │
   │  └──────── Object Storage (원본, 중간 산출물, 최종 MP4)
   │
   └── Queue ──► 외부 Media Worker
                  ├─ TTS / 자막 타이밍 / FFmpeg 렌더
                  ├─ 품질·정책 검사
                  └─ YouTube resumable upload
```

Vercel Function 요청 안에서 FFmpeg 렌더링이나 대용량 업로드를 끝내려 하지 않습니다. 제어면은 작업을 검증·등록하고 즉시 job ID를 반환합니다. worker는 lease와 heartbeat를 갱신하며 단계별 결과를 Object Storage에 저장합니다. 재시도는 동일한 idempotency key와 이미 완료된 stage를 재사용해 안전하게 수행합니다.

상세한 컴포넌트 책임, 상태 모델, 실패 복구, self-improvement 설계는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)를 참고하세요.

## 배포 권장안

- **제어면:** Vercel의 Next.js 배포
- **데이터베이스:** 관리형 PostgreSQL
- **산출물:** S3-compatible private Object Storage
- **작업 큐:** 가시성 timeout, retry, dead-letter queue를 제공하는 관리형 Queue
- **worker:** FFmpeg를 실행할 수 있고 작업 제한 시간을 충분히 확보한 container 환경
- **비밀 관리:** 배포 플랫폼 secret store + KMS 기반 token 암호화

프로덕션과 staging은 Google OAuth client, AI Gateway key/예산, DB, bucket, worker secret을 완전히 분리하세요. preview 배포에는 운영 토큰을 주입하지 않으며, production 배포 전 private 업로드 end-to-end 테스트와 rollback 훈련을 수행합니다.

## Self-improvement 운영 원칙

여기서 “스스로 개선”은 프로덕션 코드를 무제한으로 자기 수정하거나 콘텐츠를 무검수 자동 공개한다는 뜻이 아닙니다. 성과·품질 신호를 사용해 **프롬프트, 훅 전략, 템플릿, 모델 라우팅** 후보를 만들고 통제된 실험으로 승격하는 것을 의미합니다.

1. 게시 결과와 사람의 평가를 immutable event로 수집합니다.
2. 채널·주제·길이별로 후보 정책을 만들고 과거 데이터에서 offline 평가합니다.
3. 안전성, 사실성, 중복도, 비용, 렌더 성공률 기준을 통과한 후보만 shadow 실행합니다.
4. 일부 내부/비공개 작업에서 canary로 비교하되, 동일한 입력과 비용 한도를 적용합니다.
5. 사전 정의된 승격 기준을 만족할 때만 active 버전을 교체합니다.
6. 오류율·비용·품질이 임계값을 벗어나면 직전 안정 버전으로 자동 rollback합니다.

모든 결과에는 `policyVersion`, `promptVersion`, `model`, 입력 데이터 snapshot, 비용, 승인자를 기록합니다. 조회수만 최적화하지 않고 retention, 신고·차단, 사실 오류, 수동 수정량, 게시 취소율을 함께 봅니다.

## 보안 체크리스트

- `.env.local`과 OAuth client secret을 Git에 커밋하지 않습니다.
- 모든 변경 API에 인증, tenant 경계, 역할 기반 권한, CSRF 방어를 적용합니다.
- refresh token은 KMS envelope encryption으로 저장하고 주기적으로 키를 회전합니다.
- worker 명령은 `WORKER_SHARED_SECRET` 또는 workload identity로 서명·검증합니다.
- Object Storage는 private bucket과 짧은 수명의 signed URL만 사용합니다.
- 사용자가 제공한 URL에는 SSRF 방어, MIME sniffing, 크기·길이 제한, 악성 파일 검사를 적용합니다.
- 로그에서 토큰, 프롬프트 내 개인정보, signed URL을 마스킹합니다.
- AI/YouTube/렌더링 작업에 사용자·채널별 rate limit과 비용 상한을 둡니다.
- 삭제 요청은 DB, 산출물, 토큰, 분석 데이터의 보존 정책과 함께 처리합니다.

## 로드맵

1. **현재:** 제품 수준 데모 대시보드, 안전한 fallback, AI 기획 생성 엔드포인트
2. **Persistence:** PostgreSQL 스키마, 작업 event log, private Object Storage
3. **Channel connect:** Google OAuth, 암호화 token vault, 채널 상태 동기화
4. **Media pipeline:** TTS, 자동 자막, FFmpeg 9:16 렌더, preview, 품질 검사 worker
5. **Publishing:** 승인 게이트, resumable private upload, 예약 공개, 재시도·quota 관리
6. **Learning loop:** YouTube Analytics, experiment registry, shadow/canary, 자동 rollback
7. **Scale:** 다중 채널 tenant 격리, worker autoscaling, 비용·SLO 대시보드, 재해 복구

## 라이선스와 책임

저장소의 라이선스가 명시되기 전까지 재배포 조건을 임의로 가정하지 마세요. 생성한 콘텐츠의 사실 확인, 저작권, 초상권, 음원 라이선스, 광고·아동용 콘텐츠·합성 미디어 고지는 최종 게시자의 책임입니다. YouTube Terms of Service, YouTube API Services Terms, 각 AI/미디어 공급자의 정책을 배포 시점에 다시 검토하세요.
