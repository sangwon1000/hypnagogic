/* ── 세션 흐름 — 3a 시간 고르기 → 3b 앉기 → 3c 기록 ──────────
   스펙: design_handoff_meditation_room/README.md (high-fidelity).
   방(스틸)은 room2d.js가 몸을 빌려준다: __am.sit()/rise()/bowl()/music()/musicToggle().
   여기는 세션 상태·타이머·기록(localStorage 'am-log')만 쥔다.
   방석 클릭은 'am-sit' 이벤트로 들어온다. */
(function () {
  'use strict';
  var am = function () { return window.__am || null; };

  /* ── 저장 ── */
  var PRESETS = [5, 10, 20, 45];                          // 마지막 선택이 맨 앞에 서고, 그 뒤로 프리셋·커스텀
  function loadLen() {
    var v = null; try { v = localStorage.getItem('am-len'); } catch (e) {}
    var n = parseInt(v, 10);
    return (n >= 1 && n <= 600) ? n : 10;                 // 옛 'inf' 값도 여기서 10으로 순치
  }
  function saveLen(v) { try { localStorage.setItem('am-len', String(v)); } catch (e) {} }
  function loadCustom() {
    var v = null; try { v = localStorage.getItem('am-len-custom'); } catch (e) {}
    var n = parseInt(v, 10);
    return (n >= 1 && n <= 600) ? n : 25;
  }
  function saveCustom(n) { try { localStorage.setItem('am-len-custom', String(n)); } catch (e) {} }
  function loadLog() { try { return JSON.parse(localStorage.getItem('am-log')) || []; } catch (e) { return []; } }
  function saveLog(v) { try { localStorage.setItem('am-log', JSON.stringify(v)); } catch (e) {} }

  /* 옛 향 타이머의 기록 인수 — hyang-log [{d:'YYYY-MM-DD', m:분}] → am-log, 딱 한 번.
     원본 키는 지우지 않는다 — 이용자 브라우저에 남은 옛 기록의 백업이니까. */
  (function migrateHyang() {
    try {
      if (localStorage.getItem('am-log-migrated')) return;
      var old = JSON.parse(localStorage.getItem('hyang-log') || 'null');
      if (Array.isArray(old) && old.length) {
        var add = [];
        old.forEach(function (o) {
          if (!o || !o.d || !(o.m >= 1)) return;
          var mins = Math.round(o.m);
          add.push({ date: o.d, minutes: mins, secs: mins * 60, track: 'incense', ts: new Date(o.d + 'T12:00:00').getTime() });
        });
        if (add.length) saveLog(add.concat(loadLog()));
      }
      localStorage.setItem('am-log-migrated', '1');
    } catch (e) {}
  })();

  var S = {
    len: loadLen(),
    phase: 'idle',            // idle | settle | running | paused | complete
    startedAt: 0, pausedAt: 0, pausedTotal: 0,
    range: 'year',            // year | month
    filter: null,             // 'YYYY-MM-DD' — 칸을 눌러 목록을 거른다
    order: null,              // 픽커가 열릴 때 굳는 알약 줄 서기 — 열려 있는 동안은 안 움직인다
    customOpen: false,        // 커스텀 입력이 펼쳐져 있나
  };

  /* ── 시간 유틸 ── */
  function dkey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function md(k) { return new Date(k + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : String(m)) + ':' + (s < 10 ? '0' : '') + s;
  }
  function durText(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + 'h ' + m + 'm' : m + 'm';
  }
  function relDay(k) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var d = new Date(k + 'T00:00:00');
    var diff = Math.round((t - d) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'yesterday';
    return d.getFullYear() === t.getFullYear() ? md(k) : md(k) + ', ' + d.getFullYear();
  }
  function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  /* ── DOM ── */
  var root = document.createElement('div');
  root.className = 's3';
  root.innerHTML =
    '<div class="s3a" aria-label="pick a time">' +
      '<div class="s3a-back"></div>' +                 // 알약 바깥 아무 데나 — 고르지 않기로 하는 길
      '<div class="s3a-scrim"></div>' +
      '<div class="s3a-stack">' +
        '<div class="s3-eyebrow">how long will you sit</div>' +
        '<div class="s3a-pills" role="group" aria-label="session length"></div>' +
        '<button type="button" class="s3a-begin">begin</button>' +
      '</div>' +
      '<div class="s3a-hint">press the record<br>to start music</div>' +
    '</div>' +
    '<div class="s3b" aria-label="counting down">' +
      '<div class="s3b-scrim"></div>' +
      '<div class="s3b-state">sitting</div>' +
      '<div class="s3b-controls">' +
        '<button type="button" class="s3b-pause" aria-label="pause">❚❚</button>' +
        '<button type="button" class="s3b-end">end</button>' +
      '</div>' +
      '<div class="s3b-ring"></div>' +
      '<div class="s3b-center">' +
        '<div class="s3b-timer" role="timer"></div>' +
        '<div class="s3b-breath"><span class="bi">breathe in</span><span class="bo">breathe out</span><span class="bs">settle in</span></div>' +
      '</div>' +
      '<div class="s3b-np" hidden>' +
        '<div class="s3b-np-disc"><i></i></div>' +
        '<span class="s3b-np-title"></span>' +
        '<span class="s3b-np-sep">|</span>' +
        '<span class="s3b-np-vol"></span>' +
      '</div>' +
    '</div>' +
    '<div class="s3c" aria-label="practice log">' +
      '<div class="s3c-inner">' +
        '<div class="s3c-complete">' +
          '<div class="s3c-c-eyebrow">you sat for</div>' +
          '<div class="s3c-c-time">00:00</div>' +
          '<div class="s3c-c-stats">' +
            '<div class="st"><b class="cn">0</b><i>sittings</i></div>' +
            '<div class="div"></div>' +
            '<div class="st"><b class="ct">0m</b><i>total</i></div>' +
            '<div class="div"></div>' +
            '<div class="st hot"><b class="cs">0</b><i>streak</i></div>' +
          '</div>' +
          '<div class="s3c-c-btns">' +
            '<button type="button" class="s3c-again">sit again</button>' +
            '<button type="button" class="s3c-back">back to room</button>' +
          '</div>' +
        '</div>' +
        '<div class="s3c-loglabel"><span class="l">log — days sat</span><span class="r">last 12 months</span></div>' +
        '<div class="s3c-head">' +
          '<div><div class="s3c-title"></div><div class="s3c-sub"></div></div>' +
          '<div class="s3c-range">' +
            '<button type="button" class="s3-chip" data-range="year" aria-pressed="true">year</button>' +
            '<button type="button" class="s3-chip" data-range="month" aria-pressed="false">month</button>' +
          '</div>' +
        '</div>' +
        '<div class="s3c-heat">' +
          '<div class="s3c-months"></div>' +
          '<div class="s3c-grid"></div>' +
          '<div class="s3c-legend"><span>less</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>more</span></div>' +
        '</div>' +
        '<div class="s3c-list"></div>' +
      '</div>' +
    '</div>' +
    '<div class="s3-nav">' +
      '<button type="button" class="s3-chip s3-navlog" aria-pressed="false">log</button>' +
      '<button type="button" class="s3-chip s3-navsound" aria-pressed="false">sound</button>' +
    '</div>' +
    '<div class="s3-tip" hidden></div>';
  document.body.appendChild(root);

  var $ = function (s) { return root.querySelector(s); };
  var pillsEl = $('.s3a-pills'), beginBtn = $('.s3a-begin');
  var stateEl = $('.s3b-state'), pauseBtn = $('.s3b-pause'), endBtn = $('.s3b-end');
  var timerEl = $('.s3b-timer'), bIn = $('.s3b-breath .bi'), bOut = $('.s3b-breath .bo'), bSet = $('.s3b-breath .bs');
  var np = $('.s3b-np'), npTitle = $('.s3b-np-title'), npVol = $('.s3b-np-vol');
  var titleEl = $('.s3c-title'), subEl = $('.s3c-sub');
  var monthsEl = $('.s3c-months'), gridEl = $('.s3c-grid'), listEl = $('.s3c-list');
  var cTime = $('.s3c-c-time'), cN = $('.cn'), cT = $('.ct'), cS = $('.cs');
  var logChip = $('.s3-navlog'), soundChip = $('.s3-navsound');
  var tip = $('.s3-tip');

  /* 다른 기기 기록이 동기화로 내려오면(auth.js) 열려 있는 히트맵을 새로 그린다 */
  document.addEventListener('am-log-sync', function () {
    if (document.body.dataset.s3 === 'log') renderLog();
  });

  /* ── 화면 전환 ── */
  function setView(v) {
    document.body.dataset.s3 = v;
    logChip.setAttribute('aria-pressed', v === 'log' ? 'true' : 'false');
  }

  /* ── 3a 시간 알약 ── */
  function pillOrder() { return [S.len].concat(PRESETS.filter(function (p) { return p !== S.len; })); }
  function renderPills() {
    pillsEl.textContent = '';
    var order = S.order || pillOrder();
    var custom = S.customOpen || order.indexOf(S.len) < 0;   // 입력이 펼쳐졌거나, 줄에 없는 값이면 커스텀 차례
    order.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 's3-pill';
      var sel = v === S.len && !custom;
      b.setAttribute('aria-pressed', sel ? 'true' : 'false');
      b.textContent = sel ? v + ' min' : String(v);       // 고른 것만 단위를 입는다
      b.addEventListener('click', function () { S.customOpen = false; S.len = v; saveLen(v); renderPills(); });
      pillsEl.appendChild(b);
    });
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 's3-pill';
    b.setAttribute('aria-pressed', custom ? 'true' : 'false');
    if (custom) {
      var inp = document.createElement('input');
      inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
      inp.value = S.len;
      inp.style.width = Math.max(2, String(S.len).length) + 'ch';
      inp.setAttribute('aria-label', 'custom minutes');
      inp.addEventListener('input', function () {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 3);
        inp.style.width = Math.max(2, inp.value.length) + 'ch';
        var n = parseInt(inp.value, 10);
        if (n >= 1 && n <= 600) { S.len = n; saveLen(n); saveCustom(n); }
      });
      inp.addEventListener('blur', function () {          // 빈 채로 떠나면 마지막 유효값으로
        var n = parseInt(inp.value, 10);
        if (!(n >= 1 && n <= 600)) { inp.value = S.len; inp.style.width = Math.max(2, String(S.len).length) + 'ch'; }
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
      var unit = document.createElement('span');
      unit.textContent = ' min';
      b.append(inp, unit);
    } else b.textContent = 'custom';
    b.addEventListener('click', function () {
      if (custom) return;                                 // 이미 열려 있으면 입력이 알아서
      S.customOpen = true;
      S.len = loadCustom(); saveLen(S.len);
      renderPills();
      var f = pillsEl.querySelector('input');
      if (f) { f.focus(); f.select(); }
    });
    pillsEl.appendChild(b);
  }

  /* ── 타이머 — 시작 시각 기준, 흘러도 어긋나지 않게 ── */
  var tickIv = 0, pollIv = 0, breathNow = '';
  function elapsedSec() {
    var end = S.phase === 'paused' ? S.pausedAt : Date.now();
    return Math.max(0, (end - S.startedAt - S.pausedTotal) / 1000);
  }
  function drawTime(el, str) {
    if (el.dataset.t === str) return;
    el.dataset.t = str;
    el.textContent = '';
    for (var i = 0; i < str.length; i++) {
      var sp = document.createElement('span');
      if (str[i] === ':') sp.className = 'c';
      sp.textContent = str[i];
      el.appendChild(sp);
    }
  }
  function tickTimer() {
    if (S.phase === 'settle') {                           // 예비 숨 고르기 — 10 9 8 … 그리고 딩
      var n = SETTLE - Math.floor((Date.now() - S.settleT0) / 1000);
      if (n <= 0) { startRun(); return; }
      drawTime(timerEl, String(n));
      return;
    }
    var e = elapsedSec();
    var rem = S.len * 60 - e;
    if (rem <= 0) { finish(true); return; }
    drawTime(timerEl, fmt(Math.ceil(rem)));
    if (S.phase === 'running') {
      var bp = (e % 10) < 4 ? 'in' : 'out';               // 링과 같은 10초 호흡 — 4초 들숨, 6초 날숨
      if (bp !== breathNow) {
        breathNow = bp;
        bIn.classList.toggle('on', bp === 'in');
        bOut.classList.toggle('on', bp === 'out');
      }
    }
  }

  /* ── 화면 꺼짐 방지 — 앉아 있는 동안만 ── */
  var wl = null;
  function lockScreen() {
    if (!('wakeLock' in navigator) || wl) return;
    navigator.wakeLock.request('screen').then(function (l) {
      wl = l;
      l.addEventListener('release', function () { wl = null; });
    }).catch(function () { wl = null; });
  }
  function unlockScreen() { try { if (wl) wl.release(); } catch (e) {} wl = null; }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && S.phase === 'running') lockScreen();
  });

  /* ── 세션 ── */
  var SETTLE = 10;                                        // 시작 전 열 셈 — 자리에 몸이 앉는 시간
  function begin() {
    if (S.phase === 'running' || S.phase === 'paused' || S.phase === 'settle') return;
    S.phase = 'settle';
    S.settleT0 = Date.now();
    breathNow = '';
    bIn.classList.remove('on'); bOut.classList.remove('on'); bSet.classList.add('on');
    drawTime(timerEl, String(SETTLE));
    stateEl.textContent = 'sitting';
    pauseBtn.textContent = '❚❚'; pauseBtn.setAttribute('aria-label', 'pause');
    document.body.classList.remove('s3-paused');
    setView('sitting');
    shedComplete();                                       // sit again으로 왔다면 — 완결 화면이 조용히 물러난 뒤 벗는다
    var A = am(); if (A) A.sit();
    clearInterval(tickIv); tickIv = setInterval(tickTimer, 250);
    tickTimer();
    lockScreen();
  }
  function startRun() {                                   // 딩 — 여기부터가 앉음이다
    S.phase = 'running';
    S.startedAt = Date.now(); S.pausedTotal = 0;
    var A = am(); if (A) A.bowl();
    bSet.classList.remove('on'); bIn.classList.add('on');
    breathNow = 'in';
    drawTime(timerEl, fmt(S.len * 60));
  }
  function pauseToggle() {
    if (S.phase === 'running') {
      S.phase = 'paused'; S.pausedAt = Date.now();
      document.body.classList.add('s3-paused');
      stateEl.textContent = 'paused';
      pauseBtn.textContent = '▶'; pauseBtn.setAttribute('aria-label', 'resume');
      unlockScreen();
    } else if (S.phase === 'paused') {
      S.pausedTotal += Date.now() - S.pausedAt;
      S.phase = 'running';
      document.body.classList.remove('s3-paused');
      stateEl.textContent = 'sitting';
      pauseBtn.textContent = '❚❚'; pauseBtn.setAttribute('aria-label', 'pause');
      lockScreen();
    }
  }
  function trackName() {
    var A = am();
    var m = A && A.music();
    if (m && m.on && m.title) return trunc(m.title, 28);
    var b = A && A.amb();
    if (b && b.unlocked) return 'ambience';
    return 'silence';
  }
  function finish(natural) {
    var e = Math.round(elapsedSec());
    clearInterval(tickIv); tickIv = 0;
    unlockScreen();
    S.phase = 'complete';
    document.body.classList.remove('s3-paused');
    if (natural) {                                        // 시간이 다 차면 종이 세 번 — 옛 향 타이머의 마침 템포(0·6·12초) 그대로
      var A = am();
      if (A) { A.bowl(); setTimeout(A.bowl, 6000); setTimeout(A.bowl, 12000); }
    }
    if (e >= 60) {                                        // 1분 미만은 앉았다 치지 않는다
      var now = new Date();
      var entry = { date: dkey(now), minutes: Math.max(1, Math.round(e / 60)), secs: e, track: trackName(), ts: Date.now() };
      saveLog(loadLog().concat(entry));
      if (window.__amAuth) window.__amAuth.push(entry); // 로그인 상태면 DB에도 — 익명이면 침묵
    }
    cTime.textContent = fmt(e);
    S.filter = null;
    document.body.classList.add('s3-complete');
    renderLog();
    setView('log');
  }
  function shedComplete() {                               // 완결 차림은 화면이 다 사라진 뒤에 벗는다 — 벗는 게 보이면 깜빡인다
    setTimeout(function () {
      if (document.body.dataset.s3 !== 'log') document.body.classList.remove('s3-complete');
    }, 650);
  }
  function backToRoom() {
    if (S.phase === 'complete') S.phase = 'idle';
    S.filter = null;
    setView('room');
    var A = am(); if (A) A.rise();
    shedComplete();
  }
  function openLog() {
    if (document.body.dataset.s3 === 'log' && !document.body.classList.contains('s3-complete')) { backToRoom(); return; }
    document.body.classList.remove('s3-complete');
    if (S.phase === 'complete') S.phase = 'idle';
    S.filter = null;
    renderLog();
    setView('log');
  }

  /* ── 기록 집계 ── */
  function byDate(log) {
    var m = {};
    log.forEach(function (e) {
      if (!m[e.date]) m[e.date] = { n: 0, min: 0 };
      m[e.date].n++; m[e.date].min += e.minutes || 0;
    });
    return m;
  }
  function stats(log) {
    var days = {};
    log.forEach(function (e) { days[e.date] = 1; });
    var totalMin = log.reduce(function (a, e) { return a + (e.minutes || 0); }, 0);
    var t = new Date(); t.setHours(0, 0, 0, 0);
    if (!days[dkey(t)]) t.setDate(t.getDate() - 1);       // 오늘 아직 안 앉았어도 어제까지의 연속은 살아있다
    var cur = 0;
    while (days[dkey(t)]) { cur++; t.setDate(t.getDate() - 1); }
    var longest = 0;
    Object.keys(days).forEach(function (k) {
      var d = new Date(k + 'T00:00:00');
      var prev = new Date(d); prev.setDate(d.getDate() - 1);
      if (days[dkey(prev)]) return;                       // 연속의 첫날만 센다
      var len = 0, c = new Date(d);
      while (days[dkey(c)]) { len++; c.setDate(c.getDate() + 1); }
      if (len > longest) longest = len;
    });
    return { n: log.length, totalMin: totalMin, cur: cur, longest: longest };
  }
  function level(min) { return min <= 0 ? 0 : min <= 10 ? 1 : min <= 20 ? 2 : min <= 40 ? 3 : 4; }

  /* ── 히트맵 ── */
  function cellFor(dt, today, map) {
    var el = document.createElement('div');
    el.className = 's3c-cell';
    if (dt > today) { el.classList.add('future'); return el; }
    var k = dkey(dt);
    var rec = map[k];
    var lv = level(rec ? rec.min : 0);
    if (lv) el.classList.add('lv' + lv);
    if (S.filter === k) el.classList.add('sel');
    el.dataset.date = k;
    el.dataset.n = rec ? rec.n : 0;
    el.dataset.min = rec ? rec.min : 0;
    return el;
  }
  function renderYear(map) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var start = new Date(today);
    start.setDate(today.getDate() - today.getDay() - 52 * 7);   // 53주 전 일요일부터
    monthsEl.className = 's3c-months';
    monthsEl.textContent = '';
    for (var i = 0; i < 13; i++) {                              // Aug → Aug, 구르는 12개월
      var sp = document.createElement('span');
      sp.textContent = new Date(today.getFullYear(), today.getMonth() - 12 + i, 1)
        .toLocaleDateString('en-US', { month: 'short' });
      monthsEl.appendChild(sp);
    }
    gridEl.className = 's3c-grid';
    gridEl.textContent = '';
    for (var w = 0; w < 53; w++) {
      var col = document.createElement('div');
      col.className = 'wk';
      for (var d = 0; d < 7; d++) {
        var dt = new Date(start);
        dt.setDate(start.getDate() + w * 7 + d);
        col.appendChild(cellFor(dt, today, map));
      }
      gridEl.appendChild(col);
    }
  }
  function renderMonth(map) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var y = today.getFullYear(), mo = today.getMonth();
    monthsEl.className = 's3c-months one';
    monthsEl.textContent = '';
    var sp = document.createElement('span');
    sp.textContent = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toLowerCase();
    monthsEl.appendChild(sp);
    gridEl.className = 's3c-grid cal';
    gridEl.textContent = '';
    var first = new Date(y, mo, 1);
    for (var i = 0; i < first.getDay(); i++) {
      var pad = document.createElement('div');
      pad.className = 's3c-cell future';
      gridEl.appendChild(pad);
    }
    var days = new Date(y, mo + 1, 0).getDate();
    for (var d = 1; d <= days; d++) gridEl.appendChild(cellFor(new Date(y, mo, d), today, map));
  }

  /* ── 목록 ── */
  function renderList(log) {
    var rows = S.filter ? log.filter(function (e) { return e.date === S.filter; }) : log.slice();
    rows.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    if (!S.filter) rows = rows.slice(0, 10);
    listEl.textContent = '';
    if (!rows.length) {
      var d = document.createElement('div');
      d.className = 's3c-empty';
      d.textContent = S.filter ? 'no sittings on ' + md(S.filter) : 'nothing yet — pick a time and sit';
      listEl.appendChild(d);
      return;
    }
    rows.forEach(function (e) {
      var r = document.createElement('div');
      r.className = 's3c-row';
      var l = document.createElement('span');
      l.textContent = relDay(e.date) + ' · ' + fmt(e.secs || (e.minutes || 0) * 60);
      var t = document.createElement('span');
      t.className = 'trk';
      t.textContent = e.track || 'silence';
      r.append(l, t);
      listEl.appendChild(r);
    });
  }

  function renderLog() {
    var log = loadLog();
    var st = stats(log);
    titleEl.textContent = st.n === 0 ? "You haven't sat yet" : st.n === 1 ? "You've sat once" : "You've sat " + st.n + ' times';
    subEl.textContent = durText(st.totalMin) + ' total · ' + st.cur + ' day streak · longest ' + st.longest;
    cN.textContent = st.n;
    cT.textContent = durText(st.totalMin);
    cS.textContent = st.cur;
    var map = byDate(log);
    if (S.range === 'month') renderMonth(map); else renderYear(map);
    renderList(log);
    var heat = root.querySelector('.s3c-heat');
    heat.scrollLeft = heat.scrollWidth;                 // 좁은 화면에선 최근이 먼저 보이게
  }

  /* ── 툴팁 · 칸 클릭 ── */
  function hideTip() { tip.hidden = true; }
  gridEl.addEventListener('mouseover', function (e) {
    var c = e.target.closest('.s3c-cell');
    if (!c || !c.dataset.date) { hideTip(); return; }
    var n = +c.dataset.n, min = +c.dataset.min;
    tip.textContent = n
      ? n + (n > 1 ? ' sittings · ' : ' sitting · ') + min + ' min on ' + md(c.dataset.date)
      : 'no sittings · ' + md(c.dataset.date);
    var r = c.getBoundingClientRect();
    tip.style.left = r.left + r.width / 2 + 'px';
    tip.style.top = r.top + 'px';
    tip.hidden = false;
  });
  gridEl.addEventListener('mouseleave', hideTip);
  gridEl.addEventListener('click', function (e) {
    var c = e.target.closest('.s3c-cell');
    if (!c || !c.dataset.date) return;
    S.filter = S.filter === c.dataset.date ? null : c.dataset.date;
    hideTip();
    renderLog();
  });

  /* ── 배선 ── */
  renderPills();
  beginBtn.addEventListener('click', begin);
  window.addEventListener('am-sit', function () {         // 방석 클릭 — 시간 선택이 열리고 닫힌다
    if (S.phase === 'running' || S.phase === 'paused') return;
    var v = document.body.dataset.s3;
    if (v === 'room') {
      S.order = pillOrder();                              // 마지막 선택이 맨 앞에, 선택된 채로
      S.customOpen = false;
      renderPills();
      setView('pick');
    } else if (v === 'pick') setView('room');
  });
  $('.s3a-back').addEventListener('click', function () {  // 알약 뒤를 눌러도 나간다 — 방석을 다시 찾지 않아도 되게
    if (document.body.dataset.s3 === 'pick') setView('room');
  });
  pauseBtn.addEventListener('click', pauseToggle);
  endBtn.addEventListener('click', function () {
    if (S.phase === 'settle') {                           // 시작 전이면 그냥 일어난다 — 기록도 완결도 없이
      clearInterval(tickIv); tickIv = 0;
      unlockScreen();
      S.phase = 'idle';
      backToRoom();
      return;
    }
    finish(false);
  });
  $('.s3c-again').addEventListener('click', function () { S.phase = 'idle'; begin(); });
  $('.s3c-back').addEventListener('click', backToRoom);
  logChip.addEventListener('click', openLog);
  soundChip.addEventListener('click', function () { var A = am(); if (A) A.musicToggle(); });
  root.querySelectorAll('.s3c-range .s3-chip').forEach(function (b) {
    b.addEventListener('click', function () {
      S.range = b.dataset.range;
      root.querySelectorAll('.s3c-range .s3-chip').forEach(function (x) {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      renderLog();
    });
  });
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (S.phase === 'settle') { endBtn.click(); }
    else if (S.phase === 'running' || S.phase === 'paused') pauseToggle();
    else if (document.body.dataset.s3 === 'log') backToRoom();
    else if (document.body.dataset.s3 === 'pick') setView('room');
  });

  /* 전축 상태 → sound 칩과 3b 알약 (1초 결이면 충분하다) */
  pollIv = setInterval(function () {
    var A = am();
    var m = A && A.music();
    var on = !!(m && m.on);
    soundChip.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (document.body.dataset.s3 === 'sitting') {
      if (on && m.title) {
        npTitle.textContent = trunc(m.title, 30);
        npVol.textContent = 'vol ' + (m.vol == null ? '—' : m.vol);
        np.hidden = false;
      } else np.hidden = true;
    }
  }, 1000);

  /* ── 등장 — 방 첫 프레임이 뜬 뒤에야 문이 열린다 ── */
  setView('room');
  function reveal() { setTimeout(function () { document.body.classList.add('s3-ready'); }, 350); }
  if (document.documentElement.dataset.amReady) reveal();
  else window.addEventListener('am-ready', reveal, { once: true });

  /* 개발용 — 콘솔에서 상태를 들여다보고, 기록을 심고 지운다 */
  window.__amS = S;
  window.__amSeedLog = function (days) {
    days = days || 120;
    var tracks = ['lofi rain — 3 hrs', 'rain + bowl', 'silence', 'morning raga', 'night air'];
    var out = [], t = new Date(); t.setHours(0, 0, 0, 0);
    var s = 0.4142;
    var rnd = function () { s = (s * 9301.317 + 0.49297) % 1; return s; };
    for (var i = 364; i >= 0; i--) {
      var p = i < 42 ? 0.9 : i < 90 ? 0.6 : Math.max(0, 0.55 - i / 365) * 0.7;
      if (rnd() > p) continue;
      var d = new Date(t); d.setDate(t.getDate() - i);
      var n = rnd() < 0.25 ? 2 : 1;
      for (var j = 0; j < n; j++) {
        var min = [5, 10, 10, 20, 45][Math.floor(rnd() * 5)];
        out.push({ date: dkey(d), minutes: min, secs: min * 60, track: tracks[Math.floor(rnd() * tracks.length)], ts: d.getTime() + 36e5 * (8 + Math.floor(rnd() * 12)) });
      }
      if (out.length >= days) break;
    }
    saveLog(out);
    renderLog();
    return out.length + ' entries seeded';
  };
  window.__amClearLog = function () { try { localStorage.removeItem('am-log'); } catch (e) {} renderLog(); return 'cleared'; };
})();
