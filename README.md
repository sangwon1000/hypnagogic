# hypnagogic

명상방 하나가 곧 사이트다 — https://hypnagogic.xyz

- `site/` — 배포되는 전부. 4K 필름 롤 두 개(밤낮 전환)와 풀프레임 타격 패치,
  반딧불 루프, 세션 타이머와 기록 히트맵.
- 계정은 공유 허브(auth) 하나를 쓴다. 구글 로그인 → 명상 기록이
  `portfolio.meditation_sessions` 와 양방향 동기화. 익명은 localStorage 로만.
  허브 규칙: `docs/supabase-hub.md` · 런칭 절차: `HANDOFF.md`

## 로컬

```bash
python3 site/tools/serve.py 4173 site
```

`http.server` 는 Range 를 몰라 비디오 시킹이 죽는다 — 반드시 serve.py.
(4173 = 실사용 origin. localStorage 기록이 이 포트에 묶여 있다.)

## 배포

Dokploy 가 이 저장소의 `Dockerfile` 을 빌드한다 (nginx 정적 서빙).
git push → 자동 빌드. 도메인 `hypnagogic.xyz` 는 Traefik 이 물고 있다.
