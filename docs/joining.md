# 입주 가이드 — hypnagogic.xyz 에 경로로 들어오기

도메인은 하나, 경로마다 다른 저장소·다른 컨테이너다. 저장소를 합치지 않는다.

```
hypnagogic.xyz/                   → hypnagogic          현관 (검은 화면에 문 두 개)
hypnagogic.xyz/room/              → hypnagogic          명상방
hypnagogic.xyz/tools/             → hypnagogic          도구 목록
hypnagogic.xyz/tools/foodiemap/   → foodie-map          ← 레퍼런스 구현
```

계정·DB 규칙은 여기 없다 → `docs/supabase-hub.md`. 이 문서는 **라우팅과 배포**만 다룬다.

## 왜 경로인가 (서브도메인이 아니라)

`*.hypnagogic.xyz` 와일드카드 DNS 가 이미 있어서 서브도메인이 더 쉽다. 그런데도
경로를 쓰는 이유는 하나다 — **로그인이 저절로 공유된다.**

supabase-js 는 세션 저장 키를 API 호스트에서 유도한다:

```js
let i = `sb-${r.hostname.split('.')[0]}-auth-token`   // supabase-js 2.112.4
```

`https://auth.hypnagogic.xyz` → `sb-auth-auth-token`. 모든 프로젝트가 같은 키를
유도하고, 경로 방식은 origin 이 하나라 localStorage 도 한 통이다. 즉 현관에서
로그인하면 `/tools/foodiemap/` 은 이미 로그인 상태다 — OAuth 왕복도, 설정도 없다.

서브도메인이면 origin 이 갈려 세션이 따로 놀고, `.hypnagogic.xyz` 쿠키 어댑터를
손으로 붙여야 겨우 비슷해진다. 토큰이 쿠키로 나가 노출면도 넓어진다.

덤: 인증서 한 장을 경로들이 같이 쓴다. 서브도메인은 도메인마다 발급이다.

## 붙이는 절차

### 0) slug 를 정한다

한 번 정하면 이미지·설정·URL 세 군데에 박히니 먼저 정한다. 현관의 메뉴에서
어느 문 아래 설지도 같이 정한다 (`/tools/<slug>/` 처럼).

**루트 저장소 `site/` 에 slug 와 같은 이름의 디렉터리를 만들면 안 된다.**
Traefik 이 먼저 가로채서 영원히 안 보이는 파일이 된다.

### 1) 프리픽스를 이미지에 굽는다 ★ 여기가 핵심

Traefik 미들웨어로 프리픽스를 벗기지(`stripPath`) 않는다. **앱이 처음부터
공개 URL 그대로의 경로에서 산다.** 움직이는 부품이 하나 줄고, nginx 의
`try_files` 가 브라우저가 실제로 묻는 URL 과 일치한다.

세 군데를 맞춘다 (foodie-map 실물):

```ts
// vite.config.ts — 자산 URL 과 import.meta.env.BASE_URL 이 프리픽스를 진다.
// dev 는 "/" 로 둬서 localhost 가 그대로 돌게 한다.
base: command === "build" ? "/tools/foodiemap/" : "/",
```

```dockerfile
# Dockerfile — 공개 URL 을 그대로 흉내내어 굽는다
COPY --from=build /app/dist /usr/share/nginx/html/tools/foodiemap
```

```nginx
# nginx.conf — 프리픽스 없는 요청을 슬래시로 정리하고, SPA 폴백도 프리픽스로
location = /tools/foodiemap { return 301 /tools/foodiemap/; }
location /tools/foodiemap/ {
    add_header Cache-Control "no-cache";
    try_files $uri $uri/ /tools/foodiemap/index.html;
}
location /tools/foodiemap/assets/ {          # Vite 가 해시를 박으니 영원히 물어도 된다
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

캐시 규칙은 루트 앱과 같은 원칙이다 — **문서는 항상 재검증, 해시 박힌 자산은
길게.** 문서가 낡으면 그 안에 적힌 자산 해시가 전부 같이 낡는다.

### 2) Dokploy 에 앱을 만든다

대시보드가 아니라 REST (`x-api-key`). 기존 자원을 재사용한다:

| | |
|---|---|
| project | `hxA1TXMbE8kRImnlnbwDm` (`hypnagogic`) |
| environment | `30ubwq_UvmUUbahdGbBav` |
| githubId | `2SldEdN316fFz6Bn_bviJ` (공유) |
| 레퍼런스 앱 | `hypnagogic-room`, `mountain-viewer-cg9aga` |

```
application.create(environmentId)
→ application.saveGithubProvider(owner/repository/branch/githubId/buildPath)
→ application.saveBuildType(buildType=dockerfile, dockerfile="Dockerfile",
                            herokuVersion·railpackVersion 필수)
→ domain.create(host="hypnagogic.xyz", path="/tools/foodiemap", port=80,
                https=true, certificateType="letsencrypt", stripPath=false)
→ application.deploy
```

`path` 와 `stripPath` 는 Dokploy 도메인의 정식 필드다 (`internalPath` 도 있다).
Traefik 라우터 우선순위는 규칙 길이로 정해지는데
``Host(`hypnagogic.xyz`) && PathPrefix(`/tools/foodiemap`)`` 가
``Host(`hypnagogic.xyz`)`` 보다 길다 — **루트 앱은 손대지 않아도 진다.**

빌드 시 주입할 값이 있으면(Vite 는 빌드타임에 인라인한다) Dokploy 빌드 args 로
넘긴다. `.env` 를 이미지에 굽지 않는다.

`www.hypnagogic.xyz` 는 루트 앱만 물고 있다. 하위 앱까지 www 로 열려면
`domain.create` 를 www 호스트로 한 번 더 한다. 안 해도 apex 는 정상이다.

### 3) 확인

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://hypnagogic.xyz/tools/<slug>/
curl -sI https://hypnagogic.xyz/tools/<slug>/ | grep -i cache-control
curl -s -o /dev/null -w '%{http_code}\n' https://hypnagogic.xyz/          # 현관 무사한지
```

## origin 하나를 나눠 쓰는 대가

로그인이 공짜로 공유되는 대가로, 브라우저가 보기엔 전부 한 사이트다.

**localStorage 키에 반드시 `<slug>:` 접두어를 붙인다.** 방이 `am-log` 같은 짧은
키를 이미 쓰고 있어서, 겹치면 조용히 서로 덮어쓴다. 디버깅이 지옥이 된다.

**`window` 전역과 커스텀 이벤트 이름도 마찬가지다.** 같은 문서에 두 앱이 동시에
뜨는 일은 없지만(경로마다 문서가 따로다), 루트 앱의 스크립트를 불러 쓰면 섞인다.

거꾸로, 같은 origin 이라 **하위 앱이 루트 앱의 파일을 그냥 불러 쓸 수 있다**:

```html
<script src="/assets/vendor/supabase-2.js"></script>
```

Traefik 이 `/assets/` 는 루트 앱으로 보낸다. 벤더 라이브러리를 저장소마다
복사하지 않아도 된다 — 대신 루트 저장소가 공용 라이브러리 노릇을 하는 결합이
생기니, 정말 공용인 것만 여기서 나른다.

## 로그인을 붙인다면

`docs/supabase-hub.md` 의 스키마·RLS 규칙을 먼저 읽는다. 그 위에 경로 방식이
얹는 규칙은 세 개인데, **셋 다 어기면 "같은 서버, 같은 DB 인데 로그인은 따로
노는" 최악의 상태가 된다.**

1. **API URL 은 `https://auth.hypnagogic.xyz` 여야 한다.** `supabase.ridgelinehk.com`
   을 쓰면 세션 키가 `sb-supabase-auth-token` 으로 유도돼 완전히 딴 세션이 된다.
   같은 Kong 을 가리키는데도 그렇다.
2. **`storageKey` 를 직접 지정하지 않는다.** 덮어쓰는 순간 격리된다.
3. **한 문서에 `createClient` 는 한 번만.** 두 번이면 `Multiple GoTrueClient
   instances` 경고와 함께 토큰 갱신이 엉킨다.

리다이렉트는 `redirectTo: location.origin + location.pathname` 으로 두면 된다.
허용목록에 `https://hypnagogic.xyz/**` 가 있어 어느 경로에서 눌러도 그 자리로
돌아온다. 새 경로를 위해 GoTrue 설정을 고칠 일은 없다.

로그아웃은 전역이다 — 한 곳에서 `signOut()` 하면 전 프로젝트가 풀린다.

## 서버 예산

Hetzner `server01` 7.6Gi 에 Supabase 인스턴스가 4개 돈다. 여유는 3.7Gi 남짓이고
swap 을 이미 1.5Gi 쓰고 있다.

- **정적 사이트(nginx alpine)** — 컨테이너당 10MB 수준. 몇 개를 붙이든 무의미하다.
- **Node/Python 백엔드** — 프로젝트당 100~300MB. 붙이기 전에 `free -h` 를 본다.

미디어가 무거운 프로젝트는 저장소에 파일을 넣지 말고 허브 Supabase storage 를
쓴다. 이 저장소가 커밋 10개에 `.git` 106MB 인 게 그 교훈이다.

## 새 저장소의 CLAUDE.md

규칙을 복사하지 말고 가리킨다. 복사하면 반드시 갈라진다.

```markdown
이 프로젝트는 hypnagogic.xyz/tools/<slug>/ 에 입주한다.
정본은 아래 둘이고, 여기에 복붙하지 않는다.
- 라우팅·배포: github.com/sangwon1000/hypnagogic/blob/main/docs/joining.md
- 계정·DB:     github.com/sangwon1000/hypnagogic/blob/main/docs/supabase-hub.md

절대 규칙
1. 빌드 산출물은 /tools/<slug>/ 아래로 굽는다 (stripPath 를 쓰지 않는다)
2. localStorage 키는 전부 `<slug>:` 접두어 — origin 을 현관과 공유한다
3. Supabase API URL 은 https://auth.hypnagogic.xyz — 다른 걸 쓰면 로그인이 갈린다
4. public 스키마에 테이블 금지. 전용 스키마 + RLS
```

## 체크리스트

- [ ] slug 를 정했고, 루트 `site/` 에 같은 이름이 없다
- [ ] vite `base` · Dockerfile COPY 목적지 · nginx location 세 군데가 같은 프리픽스
- [ ] `stripPath` 는 false
- [ ] 문서는 `no-cache`, 해시 박힌 자산은 `immutable`
- [ ] localStorage 키에 `<slug>:` 접두어
- [ ] (로그인 쓴다면) API URL 이 `auth.hypnagogic.xyz`, `storageKey` 미지정
- [ ] 배포 후 하위 경로와 **현관** 둘 다 200
