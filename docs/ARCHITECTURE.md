# ShortsAuto 운영 아키텍처

이 문서는 ShortsAuto를 데모에서 실제 다중 채널 제작·게시 시스템으로 확장하기 위한 목표 아키텍처와 운영 규칙을 정의합니다. 현재 저장소가 제공하는 범위는 데모 대시보드와 AI 기획 생성 엔드포인트입니다. 아래의 Google OAuth, DB, Storage, Queue, media worker, 실제 업로드, analytics 기반 개선 루프는 **준비된 설계이며 아직 연결되지 않은 운영 단계**입니다.

## 1. 설계 목표

ShortsAuto는 다음 속성을 동시에 만족해야 합니다.

- 아이디어에서 private 업로드까지 반복 가능한 자동화
- 공개 발행 전 사람의 명시적 승인
- 길게 실행되는 미디어 처리와 웹 요청의 완전한 분리
- 실패해도 중복 게시하지 않는 at-least-once + idempotency 모델
- 입력, 프롬프트, 모델, 산출물, 승인, 업로드를 재현할 수 있는 lineage
- tenant·채널·환경별 자격 증명과 데이터 격리
- 성과를 학습하되 안전성·사실성·비용을 희생하지 않는 실험 체계
- 한 번의 설정 변경으로 직전 안정 정책으로 돌아갈 수 있는 rollback

비목표는 완전 무인 공개, 임의의 자기 코드 수정, 저작권 소유권 추정, 조회수만을 위한 engagement 최적화입니다.

## 2. 경계와 책임

### 2.1 제어면: Next.js

제어면은 짧고 결정적인 요청만 처리합니다.

- 사용자 인증, tenant/role 권한 검사
- 채널 연결 시작과 OAuth callback 처리
- 프로젝트, 콘텐츠 기획, 승인, 예약 정보 CRUD
- Zod 기반 command validation과 idempotency key 발급
- AI 기획 생성 요청과 사용량 기록
- 작업 생성, 취소, 재시도 명령
- job 상태 및 preview URL 조회
- 승인된 게시 명령 발행
- 감사 이벤트 기록

제어면은 FFmpeg, 긴 TTS 생성, 대용량 파일 복사, YouTube 업로드를 요청 lifecycle 안에서 수행하지 않습니다. API는 작업을 내구성 있게 저장하고 queue에 넣은 뒤 `202 Accepted`와 job ID를 반환합니다.

### 2.2 데이터베이스: PostgreSQL

DB가 control plane의 source of truth입니다. 최소 엔터티는 다음과 같습니다.

| 엔터티 | 핵심 책임 |
| --- | --- |
| `tenants`, `users`, `memberships` | tenant 경계와 RBAC |
| `channels`, `oauth_grants` | YouTube 채널과 암호화 token reference |
| `projects`, `content_plans` | 아이디어, 대본, 장면, 메타데이터 |
| `assets`, `renders` | 원본·중간·최종 산출물의 immutable manifest |
| `jobs`, `job_attempts` | 상태, lease, retry, heartbeat, error class |
| `approvals`, `publish_schedules` | 검수 결과, 승인자, 공개 시각 |
| `youtube_uploads` | session, video ID, privacy, 처리 상태 |
| `events`, `audit_logs` | append-only 상태 전이와 보안 감사 |
| `policy_versions`, `experiments` | 프롬프트·모델·템플릿 버전과 실험 배정 |
| `metric_snapshots` | 성과, 품질, 비용의 시간별 snapshot |

OAuth refresh token 자체를 일반 컬럼의 평문으로 저장하지 않습니다. KMS로 envelope encryption한 ciphertext와 key version만 저장하거나 별도의 token vault를 사용합니다.

### 2.3 Object Storage

대용량 데이터는 DB가 아니라 private S3-compatible bucket에 둡니다.

```text
tenants/{tenantId}/projects/{projectId}/
  source/{assetId}/{sha256}.{ext}
  stage/{renderId}/audio.wav
  stage/{renderId}/captions.srt
  stage/{renderId}/timeline.json
  output/{renderId}/short.mp4
  output/{renderId}/poster.jpg
  manifests/{renderId}.json
```

객체 key에 사용자 원본 파일명을 직접 넣지 않습니다. 모든 객체는 SHA-256, byte size, MIME, 생성 stage, policy version을 manifest에 기록합니다. 브라우저와 worker는 짧은 수명의 scoped signed URL만 사용합니다.

### 2.4 Queue

Queue는 DB에 기록된 job ID만 전달하고 민감한 prompt, token, signed URL을 payload에 넣지 않습니다. worker가 job ID로 권한이 제한된 작업 명세를 조회합니다.

필수 기능은 visibility timeout, delivery retry, dead-letter queue, delayed delivery입니다. 전달 보장은 at-least-once로 가정하며 exactly-once를 기대하지 않습니다. side effect 직전에 DB의 idempotency record를 원자적으로 확인합니다.

### 2.5 외부 Media Worker

worker는 CPU/GPU, FFmpeg, 긴 timeout이 필요한 작업을 담당합니다.

- source 검사: MIME sniffing, codec probe, 길이·해상도·용량 제한
- TTS 생성과 오디오 loudness 정규화
- 자막 타이밍, 줄바꿈, safe-area 배치
- 장면 asset 준비와 9:16 timeline 조립
- FFmpeg 렌더 및 preview 생성
- 블랙 프레임, 무음, clipping, duration, bitrate, 해상도 검사
- 중복/유해성/정책 검사 결과 수집
- 승인된 최종본의 YouTube resumable upload

worker는 작업을 claim할 때 lease를 얻고 주기적으로 heartbeat를 보냅니다. lease가 만료되면 다른 worker가 이어받을 수 있습니다. 완료된 stage 산출물이 checksum과 manifest 검사를 통과하면 재시도 시 재사용합니다.

## 3. 요청과 데이터 흐름

### 3.1 기획 생성

1. 사용자가 채널, 주제, 톤, 목표 길이, 금지 항목을 입력합니다.
2. 제어면이 권한·길이·예산을 검사하고 입력 snapshot을 저장합니다.
3. AI Gateway를 통해 구조화된 기획을 생성합니다.
4. 결과를 schema validation하고 정책 검사·중복 검사를 수행합니다.
5. model ID, 사용량, prompt/policy version, Gateway trace reference를 저장합니다.
6. 사용자가 대본과 메타데이터를 편집·승인합니다.

AI 모델 목록은 런타임과 배포 전에 Gateway에서 확인합니다. 모델을 코드 여러 곳에 하드코딩하지 않고 `AI_MODEL` 및 versioned policy로 선택합니다. 402(예산), 429(rate limit), 5xx(provider 장애)는 사용자 오류와 분리하고, 안전한 fallback 또는 재시도 가능 상태로 변환합니다.

### 3.2 렌더링

1. 제어면이 content plan의 immutable revision을 고정합니다.
2. `render.requested` event와 job을 같은 트랜잭션/outbox에 기록합니다.
3. worker가 필요한 source를 다운로드하고 각 stage를 실행합니다.
4. stage마다 manifest, checksum, 사용한 tool/model version을 저장합니다.
5. 최종 품질 검사를 통과하면 `render.awaiting_review`로 전이합니다.
6. UI는 signed preview URL과 검사 결과를 보여줍니다.

### 3.3 게시

1. 승인자는 최종 render checksum, 제목, 설명, 공개 범위, 합성 미디어·아동용 표시를 확인합니다.
2. 승인은 대상 revision과 render checksum에 결합됩니다. 수정이 생기면 기존 승인은 무효가 됩니다.
3. publisher가 암호화된 refresh token으로 access token을 갱신합니다.
4. `private` 상태로 resumable upload session을 만들고 session URI를 암호화해 저장합니다.
5. 업로드 완료 후 반환된 YouTube video ID를 idempotency record에 고정합니다.
6. 처리 상태를 polling하고, 필요한 경우 승인된 `unlisted/public` 또는 `publishAt` 변경을 별도 단계로 수행합니다.

업로드 timeout만으로 실패를 단정하고 새 영상을 만들지 않습니다. 먼저 저장된 session과 video ID, 채널의 최근 업로드를 확인해 중복을 방지합니다.

## 4. 작업 상태 모델

권장 job 상태는 다음과 같습니다.

```text
queued → claimed → running → succeeded
                    ├→ retry_wait → queued
                    ├→ cancelled
                    └→ dead_letter
```

콘텐츠 lifecycle은 worker 실행 상태와 분리합니다.

```text
draft → planned → rendering → awaiting_review → approved
                                              ├→ changes_requested → rendering
approved → upload_queued → uploaded_private → scheduled → published
                                  └→ publish_failed
```

허용된 전이만 서버에서 실행합니다. 클라이언트가 임의로 상태 문자열을 덮어쓰지 못하게 하고, 각 전이를 append-only event와 actor 정보로 남깁니다.

## 5. Idempotency와 재시도

각 side effect는 안정적인 key를 사용합니다.

```text
plan:    tenantId + projectId + sourceRevision + policyVersion
render:  projectId + contentRevision + renderProfile + assetChecksums
upload:  channelId + renderChecksum + metadataRevision
publish: youtubeVideoId + privacyRevision + publishAt
```

- 사용자가 재시도 버튼을 여러 번 눌러도 같은 active job을 반환합니다.
- 429와 일시적 5xx는 `Retry-After`를 우선하고 jittered exponential backoff를 적용합니다.
- schema 오류, 권한 오류, 정책 위반은 자동 재시도하지 않습니다.
- 최대 시도 횟수 뒤에는 DLQ로 보내고 사람이 원인과 입력 revision을 확인합니다.
- worker crash 후 lease가 회수되더라도 완료 stage와 checksum을 검증해 이어서 실행합니다.

## 6. Self-improvement 실험 체계

### 6.1 개선 가능한 대상

- 대본 구조, 첫 1~3초 훅, CTA와 길이 정책
- 장면 전환, 자막 밀도, 음성 속도, 템플릿
- 모델 선택, fallback 순서, temperature와 token budget
- 품질 검사 threshold와 추천 게시 시간

실행 코드, 보안 정책, OAuth scope, 공개 승인 규칙은 자동 개선 대상이 아닙니다. 이 변경은 코드 리뷰와 배포 승인이 필요합니다.

### 6.2 신호와 guardrail

성과 지표는 노출 대비 조회, 초반 이탈, 평균 시청 비율, 완주율, 반복 시청, 구독 전환을 포함합니다. 그러나 다음 guardrail을 동시에 만족해야 합니다.

- 사실 오류·정책 위반·저작권 경고 0건 목표
- 신고, 차단, 삭제, 게시 취소율 비열화 금지
- 사람의 수정 거리와 검수 시간 비열화 금지
- 렌더/업로드 성공률과 p95 처리 시간 SLO 준수
- 영상당 AI·TTS·렌더 비용 상한 준수
- 특정 채널·언어·주제에서만 나타나는 편향 점검

조회수가 높더라도 guardrail을 위반하면 승격하지 않습니다. 게시 후 지표는 계절성, 채널 규모, 주제 차이가 크므로 단순 전후 비교가 아니라 동시 대조군과 충분한 관찰 기간을 사용합니다.

### 6.3 승격 단계

```text
candidate → offline_eval → shadow → canary_private → canary_live → active
     └────────────── rejected / rolled_back ◄──────────────────────┘
```

1. candidate는 immutable `policyVersion`으로 저장합니다.
2. 고정 evaluation set에서 schema, 사실성, 안전성, 중복도, 비용을 평가합니다.
3. shadow는 같은 입력에 결과만 만들고 사용자의 작업에는 반영하지 않습니다.
4. canary_private는 내부 또는 private 작업에만 적용합니다.
5. canary_live는 사전에 정한 소량의 적격 트래픽에 배정합니다.
6. 최소 표본, 관찰 기간, primary metric 개선, 모든 guardrail 통과 후 active로 승격합니다.

실험 배정은 `tenantId/channelId` 기반의 안정적인 hash로 고정하여 사용자가 실행할 때마다 그룹이 바뀌지 않게 합니다.

### 6.4 Rollback

active pointer는 버전 참조 한 개로 관리하며 산출물에는 실제 사용 버전을 복사해 기록합니다. 자동 rollback 조건 예시는 다음과 같습니다.

- generation/validation 오류율 급증
- 비용 또는 p95 latency 예산 초과
- 렌더 실패율 증가
- 정책 검사 severity high 발생
- 수동 거부율 또는 수정량 임계값 초과
- YouTube 업로드/게시 오류율 증가

rollback은 새 작업의 active pointer만 직전 stable 버전으로 바꿉니다. 이미 공개된 영상을 자동 삭제하지 않으며, 진행 중 작업은 안전 지점에서 취소하거나 고정된 기존 버전으로 완료합니다. incident에는 영향받은 job ID와 policy version을 자동 첨부합니다.

## 7. YouTube OAuth와 정책 경계

최소 scope는 업로드만 필요한 경우 `youtube.upload`입니다. 채널·영상 관리 기능을 추가할 때만 incremental authorization으로 범위를 확대합니다. 장기 예약 작업에는 offline access가 필요하며, refresh token은 한 번만 반환될 수 있다는 전제로 재연결 UX를 제공합니다.

운영 원칙:

- 감사받지 않은 API 프로젝트의 private 제한을 우회하지 않습니다.
- private 업로드와 공개 전환을 별개의 감사 가능한 명령으로 둡니다.
- quota는 예약 시점과 실행 시점 모두 확인하고, 고갈 시 다음 허용 시간으로 지연합니다.
- 채널 업로드 한도, 사용자 grant 철회, invalid_grant는 재인증 필요 상태로 분류합니다.
- `madeForKids`, synthetic media, privacy status를 승인 화면에서 명시적으로 보여줍니다.
- API 정책과 quota 변경을 분기별, 배포 전, 오류 급증 시 다시 점검합니다.

공식 기준은 [OAuth 가이드](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps), [`videos.insert`](https://developers.google.com/youtube/v3/docs/videos/insert), [quota 문서](https://developers.google.com/youtube/v3/determine_quota_cost)입니다.

## 8. 보안 모델

### 신뢰 경계

- 브라우저는 신뢰하지 않으며 모든 command를 서버에서 다시 검증합니다.
- 제어면과 worker는 서로 다른 identity와 최소 권한을 사용합니다.
- worker에는 DB 전체 권한 대신 job 조회·상태 갱신·제한된 객체 접근 권한만 줍니다.
- Google 및 AI 자격 증명은 서버/worker secret store에서만 읽습니다.

### 주요 위협과 통제

| 위협 | 통제 |
| --- | --- |
| OAuth CSRF / account confusion | 일회성 state, callback 세션 결합, 정확한 redirect URI, channel ID 재확인 |
| Refresh token 유출 | KMS 암호화, 로그 마스킹, key rotation, revoke 지원 |
| SSRF / 악성 asset | URL allow/deny 정책, DNS/IP 재검증, 크기 제한, MIME sniffing, 격리 변환 |
| Tenant 간 데이터 노출 | 모든 key에 tenant ID, DB RLS 또는 강제 repository filter, cross-tenant 테스트 |
| Queue message 위조 | workload identity 또는 회전 가능한 `WORKER_SHARED_SECRET`, timestamp/nonce 서명 |
| Signed URL 재사용 | 최소 권한, 짧은 TTL, 단일 객체, 다운로드 횟수·감사 로그 |
| 중복 공개 | upload idempotency, checksum 결합 승인, private-first, 별도 publish command |
| 비용 폭주 | tenant/channel별 quota, AI token 상한, worker 동시성, Gateway budget/alert |
| Prompt injection | 외부 텍스트를 data로 격리, tool allowlist, 구조화 출력, 정책을 모델 밖에서 강제 |

## 9. 관측성과 SLO

모든 요청과 비동기 작업에 `requestId`, `jobId`, `tenantId`, `projectId`, `policyVersion`을 연결합니다. 토큰·원문 개인정보·signed URL은 로그에 포함하지 않습니다.

권장 초기 SLO:

- 제어면 읽기 API 가용성 99.9%
- command 접수 p95 1초 이내(외부 작업 완료 시간 제외)
- job queue 대기 p95 2분 이내
- 정상 입력 렌더 성공률 98% 이상
- 승인된 private upload 성공률 99% 이상(재시도 포함)
- 중복 업로드 0건
- 승인 없는 public 전환 0건

대시보드는 queue depth/age, worker heartbeat, stage별 실패율·시간, AI 비용, Storage 증가량, YouTube quota/403/429, OAuth refresh 실패, canary guardrail을 보여줘야 합니다. 경보에는 runbook과 최근 배포·policy version을 연결합니다.

## 10. 배포 토폴로지

### 환경 분리

`development`, `preview`, `staging`, `production`은 다음 리소스를 공유하지 않습니다.

- Google OAuth client와 redirect URI
- AI Gateway key/OIDC project와 예산
- PostgreSQL database/schema
- Storage bucket과 encryption key
- Queue, DLQ, worker identity
- token encryption key와 `WORKER_SHARED_SECRET`

preview에는 운영 OAuth refresh token을 주입하지 않습니다. staging은 테스트 채널에만 연결하고 public 게시를 정책으로 차단합니다.

### 배포 순서

1. backward-compatible DB migration과 worker를 먼저 배포합니다.
2. 새 job schema를 읽을 수 있음을 staging에서 확인합니다.
3. control plane을 배포하고 demo smoke test를 실행합니다.
4. private end-to-end test로 기획 → 렌더 → 승인 → 업로드를 검증합니다.
5. canary tenant부터 production traffic을 확장합니다.
6. SLO와 비용을 관찰한 뒤 이전 schema/worker 호환 코드를 정리합니다.

DB migration은 expand/contract 방식을 사용합니다. 앱 rollback이 필요한 동안 destructive migration을 실행하지 않습니다.

## 11. 백업과 재해 복구

- PostgreSQL PITR과 정기 복구 훈련
- Object Storage versioning 또는 immutable retention 정책
- OAuth token ciphertext와 KMS key version의 일관된 백업
- Queue가 손실되어도 DB의 `queued/retry_wait` job을 다시 발행하는 reconciler
- YouTube video ID와 upload session의 주기적 reconciliation
- policy/prompt/template artifact의 immutable version 보관

초기 목표 RPO/RTO를 각각 15분/4시간으로 두고 실제 복구 훈련 결과에 따라 조정합니다. 백업 성공 알림만으로 복구 가능성을 가정하지 않습니다.

## 12. 단계별 구현 계획

### Phase 0 — 현재

- 데모 운영 대시보드
- AI Gateway 선택 연동과 결정론적 fallback
- 구조화된 기획 생성 API

### Phase 1 — 영속 제어면

- tenant/RBAC, PostgreSQL schema, append-only events
- private Object Storage와 signed upload/download
- AI 사용량·policy version·감사 로그

### Phase 2 — Channel connect

- Google OAuth, encrypted token vault, revoke/reconnect
- 채널 identity와 권한 검증
- API audit 및 privacy 제한 상태 표시

### Phase 3 — Media worker

- Queue/outbox, lease/heartbeat/DLQ
- TTS, caption, FFmpeg stage와 manifest
- preview, 품질 검사, 취소·재시도 UX

### Phase 4 — 안전한 게시

- checksum-bound approval
- private resumable upload와 quota scheduler
- 예약 공개, reconciliation, incident runbook

### Phase 5 — 개선 루프

- YouTube Analytics ingestion
- evaluation set과 experiment registry
- shadow/canary, automated guardrail, one-click rollback

## 13. Architecture Decision Records 권장 목록

구현을 시작할 때 다음 결정을 `docs/adr/`에 별도 기록합니다.

- ADR-001: Queue 제품과 DB outbox 전달 보장
- ADR-002: OAuth token vault/KMS 방식과 rotation
- ADR-003: Object key, retention, 사용자 삭제 정책
- ADR-004: worker sandbox와 허용 codec/입력 제한
- ADR-005: YouTube quota scheduler와 publish approval
- ADR-006: 실험 배정, 승격 통계 기준, rollback threshold
- ADR-007: tenant isolation과 DB RLS 여부

이 ADR이 확정되기 전에는 문서의 특정 vendor 예시를 구현 의무로 해석하지 않습니다. 핵심 계약은 웹 요청과 미디어 작업의 분리, private-first 게시, idempotency, immutable lineage, 통제된 개선과 rollback입니다.
