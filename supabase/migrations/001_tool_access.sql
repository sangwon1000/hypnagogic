-- Invite-only access to hypnagogic.xyz/tools.
--
-- Google sign-in gets you an account (the hub's auth.users is shared by every
-- project); an invite code gets you through the door. The code itself never
-- reaches the browser — redeem_invite() runs as definer and is the only thing
-- that can read the code table or write an access row.
--
-- Run as supabase_admin:
--   docker exec -i supabase-db psql -U supabase_admin -v ON_ERROR_STOP=1 < 001_tool_access.sql

begin;

-- who may open the tools
create table portfolio.tool_access (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  via_code   text
);

create table portfolio.invite_code (
  code       text primary key,
  note       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- A short code is guessable, and anyone with a Google account can call the
-- function, so cap the tries per account.
create table portfolio.invite_attempt (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fails   integer not null default 0,
  last_at timestamptz not null default now()
);

alter table portfolio.tool_access    enable row level security;
alter table portfolio.invite_code    enable row level security;
alter table portfolio.invite_attempt enable row level security;

-- You may see that YOU have access, and nothing else. There is deliberately no
-- insert policy: redeem_invite() is the only way a row is ever created.
create policy "read own" on portfolio.tool_access for select using (auth.uid() = user_id);

-- invite_code and invite_attempt carry no policies at all — with RLS on and no
-- policy, PostgREST sees zero rows even if the grants were ever loosened.
revoke all on portfolio.invite_code    from anon, authenticated;
revoke all on portfolio.invite_attempt from anon, authenticated;

create function portfolio.redeem_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = portfolio, public, extensions
as $$
declare
  uid   uuid := auth.uid();
  fails integer;
  cap   constant integer := 10;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'signed_out');
  end if;
  if exists (select 1 from portfolio.tool_access where user_id = uid) then
    return jsonb_build_object('ok', true, 'reason', 'already');
  end if;

  insert into portfolio.invite_attempt (user_id) values (uid) on conflict do nothing;
  select a.fails into fails from portfolio.invite_attempt a where a.user_id = uid;
  if fails >= cap then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  if not exists (select 1 from portfolio.invite_code
                 where code = btrim(p_code) and active) then
    update portfolio.invite_attempt
       set fails = fails + 1, last_at = now()
     where user_id = uid;
    return jsonb_build_object('ok', false, 'reason', 'bad_code', 'left', cap - fails - 1);
  end if;

  insert into portfolio.tool_access (user_id, via_code)
       values (uid, btrim(p_code)) on conflict do nothing;
  delete from portfolio.invite_attempt where user_id = uid;
  return jsonb_build_object('ok', true, 'reason', 'granted');
end;
$$;

revoke all on function portfolio.redeem_invite(text) from public, anon;
grant execute on function portfolio.redeem_invite(text) to authenticated;

-- Readable by other schemas' RLS policies (foodie_map uses it). Definer, so it
-- works without granting anyone access to tool_access itself.
create function portfolio.has_tool_access()
returns boolean
language sql
stable
security definer
set search_path = portfolio, public, extensions
as $$ select exists (select 1 from portfolio.tool_access where user_id = auth.uid()) $$;

grant execute on function portfolio.has_tool_access() to anon, authenticated;

insert into portfolio.invite_code (code, note) values ('1000', 'family & friends');

commit;
