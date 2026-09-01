# Supabase 허브 — 새 프로젝트 온보딩 가이드

이 Postgres 는 **여러 프로젝트가 공유하는 허브**다. 프로젝트마다 Supabase
인스턴스를 새로 띄우지 않고, 하나의 인스턴스에 스키마로 입주시킨다.
이 문서를 새 프로젝트 저장소에 복사해 두면 그 프로젝트의 사람/에이전트가
규칙을 알고 작업할 수 있다.

- 인스턴스: Hetzner `server01` (168.119.175.141) 의 `/root/supabase`
- API: `https://supabase.ridgelinehk.com`
- Studio: 같은 주소 `/project/default` (Kong basic auth)
- 첫 입주자이자 레퍼런스 구현: Ridgeline HK (`hk_trails` 스키마)

## 왜 이렇게 하나

인스턴스를 프로젝트마다 띄우면 7.6Gi 서버가 버티지 못하고, 무엇보다
**계정이 프로젝트마다 갈라진다.** 하나의 인스턴스를 쓰면 `auth.users` 가
하나라서 한 번 가입한 사용자가 모든 프로젝트에서 같은 계정을 쓴다.
그 대신 데이터는 스키마로 격리한다.

```
postgres (DB 하나)
├── auth          ← 모든 프로젝트가 공유하는 계정
├── storage       ← 파일 (버킷은 전역 네임스페이스, 아래 주의사항 참조)
├── public        ← 공용 영역. profiles + PostGIS. 새 테이블 금지
├── hk_trails     ← Ridgeline HK
└── <your_app>    ← 여기에 입주
```

## 규칙 3개

1. **`public` 에 새 테이블을 만들지 않는다.**
2. **프로젝트마다 `스키마 + 전용 role` 한 쌍**을 쓴다. `postgres` 슈퍼유저로
   앱을 붙이지 않는다.
3. **새 스키마는 default privileges 를 직접 정의한다.** `public` 의 설정을
   물려받지 않는다.

### 규칙 1이 중요한 이유

`public` 에는 세 겹의 암묵적 동작이 걸려 있다.

| | 내용 | 결과 |
|---|---|---|
| `search_path` | 기본값이 `"$user", public, extensions` | 스키마를 안 붙인 `create table` 이 전부 여기로 떨어짐 |
| default privileges | `anon` 에게 `arwdDxt` 자동 부여 | RLS 켜는 걸 잊으면 **익명이 읽고 쓰고 지울 수 있는** 테이블이 태어남 |
| PostgREST | 이미 노출됨 | 만드는 즉시 REST API 에 뜸 |

거기에 이름 충돌이 겹친다. `public` 에 이미 `profiles` 가 있고, `hk_trails`
에는 `comments` `notifications` `bookmarks` `feedback` `places` 처럼
누구나 또 쓸 이름이 20개 넘게 있다. 스키마를 나누면 `your_app.comments` 와
`hk_trails.comments` 가 아무 상관 없이 공존한다.

## 새 프로젝트 온보딩

### 1) 스키마와 권한

```sql
create schema your_app;
grant usage on schema your_app to anon, authenticated, service_role;

-- 미래 테이블의 기본 권한을 명시적으로 정의한다.
-- public 의 'anon=arwdDxt' 를 물려받지 않기 위함 — anon 은 읽기만.
alter default privileges in schema your_app grant select on tables to anon;
alter default privileges in schema your_app
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema your_app grant all on tables to service_role;
alter default privileges in schema your_app
  grant usage, select on sequences to anon, authenticated, service_role;
```

### 2) 전용 role

`postgres` 는 커넥션 제한도 statement timeout 도 없다. 프로젝트가 직결로
붙을 거면 반드시 자기 role 을 판다. 이 role 은 `public` 에 CREATE 권한이
없어서 **규칙 1이 구조적으로 강제된다.**

```sql
create role your_app_db login password '...' connection limit 10;
alter role your_app_db set search_path = your_app, public, extensions;
alter role your_app_db set statement_timeout = '15s';
alter role your_app_db set idle_in_transaction_session_timeout = '60s';
grant usage on schema your_app to your_app_db;
grant select, insert, update, delete on all tables in schema your_app to your_app_db;
```

`search_path` 첫 항목이 자기 스키마라 실수해도 자기 영역으로 떨어진다.
`public` 을 남겨두는 건 PostGIS(`ST_*`, `geometry`) 와 `public.profiles`
때문이다.

### 3) 테이블 — RLS 는 여전히 필수

스키마를 나눠도 `anon` 키는 공개값이다. **RLS 가 유일한 방어선이다.**

```sql
create table your_app.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

alter table your_app.notes enable row level security;
create policy "read all"   on your_app.notes for select using (true);
create policy "own writes" on your_app.notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`auth.users` 를 참조하는 FK 는 스키마를 넘어도 정상 동작한다.

### 4) PostgREST 노출

```bash
# /root/supabase/docker/.env
PGRST_DB_SCHEMAS=public,storage,graphql_public,hk_trails,your_app
```

```bash
cd /root/supabase/docker && docker compose up -d rest
```

스키마나 테이블을 바꿨는데 API 에 안 뜨면 캐시다. `NOTIFY pgrst, 'reload schema';`
또는 `rest` 재시작.

### 5) 클라이언트

```js
const supabase = createClient(URL, ANON_KEY, {
  db: { schema: 'your_app' },
});
```

직결(순수 SQL) 프로젝트라면 연결 문자열에 검색 경로를 실어 보낸다.

```js
new pg.Pool({
  connectionString: PG_CONN,
  options: '-c search_path=your_app,public,extensions',
});
```

## 걸려 넘어지는 것들

**클라이언트 하나는 스키마 하나만 본다.** `db.schema: 'your_app'` 으로
만든 클라이언트는 `public.profiles` 를 못 읽는다. 공용 프로필이 필요하면
자기 스키마에 뷰를 판다. `security_invoker = on` 이 핵심이다 — 빼면 뷰가
소유자 권한으로 돌아 원본 RLS 를 우회한다.

```sql
create view your_app.profiles with (security_invoker = on) as
  select id, full_name, avatar_url, nickname, created_at, updated_at
  from public.profiles;
```

**스토리지 버킷은 스키마로 안 나뉜다.** `storage.buckets` 의 행일 뿐이라
전역 네임스페이스다. 반드시 프로젝트 접두사를 붙인다 — `your_app-avatars`.
접두사 없는 `avatars` 는 이미 Ridgeline HK 가 쓰고 있다.

**`SECURITY DEFINER` 함수의 `search_path` 를 고정한다.** 고정을 안 하면
호출자 경로에 의존하고, `public` 으로 박아두면 나중에 테이블이 움직일 때
`relation does not exist` 로 죽는다. (022 마이그레이션에서 실제로
`claim_transcode_job` 과 `notify_*` 4개가 이 문제로 걸렸다.)

```sql
alter function your_app.fn(...) set search_path = your_app, public, extensions;
```

**`postgres` 는 이 인스턴스에서 슈퍼유저가 아니다** (`rolsuper = f`).
스키마 이동이나 소유권 변경 같은 DDL 은 `supabase_admin` 으로 실행해야
한다.

```bash
docker exec -i supabase-db psql -U supabase_admin -v ON_ERROR_STOP=1 < migration.sql
```

**마이그레이션은 반드시 드라이런한다.** Postgres 는 DDL 도 트랜잭션이라
`commit;` 을 `rollback;` 으로 바꿔 실행하면 실제 검증이 된다. 소유권 문제나
오타가 여기서 다 잡힌다.

## 공용 자원 — 건드리지 말 것

| 대상 | 위치 | 비고 |
|---|---|---|
| 계정 | `auth.users` | 모든 프로젝트 공유. 직접 INSERT/DELETE 금지 |
| 프로필 | `public.profiles` | 공용 신원. 컬럼 추가는 전체 영향 |
| 가입 트리거 | `public.handle_new_user()` | **가입 트랜잭션 안에서 돈다. 여기서 실패하면 모든 프로젝트의 회원가입이 동시에 죽는다** |
| PostGIS | `public` | 확장. 이동 금지 |

`public.profiles` 에 `NOT NULL` 컬럼을 추가하는 것이 가장 흔한 사고 경로다.
프로젝트 고유 필드는 자기 스키마에 별도 테이블로 두고 `profiles.id` 를
FK 로 참조한다.

## 운영

```bash
# 백업
docker exec supabase-db pg_dump -U postgres --no-owner --clean --if-exists \
  -d postgres > /root/backups/supabase-hub-$(date +%Y%m%d-%H%M%S).sql

# 현재 입주 현황
docker exec supabase-db psql -U postgres -c "\dn"

# 커넥션 사용량 (max_connections = 100)
docker exec supabase-db psql -U postgres -c \
  "select usename, count(*) from pg_stat_activity group by 1 order by 2 desc"
```

## 알려진 미해결 이슈

- **SMTP 가 가짜다.** `SMTP_HOST=supabase-mail` 인데 그 컨테이너가 없다.
  이메일 가입 / 비밀번호 재설정 / 매직링크가 전부 무응답이고 Google OAuth
  만 동작한다. 로그인이 필요한 프로젝트를 붙이기 전에 실제 SMTP 를 연결하거나
  `ENABLE_EMAIL_AUTOCONFIRM=true` 로 열어야 한다.
- 컨테이너 메모리 제한이 없다. 한 프로젝트가 폭주하면 같은 서버의 다른
  Supabase 인스턴스까지 OOM 으로 같이 죽는다.
- 스토리지 버킷에 용량 제한이 없다 (`FILE_SIZE_LIMIT` 미설정).
- 정기 백업 크론이 없다.
