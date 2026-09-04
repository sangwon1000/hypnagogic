/* 정글 앰비언스 — 한 시간짜리 한 덩어리였던 것을 60초 조각 예순으로 쪼갰다.
   방이 열리기 전에 받는 것은 트랙마다 첫 조각 하나씩(720KB)뿐이고, 나머지는
   듣는 동안 한 조각씩 앞질러 받는다.

   조각 사이는 크로스페이드로 잇는다. AAC 는 조각마다 앞뒤에 인코더가 넣은 침묵
   (priming/padding)을 달고 있어서 그냥 이어 붙이면 1분마다 딸깍거린다 —
   0.55초를 겹쳐 넘기면 그 침묵이 통째로 묻힌다. 겹치는 구간은 사인/코사인
   등가파워 곡선이라 소음의 세기가 중간에서 꺼지지 않는다.

   소리 크기는 이제 GainNode 가 쥔다. audio.volume 은 iOS 가 재생 중에 슬그머니
   1 로 되돌려 놓아서(iOS 26 시뮬레이터 실측) 낮밤 섞기가 폰에서 무너졌었고,
   그래서 폰에서는 섞기를 포기하고 갈아 끼웠었다. 웹오디오의 게인에는 그 손이
   닿지 않는다 — 이제 폰에서도 낮과 밤이 제대로 겹쳐 넘어간다.

   AudioContext 는 하나만 세워 room2d 와 나눠 쓴다(window.__amCtx). 방이 제
   컨텍스트를 따로 세우면 iOS 에서 둘 중 하나가 조용해질 위험이 있었다.

   재생 위치는 localStorage 에 적어 두고 다음 방문이 그 자리부터 잇는다. */
(function () {
  'use strict';
  if (window.top !== window) return;               // 액자(iframe) 안에서는 침묵 — 소리는 바깥 방이 맡는다

  var BASE = document.currentScript.src.replace(/[^/]*$/, '');
  var N = 60;                                      // 조각 수 (60초 x 60 = 한 시간)
  var LEN = 60;                                    // 조각 길이(초) — 실측 60.0004, 남는 것은 겹침이 먹는다
  var XF = 0.55;                                   // 조각 사이 겹침(초)
  var VOL = 0.3;
  var KEY = 'am-amb-pos';

  function url(mode, i) {
    return BASE + 'audio/' + mode + '/' + ('00' + i).slice(-3) + '.m4a?v=1';
  }

  var ctx = null;
  try { ctx = window.__amCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  window.__amCtx = ctx;                            // room2d 가 이것을 집어 쓴다

  /* 겹침 곡선 — 등가파워. 상관 없는 두 소음을 선형으로 섞으면 한가운데가 3dB 꺼진다 */
  function curve(up) {
    var n = 33, c = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * Math.PI / 2;
      c[i] = up ? Math.sin(x) : Math.cos(x);
    }
    return c;
  }
  var UP = curve(true), DOWN = curve(false);

  /* ── 트랙 하나 = 조각을 번갈아 무는 오디오 둘 ──
     한쪽이 우는 동안 다른 쪽은 다음 조각을 물고 기다린다. 넘길 때만 둘이 겹친다. */
  function mkTrack(mode, start) {
    var t = { mode: mode, cur: 0, idx: start, sw: false, els: [], g: [] };
    if (ctx) {
      t.master = ctx.createGain();
      t.master.gain.value = 0;
      t.master.connect(ctx.destination);
    }
    for (var k = 0; k < 2; k++) {
      var a = new Audio();
      a.preload = 'auto';
      a.setAttribute('playsinline', '');
      t.els.push(a);
      if (ctx) {
        var g = ctx.createGain();
        g.gain.value = k === 0 ? 1 : 0;
        try { ctx.createMediaElementSource(a).connect(g); } catch (e) {}
        g.connect(t.master);
        t.g.push(g);
      } else {
        a.volume = 0;                              // 웹오디오가 없는 기기 — 손잡이로 버틴다
      }
    }
    put(t, 0, t.idx);
    put(t, 1, (t.idx + 1) % N);
    return t;
  }
  function put(t, k, i) { t.els[k].src = url(t.mode, i); t.els[k].load(); }

  /* 어디서부터 들을까 — 지난 방문의 자리, 처음이면 아무 데서나 */
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  var startIdx = (typeof saved.i === 'number' && saved.i >= 0 && saved.i < N)
    ? saved.i : Math.floor(Math.random() * N);
  var startAt = (typeof saved.t === 'number' && saved.t > 0 && saved.t < LEN - XF - 1) ? saved.t : 0;

  var tracks = { day: mkTrack('day', startIdx), night: mkTrack('night', startIdx) };
  var list = [tracks.day, tracks.night];

  /* 지난 자리로 바늘을 옮긴다 — 메타데이터가 와야 currentTime 이 먹는다 */
  if (startAt) list.forEach(function (t) {
    var a = t.els[0];
    var seat = function () { try { a.currentTime = startAt; } catch (e) {} };
    if (a.readyState >= 1) seat(); else a.addEventListener('loadedmetadata', seat, { once: true });
  });

  /* ── 방이 기다리는 신호 — 트랙마다 첫 조각이 실릴 때까지. 8초를 넘기지는 않는다:
     소리가 늦는다고 방문이 막혀서는 안 된다 ── */
  window.__ambPrimed = Promise.all(list.map(function (t) {
    var a = t.els[0];
    return new Promise(function (res) {
      if (a.readyState >= 4) return res();
      var done = function () { res(); };
      a.addEventListener('canplaythrough', done, { once: true });
      a.addEventListener('error', done, { once: true });
      setTimeout(done, 8000);
    });
  }));

  var on = false;

  /* 소리가 흐르는 동안 화면도 깨어 있는다 — 탭이 보일 때만 잡고,
     탭이 숨거나 잠기면 브라우저가 알아서 놓는다(그때 소리도 같이 쉰다) */
  var lock = null;
  function grabLock() {
    if (!('wakeLock' in navigator) || lock || document.hidden || !on) return;
    try {
      navigator.wakeLock.request('screen').then(function (l) {
        lock = l;
        l.addEventListener('release', function () { lock = null; });
      })['catch'](function () {});
    } catch (e) {}
  }

  var mode = function () {
    return document.documentElement.dataset.theme === 'night' ? 'night' : 'day';
  };

  /* ── 조각 넘기기 — 끝이 XF 만큼 남으면 다음 조각을 겹쳐 띄운다 ── */
  function hop(t) {
    t.sw = true;
    var k2 = 1 - t.cur, b = t.els[k2];
    try { b.currentTime = 0; } catch (e) {}
    var p = b.play(); if (p) p['catch'](function () {});
    if (ctx) {
      var now = ctx.currentTime;
      [[t.g[t.cur], DOWN], [t.g[k2], UP]].forEach(function (pair) {
        try {
          pair[0].gain.cancelScheduledValues(now);
          pair[0].gain.setValueCurveAtTime(pair[1], now, XF);
        } catch (e) { pair[0].gain.value = pair[1] === UP ? 1 : 0; }
      });
    }
    setTimeout(function () {
      t.els[t.cur].pause();
      try { t.els[t.cur].currentTime = 0; } catch (e) {}
      t.cur = k2;
      t.idx = (t.idx + 1) % N;
      put(t, 1 - t.cur, (t.idx + 1) % N);          // 그 다음 조각을 미리 물려 둔다
      t.sw = false;
    }, XF * 1000 + 90);
  }

  function pump() {
    if (!on) return;
    list.forEach(function (t) {
      var a = t.els[t.cur];
      if (a.paused) { var p = a.play(); if (p) p['catch'](function () {}); return; }
      if (!t.sw && (a.duration || LEN) - a.currentTime <= XF) hop(t);
    });
    if (!ctx) {                                    // 웹오디오가 없으면 지금 것만 울린다
      var m = mode();
      list.forEach(function (t) {
        t.els.forEach(function (a) { a.volume = t.mode === m ? VOL : 0; });
      });
      return;
    }
    var m2 = mode(), now = ctx.currentTime;
    list.forEach(function (t) {
      t.master.gain.setTargetAtTime(t.mode === m2 ? VOL : 0, now, 0.35);
    });
  }

  function start() {
    if (on) return;
    on = true;
    try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
    /* 넷 다 이 손길로 잠금을 푼다 — 그래야 한 시간 뒤 조각을 넘길 때도,
       몇 시간 뒤 밤이 올 때도 제스처 없이 든다. 대기하는 쪽은 곧 pump 가 재운다 */
    list.forEach(function (t) {
      t.els.forEach(function (a, k) {
        var p = a.play();
        if (p) p.then(function () { if (k !== t.cur) a.pause(); },
                      function () { if (k === t.cur) on = false; });  // 막히면 다음 터치에 재시도
      });
    });
    grabLock();
    pump();
  }
  start();                                         // 사이트 안에서 넘어왔으면 바로 이어진다
  document.addEventListener('pointerdown', start); // 첫 방문이면 첫 터치에 깨어난다
  document.addEventListener('pointerdown', grabLock);

  setInterval(pump, 100);

  function save() {
    if (!on) return;
    var t = tracks.day;
    try {
      localStorage.setItem(KEY, JSON.stringify({ i: t.idx, t: t.els[t.cur].currentTime }));
    } catch (e) {}
  }
  setInterval(save, 3000);
  addEventListener('pagehide', save);

  /* 탭이 뒤로 물러나면 조용해진다 — 이 탭을 보고 있을 때만 소리 */
  var hiddenPause = false;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (!on) return;
      hiddenPause = true;
      list.forEach(function (t) { t.els.forEach(function (a) { a.pause(); }); });
      save();
    } else {
      if (hiddenPause) { hiddenPause = false; pump(); }
      grabLock();
    }
  });

  window.__ambient = {
    on: function () { return on; },
    tracks: tracks,                                // 방(room2d)과 콘솔이 들여다보는 몸

    mode: mode,
    lock: function () { return !!lock; },
    ctx: function () { return ctx; },
    stat: function () {
      var one = function (t) {
        var a = t.els[t.cur];
        return {
          chunk: t.idx, t: +a.currentTime.toFixed(2), paused: a.paused,
          ready: a.readyState, gain: ctx ? +t.master.gain.value.toFixed(3) : +a.volume.toFixed(3),
          next: t.els[1 - t.cur].readyState,
        };
      };
      return { unlocked: on, mode: mode(), chunks: N, day: one(tracks.day), night: one(tracks.night) };
    },
  };
})();
