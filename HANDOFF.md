# hypnagogic.xyz 런칭 — 핸드오프

## 진행 로그 (2026-09-01 오후)

- ✅ **5단계 완료**: `portfolio` 스키마 + `portfolio_app` role(암호: 서버 `/root/supabase/docker/.env.portfolio`) + `meditation_sessions` 테이블(RLS own-rows) — 드라이런 후 커밋, `/root/hub-migrations/2026-09-01-portfolio.sql`
- ✅ **PGRST_DB_SCHEMAS에 portfolio 추가** + rest 재시작, `Accept-Profile: portfolio`로 200 확인
- ✅ **기존 기록 이관**: 크롬(localhost:4173) localStorage `am-log`를 leveldb 포렌식으로 복원 → 46회/793분(2026-07-18~08-31), sangwoncheon93 계정(7e3cb990-…)으로 임포트
- ✅ **4단계 일부**: `ADDITIONAL_REDIRECT_URLS`에 hypnagogic.xyz + localhost:4173 추가, auth 재시작(백업 `.env.bak-20260901`). **SITE_URL 전환은 보류** — Ridgeline 기본 리다이렉트가 바뀌므로 별도 결정 필요
- ✅ **3단계 회피 확인**: API_EXTERNAL_URL을 안 바꾸는 한 구글 콘솔 작업 불필요 — 기존 ridgelinehk 콜백을 그대로 탄다. auth.hypnagogic.xyz로 넘어갈 때만 §3 순서 주의
- ✅ **사이트 통합**: 이 저장소 `site/`에 supabase-js 벤더 + `auth.js`(구글 로그인 칩, am-log↔DB 양방향 동기화, unique(user_id, logged_at)로 멱등)
- ✅ **DNS 완료**: Cloudflare A 레코드 `@`·`*` → 168.119.175.141 (DNS only). apex·와일드카드 전부 정상 해석
- ✅ **2단계 완료**: Kong compose에 `auth.hypnagogic.xyz` 라우터 한 쌍 추가(백업 `docker-compose.yml.bak-20260901`), LE 인증서 발급 확인(만료 2026-11-30), GoTrue health 200. Ridgeline 도메인 무사(교체 아닌 추가)
- ✅ **GitHub 푸시 완료**: https://github.com/sangwon1000/hypnagogic (public, main)
- ✅ **8단계 완료 — 라이브**: https://hypnagogic.xyz + www 둘 다 200, LE 인증서 발급(만료 2026-11-30). Dokploy 프로젝트 `hypnagogic` / 앱 `hypnagogic-room`(applicationId `NxCGnsYtufmfDQA93ra7m`, project `hxA1TXMbE8kRImnlnbwDm`, env `30ubwq_UvmUUbahdGbBav`), GitHub push→자동배포(autoDeploy on, githubId `2SldEdN316fFz6Bn_bviJ` 공유), Dockerfile 빌드. 끝단 검증: 필름 5개 readyState 4, 콘솔 에러 0, anon REST 200, 구글 authorize URL(redirect_to=hypnagogic.xyz) 정상, 칩 4개(day·log·sound·sign in) 렌더
- ⏳ **남은 결정**: (a) SITE_URL 전환 여부(§4 — 현재 ridgelinehk 유지 중, 안 바꿔도 로그인 동작) (b) SMTP는 구글 OAuth만 쓰면 불필요, 이메일 가입 열 때만 §"먼저 해결"
- ✅ **OAuth 새 이름 전환(09-01 저녁)**: 새 구글 클라우드 프로젝트+클라이언트(640124335221-…), `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI`+`API_EXTERNAL_URL`→auth.hypnagogic.xyz. 크리덴셜은 docker-compose.yml 하드코딩(.env 구글 변수는 하이픈 오타로 죽은 값). 백업 `.bak-preoauth` + `/root/backups/*-pre-oauth-swap.sql`
- ✅ **모바일 3연타(09-01 밤, v17→v19)**: ①1080p 경량 필름(`*_1080.mp4`, screen 최장변<1100) ②iOS 부팅 데드락 해결 — loadeddata만 기다리던 관문을 3갈래(+metadata+3s)+play 발길질+poster로 ③세로모드 복구(배율 `min(cover, fit)`+가운데 정렬, 데스크톱 무변경)·픽커 배경 클릭 탈출
- ✅ **볼 패치 1080판(09-02, v20)**: 아이폰에서 말렛 칠 때 네모 상자 깜빡임 — 원인 둘: 1080 필름 위 4K 패치는 GPU 축소 배율이 달라(3.4:1 vs 6.9:1) 상자가 드러나고, iOS는 재생이 서기 전의 비디오를 검은 상자로 그림. 처방: `bowl_*_1080.mp4`(필름과 같은 bicubic 1080 격자에서 크롭, 블록 YMAX 5/3 통과) + 패치도 `film()` 선택 + 숨은 워밍업 킥(play→pause) + 재생 성립 후에만 unhide(`__strike` 가드)
- ✅ **전부 처음부터 싣는다(09-02, v21)**: "한번 로딩되면 절대 기다릴 일 없게" 요청으로 남은 지연 로딩을 걷어냄. rev(밤→낮 롤)·반딧불이 fwd와 달리 iOS 발길질(kick)을 못 받고 있었던 걸 발견해 셋 다 같은 자리(DOM 완전 부착 후)에서 `kick(fwd); kick(rev); kick(ff);`로 통일. 볼 패치·똑딱 소리는 호버·2.5초 지연 트리거를 없애고 방이 열리자마자 `loadPatches(); loadTick();`로 즉시 로딩(둘 다 수십 KB라 방 필름과 무게 경합 없음). AudioContext도 제스처 없이 미리 생성(정지 상태로 시작 가능, decode는 정지 상태에서도 됨 — 제스처는 resume()에만 필요). 데스크톱·모바일 에뮬레이션 둘 다 페이지 로드 1.2~4초 안에 필름 3개+패치 2개 readyState 4 확인, 콘솔 에러 0.

## Dokploy 등록 (완료 — 재현/참고용)

API로 등록함(대시보드 아닌 REST, x-api-key). 앱 재생성 필요 시:
project.create → application.create(environmentId) → application.saveGithubProvider
(owner/repository/branch/githubId/buildPath) → application.saveBuildType
(buildType=dockerfile, dockerfile="Dockerfile", **herokuVersion·railpackVersion 필수**)
→ domain.create ×2(apex+www, https, certificateType=letsencrypt, port 80)
→ application.deploy. 레퍼런스 앱: `mountain-viewer-cg9aga`.

2026-09-01 기준. 이 문서 하나로 런칭 작업을 시작할 수 있게 쓴 인계 노트다.
DB 운영 규칙 상세는 별도 문서가 있다 → `hk-trail-data/docs/supabase-hub.md`
(새 저장소에 복사해 오는 걸 권장).

## 목표

`hypnagogic.xyz` 를 메인 포트폴리오 사이트로 띄우고, 앞으로 만들 여러
프로젝트가 **하나의 계정 체계를 공유**하게 한다. 프로젝트마다 Supabase
인스턴스를 새로 띄우던 방식을 멈추는 게 핵심이다.

## 유일한 블로커: DNS

`hypnagogic.xyz` 는 아직 어디에도 연결돼 있지 않다 (A 레코드 없음).
**등록기관 콘솔에서 아래를 설정해야 나머지가 전부 진행된다.**

```
hypnagogic.xyz        A   168.119.175.141
*.hypnagogic.xyz      A   168.119.175.141      (서브도메인용 와일드카드)
```

## 인프라 현황

Hetzner `server01` = `168.119.175.141`, SSH `root@168.119.175.141`
(`~/.ssh/id_ed25519`, ssh config 미등록). Traefik + Dokploy 로 운영.
총 메모리 7.6Gi 로 빠듯하다.

| Supabase 인스턴스 | 공개 URL | 용도 | 허브 역할 |
|---|---|---|---|
| `/root/supabase` | supabase.ridgelinehk.com | Ridgeline HK | **← 이게 허브** |
| `/root/supabase2` | supabase.esperfinance.com | Esper Finance | 그대로 둠 |
| `/root/supabase3` | alphafoundry-supabase.thousandlab.duckdns.org | AlphaFoundry (10GB) | 그대로 둠 |
| `/root/supabase4` | webanalytics-supabase.thousandlab.duckdns.org | web-analytics | 나중에 허브로 흡수 예정 |

허브로 `/root/supabase` 를 고른 이유: storage · studio · meta · Google OAuth ·
PostGIS 가 이미 다 돌고 있다. 슬림 스택에 이걸 다 새로 얹는 것보다 싸다.

**크리덴셜 위치** (값은 여기 적지 않는다): `/root/supabase/docker/.env`
– Studio 로그인은 `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`,
API 키는 `ANON_KEY` / `SERVICE_ROLE_KEY`.

## 허브 현재 상태

첫 입주가 끝난 상태다. Ridgeline HK 를 레퍼런스 구현으로 보면 된다.

```
postgres (DB 하나)
├── auth          ← 공유 계정. 현재 2명 (전부 Google OAuth 로 가입)
├── storage       ← 버킷 11개, 전부 Ridgeline HK 것
├── public        ← 공용 영역: profiles + handle_new_user() + PostGIS
│                   ★ 새 테이블 금지
├── hk_trails     ← Ridgeline HK (테이블 20 + 뷰 1). 마이그레이션 022 로 이전 완료
└── portfolio     ← 여기에 새로 만들 것
```

`PGRST_DB_SCHEMAS=public,storage,graphql_public,hk_trails` — 새 스키마를
추가할 때마다 여기에 넣고 `rest` 를 재시작해야 REST API 에 노출된다.

## 런칭 순서

### 1. DNS (위 참조) — 사람이 해야 함

### 2. Kong 에 도메인 추가

기존 `supabase.ridgelinehk.com` 은 **죽이지 말 것.** Ridgeline HK 의
모바일 딥링크(`hktrails://`)가 참조 중이다. 같은 Kong 컨테이너에 Traefik
Host 룰을 하나 더 붙여 두 도메인이 동시에 동작하게 한다.

```
/root/supabase/docker/docker-compose.yml 의 kong 서비스 labels 에
Host(`auth.hypnagogic.xyz`) 라우터 추가 → docker compose up -d kong
```

### 3. Google OAuth 콜백 먼저 등록 ★ 순서 주의

`API_EXTERNAL_URL` 을 바꾸기 **전에** 구글 콘솔에
`https://auth.hypnagogic.xyz/auth/v1/callback` 을 **추가** 등록한다.
순서를 반대로 하면 로그인이 죽는다.

### 4. GoTrue 설정

```bash
# /root/supabase/docker/.env
SITE_URL=https://hypnagogic.xyz
ADDITIONAL_REDIRECT_URLS=<기존 목록 유지>,https://hypnagogic.xyz,https://*.hypnagogic.xyz/**
GOTRUE_MAILER_EXTERNAL_HOSTS=supabase.ridgelinehk.com,auth.hypnagogic.xyz
```

### 5. portfolio 스키마 + 전용 role

```sql
create schema portfolio;
grant usage on schema portfolio to anon, authenticated, service_role;

-- public 의 'anon=arwdDxt' 를 물려받지 않도록 직접 정의한다
alter default privileges in schema portfolio grant select on tables to anon;
alter default privileges in schema portfolio
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema portfolio grant all on tables to service_role;
alter default privileges in schema portfolio
  grant usage, select on sequences to anon, authenticated, service_role;

create role portfolio_app login password '...' connection limit 10;
alter role portfolio_app set search_path = portfolio, public, extensions;
alter role portfolio_app set statement_timeout = '15s';
alter role portfolio_app set idle_in_transaction_session_timeout = '60s';
grant usage on schema portfolio to portfolio_app;
```

DDL 은 `supabase_admin` 으로 실행한다. 이 인스턴스에서 `postgres` 는
슈퍼유저가 아니다 (`rolsuper = f`).

```bash
docker exec -i supabase-db psql -U supabase_admin -v ON_ERROR_STOP=1 < migration.sql
```

**적용 전 반드시 드라이런**: `commit;` 을 `rollback;` 으로 바꿔 실행.
Postgres 는 DDL 도 트랜잭션이라 소유권 문제와 오타가 여기서 다 잡힌다.
(hk_trails 이전 때 이 방법으로 "must be owner of type place_category" 를
미리 발견했다.)

### 6. 프로젝트별 권한 테이블

계정은 공유하지만 프로젝트마다 권한이 다를 수 있으니 공용 영역에 둔다.

```sql
create table public.app_access (
  user_id  uuid not null references auth.users(id) on delete cascade,
  app_slug text not null,
  role     text not null default 'member',
  primary key (user_id, app_slug)
);
alter table public.app_access enable row level security;
create policy "own rows" on public.app_access for select using (auth.uid() = user_id);
```

### 7. 서브도메인 SSO (선택)

supabase-js 기본값은 localStorage 라 origin 마다 세션이 따로 논다.
한 번 로그인으로 전 프로젝트가 로그인 상태가 되게 하려면 storage 어댑터를
`.hypnagogic.xyz` 도메인 쿠키로 바꿔야 한다. **이건 모든 프로젝트가 같은
apex 아래 있을 때만 가능하다** — 프로젝트마다 다른 도메인을 쓰면 이 선택지가
영구히 막히므로, 서브도메인으로 통일할 것.

### 8. 배포

Dokploy 에 앱 등록 → git push 하면 자동 빌드. Ridgeline HK 는
`mountain-viewer-cg9aga` 서비스로 이 방식으로 돈다.

### 9. 애널리틱스

`web-analytics` 프로젝트(self-hosted)의 트래커를 심으면 유입을 볼 수 있다.
포트폴리오는 대부분 정적이라 DB 가 거의 필요 없다 — 로그인이 실제로 필요한
프로젝트만 허브에 붙이는 걸 권한다.

## 먼저 해결해야 할 것

**SMTP 가 가짜다. 이게 로그인 붙이기 전 최우선이다.**

```
GOTRUE_SMTP_HOST=supabase-mail   ← 이 컨테이너가 서버에 없음
GOTRUE_MAILER_AUTOCONFIRM=false  ← 확인메일 필수인데 발송 불가
```

이메일 가입 · 비밀번호 재설정 · 매직링크가 전부 무응답이다. 현재 계정 2개가
전부 Google OAuth 로 들어온 이유가 이것. 두 갈래:

- **A안 (권장)**: 실제 SMTP 연결. Resend 무료 3,000통/월.
  발신 도메인 인증이 필요하므로 DNS 설정 후에 가능.
- **B안 (임시)**: `ENABLE_EMAIL_AUTOCONFIRM=true` — 검증 생략하고 가입만 열기.

## 미해결 인프라 이슈

허브에 프로젝트를 몰아넣기 시작하면 심각해지는 것들. 전부 미적용 상태다.

| | 현재 | 위험 |
|---|---|---|
| 백업 크론 | 없음 (수동 덤프 1개뿐) | 단일 실패점 |
| 컨테이너 메모리 제한 | 전부 0 | 한 프로젝트 폭주 → 같은 서버의 Esper·AlphaFoundry 까지 OOM |
| 스토리지 용량 제한 | 버킷 전부 무제한 | 디스크 폭탄 |
| `max_connections` | 100, role 별 제한 없음 | 프로젝트 늘면 고갈 |

수동 백업 명령:

```bash
docker exec supabase-db pg_dump -U postgres --no-owner --clean --if-exists \
  -d postgres > /root/backups/supabase-hub-$(date +%Y%m%d-%H%M%S).sql
```

급하지 않은 것: `POOLER_TENANT_ID` 가 기본 플레이스홀더,
DB 의 `app.settings.jwt_secret` 이 데모값(참조 함수 0개라 취약점은 아님),
`effective_cache_size` 가 128MB 로 낮음.

## 절대 건드리지 말 것

| 대상 | 이유 |
|---|---|
| `auth.users` | 모든 프로젝트 공유. 직접 INSERT/DELETE 금지 |
| `public.profiles` | 공용 신원. **`NOT NULL` 컬럼 추가가 가장 흔한 사고 경로** |
| `public.handle_new_user()` | 가입 트랜잭션 안에서 돈다. 여기서 실패하면 **모든 프로젝트의 회원가입이 동시에 죽는다** |
| `public` 의 PostGIS | 확장. 이동 금지 |
| `supabase.ridgelinehk.com` | Ridgeline HK 모바일 딥링크가 참조 중. 도메인은 추가만, 교체 금지 |

프로젝트 고유 사용자 필드가 필요하면 `public.profiles` 를 늘리지 말고
자기 스키마에 별도 테이블을 만들어 `profiles.id` 를 FK 로 참조한다.
