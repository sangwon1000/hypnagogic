# hypnagogic.xyz 런칭 — 핸드오프

## 진행 로그 (2026-09-01 오후)

- ✅ **5단계 완료**: `portfolio` 스키마 + `portfolio_app` role(암호: 서버 `/root/supabase/docker/.env.portfolio`) + `meditation_sessions` 테이블(RLS own-rows) — 드라이런 후 커밋, `/root/hub-migrations/2026-09-01-portfolio.sql`
- ✅ **PGRST_DB_SCHEMAS에 portfolio 추가** + rest 재시작, `Accept-Profile: portfolio`로 200 확인
- ✅ **기존 기록 이관**: 크롬(localhost:4173) localStorage `am-log`를 leveldb 포렌식으로 복원 → 46회/793분(2026-07-18~08-31), sangwoncheon93 계정(7e3cb990-…)으로 임포트
- ✅ **4단계 일부**: `ADDITIONAL_REDIRECT_URLS`에 hypnagogic.xyz + localhost:4173 추가, auth 재시작(백업 `.env.bak-20260901`). **SITE_URL 전환은 보류** — Ridgeline 기본 리다이렉트가 바뀌므로 별도 결정 필요
- ⚠️ **3단계 정정(2026-09-02)**: 위 회피는 실제로 쓰이지 않았다. `API_EXTERNAL_URL` 은
  `supabase.ridgelinehk.com` → `auth.hypnagogic.xyz` 로 **이미 바뀌어 있다**(`.env.bak-20260901` 과 대조).
  구글 콘솔에도 `https://auth.hypnagogic.xyz/auth/v1/callback` 이 등록돼 있어 동작은 정상이다.
  다만 이제 **Ridgeline HK 의 구글 로그인도 이 호스트를 탄다** — hypnagogic 쪽 Kong 라우터가
  죽으면 Ridgeline 로그인도 같이 죽는다는 뜻이다.
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
- ✅ **명패는 바깥을 누르면 걷힌다(09-03, v22)**: 호버만 상정한 명패(plate3d)가 폰에서 한 번 뜨면 안 사라짐 — **iOS는 탭한 요소의 호버 상태를 다음 탭까지 붙들고 있어 `pointerleave`가 영영 안 온다**(마우스는 미끄러져 나가며 걷어 간다). 처방 둘: ①window에 capture `pointerdown` — `hovered && !hotmap.contains(e.target)`이면 `clearHover()`(다른 물건을 눌렀으면 그쪽 hoverOn이 갈아끼우므로 손대지 않는다) ②MutationObserver 조건을 `'sitting'||'log'` → `!== 'room'`으로 넓혀 **탭으로 픽커가 열릴 때도** 명패가 걷히게. 검증은 `PointerEvent{pointerType:'touch'}`를 직접 쏴서 iOS식(enter만 오고 leave 없음)을 재현 — **크로미움 터치 에뮬레이션은 규격대로 touchend에 pointerleave를 보내 이 버그를 재현하지 못한다**. 통과: 바깥 탭→걷힘, 물건→물건 갈아끼움, 같은 물건 재탭 유지, 칩 탭→걷힘, 픽커 열림→걷힘, 마우스 호버·물건 직접 클릭 무변경.
- ✅ **폰은 극장이 된다 + 데스크톱 권유 팝업(09-03, style v25)**: 세로로 들면 필름 위아래로 화면의 3분의 2가 남는데 그 자리가 마당 살구색이라 방이 사진 한 장처럼 떴다 → **`[data-small]` 이면 `.scene`·`body`·`.load` 전부 검정**(낮이든 밤이든). 표식은 `room/index.html` 머리 스크립트가 **첫 페인트 전에** 건다(room2d 의 `SMALL` 과 같은 잣대 `max(screen.w,h)<1100`; defer 스크립트로는 늦어 분홍이 한 번 번쩍인다). **파생 문제 — 검은 여백 위에서는 낮의 먹빛 UI가 전부 사라진다**(칩·워드마크·픽커 알약·begin 이 안 보였다): `--s3-*` 밤 팔레트 선택자를 `[data-theme="night"], [data-small]` 로 넓혀 **폰은 낮에도 밤 옷을 입게** 했다. 필름 위에 서는 명패(plate3d)만은 낮 옷 그대로 — 그건 밝은 필름을 배경으로 서기 때문(각자 제 배경에 맞춰 입는다). 가로로 들면 칩이 필름을 반쯤 밟으므로 `[data-small] .s3-chip` 에 검은 판 + 워드마크에 그림자. **팝업**: `.wide` 모달 — 방이 열리고 1.4초 뒤(로딩과 안 겹치게, 안 열려도 9.5초 안전핀), 버튼·배경 탭 둘 다로 닫히고 `localStorage['am-wide-notice']` 로 한 번만. 폰에서만(`data-small`). 검증: 낮/밤 세로·가로, 픽커·로그 화면, 팝업 표시→닫힘→기억→재방문 무표시, 데스크톱 완전 무변경(`data-small` 없음·분홍 마당·낮 칩·팝업 미표시).
- ✅ **★ 회색 네모의 진범 = iOS 탭 하이라이트(09-03, style v26 · room2d v23)**: v20 뒤에도 "오브젝트 클릭할 때 그레이 아웃된 사각형" 재보고. 원인은 `-webkit-tap-highlight-color` — iOS 사파리는 click 리스너가 달린 요소를 누르면 그 요소의 **바운딩 박스(SVG 폴리곤이면 직사각형)** 위에 반투명 회색을 얹는다. 물건 셋 전부 해당(방석도 — v20의 '패치 상자' 진단은 부수 원인이었을 뿐). 처방: `html { -webkit-tap-highlight-color: transparent }` 한 줄(상속). **증명**: iOS 26.5 시뮬레이터에서 XCUITest(호스트 앱 없는 UI 테스트 번들, 접근성 권한 불필요)로 사파리에 진짜 탭을 넣고 `xcrun simctl io recordVideo`로 녹화 — 라이브(v25) 방석 빠른 탭 직후 박스 안 마루 밝기 85→67(−21%) 1~2프레임에 회색 직사각형이 찍혔고, 수정본에선 변화 0(픽커는 정상 열림). **0.45초 길게 누르면(long-press 경로) 하이라이트가 안 떠 처음엔 재현 실패 — 빠른 탭(0.05초)이어야 뜬다.** 부수 효과: 칩·링크의 시스템 회색 눌림도 사라짐(각자 제 눌림색이 있다). **곁가지 — 볼 패치 색 태그 불일치도 수정**: `bowl_day_1080.mp4`는 colr 원자 없음 + VUI matrix unknown(작아서 iOS가 601로 추정 — 시뮬레이터에서 R/G 4레벨 차 실측), `bowl_night_1080.mp4`·4K `bowl_night.mp4`는 transfer=bt709(필름은 sRGB=13, 애플 파이프라인은 둘을 다르게 그린다). `ffmpeg -c copy -bsf:v h264_metadata=…` + `-color_*`로 VUI·colr 둘 다 1/13/1 재태깅(framemd5 동일 = 픽셀 무손실), 패치 URL `?v=4`. 밤 쪽 효과는 시뮬레이터가 transfer 차이를 안 그려 실기기만 안다. ffprobe stream 값과 mp4 `colr` 원자는 따로 봐야 한다.
- ✅ **★ 폰의 소리가 겹치던 이유 = iOS는 볼륨을 웹에 안 준다(09-03, ambient v6 · room2d v24)**: "모바일에서 낮이랑 밤 소리 겹침". `ambient.js`는 정글 낮·밤 두 트랙을 **함께 틀어 놓고 `audio.volume`로 크로스페이드**하는데, iOS는 재생 중인 미디어의 볼륨을 스크립트에 맡기지 않는다 — 적어 넣는 것까지는 받아 주지만 플랫폼이 곧 **1로 되돌린다**. 그래서 폰에서는 둘 다 제 소리로 동시에 울렸다. **함정**: 멈춰 있는 요소는 우리 값을 그대로 되읽어 주고(`new Audio(); v=0.5` → 0.5), 되돌림도 setter가 아니라 한 박자 뒤 플레이어 콜백에서 일어난다 — **재생 전 검사와 쓴 직후 검사는 둘 다 거짓말을 한다**. 실측(iOS 26.5 시뮬레이터, XCUITest 탭): 재생 중 `el.volume=0` → 1.2초 뒤 읽으면 `1`. 처방: 지난 틱에 쓴 값이 남아 있는지 **한 박자 뒤에 되읽어**(`audit()`) 어긋나면 `mixable=false` → 섞기를 포기하고 **지금 시간대의 것만 틀고 나머지는 `pause()`**. 두 트랙 모두 첫 제스처에서 `play()`해 잠금을 풀어 두므로, 몇 시간 뒤 밤이 와도 제스처 없이 갈아 끼워진다. 검증: 시뮬레이터에서 `mixable=false`·night `paused=true`(낮) → 테마 뒤집자 day `paused=true`, night `paused=false`·시간 진행. 데스크톱은 `mixable=true`로 크로스페이드 그대로(크로미움 실측 day 0 / night 0.3). **웹오디오는 일부러 안 썼다**: 방(room2d)이 이미 제 AudioContext를 쓰고, iOS에서 둘째 컨텍스트는 조용해질 위험이 더 크다(시뮬레이터에선 오디오 세션이 없어 `interrupted`/`suspended`로 죽어 검증 자체가 불가). **남은 값**: 폰은 볼륨이 1로 고정이라 데스크톱(VOL 0.3)보다 앰비언스가 크게 들린다 — 없애려면 m4a 두 개를 30% 진폭으로 재인코딩하고 `VOL=1`로 올리면 되지만 저장소에 84MB가 또 쌓인다.
- ✅ **폰에서는 명패를 세우지 않는다(09-03, room2d v24)**: 손끝에는 '떠남'이 없어 탭한 명패가 다음 탭까지 남았다(v22의 '바깥 탭으로 걷기'는 그 잔상에 대한 처방이었다). 이제 `pointerenter`는 `e.pointerType !== 'touch'`일 때만, 그리고 `TOUCH`(작은 화면 또는 `(hover: none)`)면 `hoverOn` 자체를 막는다. 키보드는 살렸다 — `focus`는 `:focus-visible`일 때만 명패를 띄우므로 탭으로 들어온 초점에는 안 뜨고 tab 키에는 뜬다. 물건은 각자 제 일로 답한다(방석=픽커, 볼=댕+필름, 전축=음악).


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

### 7. 프로젝트 간 SSO — 경로로 해결됨

supabase-js 기본값은 localStorage 라 origin 마다 세션이 따로 논다. 그래서 한때
`.hypnagogic.xyz` 쿠키 어댑터와 **서브도메인 통일**을 계획했으나, 2026-09-02
**경로 방식으로 결정을 바꿨다** — 프로젝트를 `hypnagogic.xyz/<path>/` 에 둔다.
origin 이 하나라 세션이 저절로 공유되고, 어댑터도 서브도메인 통일도 필요 없다.

절차와 규칙은 `docs/joining.md`. 레퍼런스 구현은 foodie-map
(`/tools/foodiemap/`). 서브도메인은 쓰지 않는다.

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
