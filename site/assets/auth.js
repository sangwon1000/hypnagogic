/* 계정 — 여러 프로젝트가 공유하는 허브 auth(supabase.ridgelinehk.com)에 구글로 들어온다.
   로그인하면 명상 기록이 DB(portfolio.meditation_sessions)와 양방향으로 맞춰지고,
   익명이면 지금처럼 localStorage('am-log')에만 남는다. RLS가 유일한 방어선 —
   ANON 키는 공개값이다. 규칙은 docs/supabase-hub.md 참조. */
(function () {
  'use strict';
  if (!window.supabase) return;                    // 벤더 스크립트가 없으면 익명 모드로 침묵

  var API = 'https://auth.hypnagogic.xyz';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc2OTkwNjUyLCJleHAiOjIwOTIzNTA2NTJ9.25ujMBTJaoL7XGpcJ7sUomjkfxMLDkhNaD_7zxSU2No';
  var TABLE = 'meditation_sessions';

  var sb = window.supabase.createClient(API, ANON, {
    db: { schema: 'portfolio' },
    auth: { flowType: 'pkce' },
  });
  var me = null;

  /* ── am-log ↔ DB 변환 — session.js 의 엔트리 모양 {date,minutes,secs,track,ts} 그대로 ── */
  function loadLog() { try { return JSON.parse(localStorage.getItem('am-log')) || []; } catch (e) { return []; } }
  function saveLog(v) { try { localStorage.setItem('am-log', JSON.stringify(v)); } catch (e) {} }
  function rowToEntry(r) {
    return { date: r.sat_on, minutes: r.minutes, secs: r.secs, track: r.track || undefined, ts: new Date(r.logged_at).getTime() };
  }
  function entryToRow(e) {
    return { user_id: me.id, sat_on: e.date, minutes: e.minutes, secs: e.secs || 0, track: e.track || null, logged_at: new Date(e.ts).toISOString() };
  }

  /* ── 양방향 동기화: 다른 기기의 기록은 내려받고, 이 기기에만 있는 기록은 올린다.
     ts(=logged_at)가 자연키 — 서버 unique(user_id, logged_at)라 몇 번을 돌려도 안전 ── */
  var syncing = false;
  function sync() {
    if (!me || syncing) return;
    syncing = true;
    sb.from(TABLE).select('sat_on,minutes,secs,track,logged_at').then(function (res) {
      if (res.error) { syncing = false; return; }
      var local = loadLog();
      var haveLocal = {};
      local.forEach(function (e) { haveLocal[e.ts] = 1; });
      var added = 0;
      var haveDb = {};
      res.data.forEach(function (r) {
        var e = rowToEntry(r);
        haveDb[e.ts] = 1;
        if (!haveLocal[e.ts]) { local.push(e); added++; }
      });
      if (added) {
        local.sort(function (a, b) { return a.ts - b.ts; });
        saveLog(local);
        document.dispatchEvent(new Event('am-log-sync'));  // 히트맵 갱신 신호
      }
      var up = local.filter(function (e) { return !haveDb[e.ts]; }).map(entryToRow);
      var done = function () { syncing = false; };
      if (up.length) {
        sb.from(TABLE).upsert(up, { onConflict: 'user_id,logged_at', ignoreDuplicates: true }).then(done, done);
      } else done();
    }, function () { syncing = false; });
  }

  /* 세션이 끝날 때 session.js 가 부른다 — 익명이면 조용히 무시 */
  function push(entry) {
    if (!me) return;
    sb.from(TABLE).upsert([entryToRow(entry)], { onConflict: 'user_id,logged_at', ignoreDuplicates: true })
      .then(function () {}, function () {});
  }

  /* ── 칩 — session.js 의 .s3-nav(log·sound 옆)에 하나 더 ── */
  var chip = null;
  function chipText() {
    if (!me) return 'sign in';
    var n = (me.user_metadata && (me.user_metadata.name || me.user_metadata.full_name)) || me.email || '';
    return String(n).split(/[@\s]/)[0].toLowerCase() || 'me';
  }
  function renderChip() {
    if (!chip) {
      var nav = document.querySelector('.s3-nav');
      if (!nav) return;
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 's3-chip s3-navauth';
      chip.addEventListener('click', function () {
        if (me) { if (confirm('sign out?')) sb.auth.signOut(); }
        else sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      });
      nav.appendChild(chip);
    }
    chip.textContent = chipText();
    chip.setAttribute('aria-pressed', me ? 'true' : 'false');
    chip.title = me ? (me.email || '') : 'google sign in';
  }

  sb.auth.onAuthStateChange(function (_ev, session) {
    me = session ? session.user : null;
    renderChip();
    if (me) sync();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderChip);
  else renderChip();

  /* 디버그·확장용 손잡이 */
  window.__amAuth = {
    sb: sb,
    user: function () { return me; },
    push: push,
    sync: sync,
  };
})();
