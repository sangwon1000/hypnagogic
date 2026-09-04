/* 정글 앰비언스 — 한 시간짜리 한 덩어리였던 것을 60초 조각 예순으로 쪼갰다.
   방이 열리기 전에 받는 것은 트랙마다 첫 조각 하나씩(720KB)뿐이고, 나머지는
   듣는 동안 한 조각씩 앞질러 받는다.

   조각 사이는 크로스페이드로 잇는다. AAC 는 조각마다 앞뒤에 인코더가 넣은 침묵
   (priming/padding)을 달고 있어서 그냥 붙이면 1분마다 딸깍거린다 — 0.55초를
   겹쳐 넘기면 그 침묵이 통째로 묻힌다. 겹치는 구간은 사인/코사인 등가파워
   곡선이라 상관 없는 두 소음이 한가운데서 3dB 꺼지지 않는다.

   ── 폰에서 소리가 안 났던 이유, 그리고 세 겹의 대비 ──
   웹오디오로 실으면 소리 크기를 우리가 쥘 수 있다(iOS 는 audio.volume 을 재생 중에
   1 로 되돌려 놓는다). 그런데 iOS 에서 웹오디오에는 값이 둘 붙는다.
     ① 무음 스위치가 웹오디오 출력만 죽인다 — <audio> 요소 재생은 안 죽인다.
        navigator.audioSession.type = 'playback' 로 그 규칙에서 빠져나온다(iOS 16.4+).
     ② createMediaElementSource 를 제스처 전에(컨텍스트가 잠든 채로) 부르면
        그 요소가 영영 조용해지는 일이 있다 — 그래서 배선은 첫 손길 안에서 한다.
     ③ 그러고도 조용하면, 그래프에 달아 둔 분석기가 0 만 읽는다. 그때는 배선을
        버리고 맨 요소로 갈아탄다 — 겹침은 잃지만 소리는 난다. 순서가 그 반대일
        수는 없다. 배선된 요소는 되돌릴 수 없으므로 새 요소를 짓는다.

   AudioContext 는 하나만 세워 room2d 와 나눠 쓴다(window.__amCtx).
   재생 위치는 localStorage 에 적어 두고 다음 방문이 그 자리부터 잇는다. */
(function () {
  'use strict';
  if (window.top !== window) return;               // 액자(iframe) 안에서는 침묵 — 소리는 바깥 방이 맡는다

  var BASE = document.currentScript.src.replace(/[^/]*$/, '');
  var N = 60;                                      // 조각 수 (60초 x 60 = 한 시간)
  var LEN = 60;                                    // 조각 길이(초)
  var XF = 0.55;                                   // 조각 사이 겹침(초) — 배선됐을 때
  var CUT = 0.06;                                  // 맨 요소일 때의 이음새 — 겹칠 수 없으니 짧게 스친다
  var VOL = 0.3;
  var KEY = 'am-amb-pos';

  function url(mode, i) {
    return BASE + 'audio/' + mode + '/' + ('00' + i).slice(-3) + '.m4a?v=1';
  }

  /* 무음 스위치에서 빠져나온다 — 웹오디오(앰비언스·볼·똑딱) 전부가 이 한 줄에 걸려 있다.
     컨텍스트를 세우기 전에 걸어야 하고, 첫 손길에서 한 번 더 건다 */
  function playbackSession() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  }
  playbackSession();

  var ctx = null;
  try { ctx = window.__amCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  window.__amCtx = ctx;                            // room2d 가 이것을 집어 쓴다

  var wired = false;                               // 웹오디오로 실렸는가 — 겹침과 섞기가 여기 달렸다
  var analyser = null;

  /* 겹침 곡선 — 등가파워 */
  function curve(up) {
    var n = 33, c = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * Math.PI / 2;
      c[i] = up ? Math.sin(x) : Math.cos(x);
    }
    return c;
  }
  var UP = curve(true), DOWN = curve(false);

  /* ── 트랙 하나 = 조각을 번갈아 무는 오디오 둘 ── */
  function mkEl() {
    var a = new Audio();
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    a.volume = 0;                                  // 배선 전에는 조용히 — 맨 요소가 제 소리로 튀어나오지 않게
    return a;
  }
  function mkTrack(mode, start) {
    var t = { mode: mode, cur: 0, idx: start, sw: false, els: [mkEl(), mkEl()], g: [] };
    put(t, 0, t.idx);
    put(t, 1, (t.idx + 1) % N);
    return t;
  }
  function put(t, k, i) { t.els[k].src = url(t.mode, i); t.els[k].load(); }

  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  var startIdx = (typeof saved.i === 'number' && saved.i >= 0 && saved.i < N)
    ? saved.i : Math.floor(Math.random() * N);
  var startAt = (typeof saved.t === 'number' && saved.t > 0 && saved.t < LEN - XF - 1) ? saved.t : 0;

  var tracks = { day: mkTrack('day', startIdx), night: mkTrack('night', startIdx) };
  var list = [tracks.day, tracks.night];

  function seat(a, at) {
    var go = function () { try { a.currentTime = at; } catch (e) {} };
    if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
  }
  if (startAt) list.forEach(function (t) { seat(t.els[0], startAt); });

  /* ── 방이 기다리는 신호 — 트랙마다 첫 조각. 8초를 넘기지는 않는다 ── */
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
  /* 막힌 요소는 표시해 두고 다음 손길까지 건드리지 않는다. on 은 '틀기로 했다'는 뜻일 뿐,
     한 요소가 거절당했다고 꺼지지 않는다 — 예전엔 그것 때문에 pump 가 멈추고,
     그 사이 재생에 성공한 트랙이 관리 밖에서 혼자 울었다(조각도 안 넘어갔다) */
  function tryPlay(a) {
    if (a.__blocked) return;
    var p = a.play();
    if (p) p.then(function () { a.__ok = true; }, function () { a.__blocked = true; });
    else a.__ok = true;
  }
  var mode = function () {
    return document.documentElement.dataset.theme === 'night' ? 'night' : 'day';
  };

  /* ── 배선 — 반드시 첫 손길 안에서. 컨텍스트가 깨어 있는 채로 이어야 iOS 가 삼키지 않는다 ── */
  function wire() {
    if (wired || !ctx) return;
    try {
      /* 분석기는 master(0.3) 앞에서 잰다 — 뒤에서 재면 앰비언스가 바이트 양자화(1/128)에
         묻혀 살아 있는 소리도 무음으로 읽힌다. 소리를 두 번 내보내지 않도록
         출구는 0 게인으로 막고, 그래도 그래프에 매달아 두어야 분석이 돈다 */
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      var sink = ctx.createGain();
      sink.gain.value = 0;
      analyser.connect(sink);
      sink.connect(ctx.destination);
      list.forEach(function (t) {
        t.master = ctx.createGain();
        t.master.gain.value = 0;
        t.master.connect(analyser);
        t.els.forEach(function (a, k) {
          var g = ctx.createGain();
          g.gain.value = k === t.cur ? 1 : 0;      // 배선 시점의 '지금 우는 쪽'. 0 으로 굳히면 침묵한다
          ctx.createMediaElementSource(a).connect(g);
          g.connect(t.master);
          g.connect(analyser);                     // 재기만 한다 — 위에서 출구를 막아 두었다
          t.g.push(g);
          a.volume = 1;                            // 이제부터 크기는 게인이 쥔다
        });
      });
      wired = true;
      setTimeout(probe, 4000);                     // 게인이 다 오른 뒤에 — 정말로 소리가 흐르는지 확인한다
    } catch (e) { wired = false; }
  }

  /* ── 분석기가 0 만 읽으면 그래프가 죽은 것이다. 배선은 되돌릴 수 없으므로 새 요소를 짓는다 ── */
  var probed = false, peak = 0;
  function probe() {
    if (probed || !wired || !analyser || !on) return;
    var buf = new Uint8Array(analyser.fftSize), tries = 0;
    var look = setInterval(function () {
      analyser.getByteTimeDomainData(buf);
      for (var i = 0; i < buf.length; i++) {
        var d = Math.abs(buf[i] - 128);
        if (d > peak) peak = d;
      }
      /* 문턱을 사실상 디지털 무음에 붙인다 — 정글은 원래 조용해서(실측 peak 6/128)
         넉넉히 잡으면 살아 있는 소리를 죽은 것으로 오판한다. 죽은 그래프는 정확히 0 을 낸다 */
      if (peak > 1) { probed = true; clearInterval(look); return; }
      /* 2초 동안 사실상 완전한 디지털 무음이었다면 그래프가 죽은 것이다.
         master 앞에서 재므로 살아 있는 소리는 이 문턱을 한참 넘는다 */
      if (++tries >= 20) { clearInterval(look); if (!probed) bail(); }
    }, 100);
  }
  function bail() {
    probed = true;
    var m = mode();
    list.forEach(function (t) {
      var at = t.els[t.cur].currentTime, i = t.idx;
      t.els.forEach(function (a) { try { a.pause(); } catch (e) {} });
      t.els = [mkEl(), mkEl()];                    // 배선되지 않은 새 몸
      t.g = [];
      t.cur = 0;
      put(t, 0, i);
      put(t, 1, (i + 1) % N);
      seat(t.els[0], at);
      if (t.mode === m) {
        t.els[0].volume = VOL;
        tryPlay(t.els[0]);
      }
    });
    wired = false;
  }

  /* 소리가 흐르는 동안 화면도 깨어 있는다 */
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

  /* ── 조각 넘기기 ── */
  function hop(t) {
    t.sw = true;
    var k2 = 1 - t.cur, b = t.els[k2];
    try { b.currentTime = 0; } catch (e) {}
    tryPlay(b);
    if (wired) {
      var now = ctx.currentTime;
      [[t.g[t.cur], DOWN], [t.g[k2], UP]].forEach(function (pair) {
        try {
          pair[0].gain.cancelScheduledValues(now);
          pair[0].gain.setValueCurveAtTime(pair[1], now, XF);
        } catch (e) { pair[0].gain.value = pair[1] === UP ? 1 : 0; }
      });
    } else {
      b.volume = t.mode === mode() ? VOL : 0;      // 겹칠 수 없다 — 스치듯 넘긴다
    }
    setTimeout(function () {
      try { t.els[t.cur].pause(); t.els[t.cur].currentTime = 0; } catch (e) {}
      t.cur = k2;
      t.idx = (t.idx + 1) % N;
      put(t, 1 - t.cur, (t.idx + 1) % N);          // 그 다음 조각을 미리 물려 둔다
      t.sw = false;
    }, (wired ? XF : CUT) * 1000 + 90);
  }

  function pump() {
    if (!on) return;
    var m = mode();
    list.forEach(function (t) {
      var a = t.els[t.cur];
      /* 배선됐으면 둘 다 흐르고 게인이 섞는다. 맨 요소라면 지금 시간대의 것만 운다 */
      var want = wired || t.mode === m;
      if (want && a.paused) tryPlay(a);
      else if (!want && !a.paused) a.pause();
      if (!a.paused && !t.sw && (a.duration || LEN) - a.currentTime <= (wired ? XF : CUT)) hop(t);
    });
    if (wired) {
      var now = ctx.currentTime;
      list.forEach(function (t) {
        t.master.gain.setTargetAtTime(t.mode === m ? VOL : 0, now, 0.35);
      });
    } else {
      list.forEach(function (t) {
        t.els.forEach(function (a) { a.volume = t.mode === m ? VOL : 0; });
      });
    }
  }

  /* 첫 손길 — 여기서 배선하고, 넷 다 한 번씩 걷어차 잠금을 푼다.
     iOS 는 한 손길에 여러 요소를 재생하는 것을 거절하기도 한다 — 풀린 것을 표시해 두고
     다음 손길에 못 푼 것만 다시 시도한다. 그래야 한 시간 뒤 조각을 넘길 때 조용해지지 않는다 */
  function start(gesture) {
    if (gesture) {
      playbackSession();
      try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
      wire();
    }
    on = true;
    /* 넷 다 한 번씩 걷어차 잠금을 푼다 — iOS 는 한 손길에 여러 요소를 재생하는 것을
       거절하기도 하므로, 손길이 올 때마다 아직 못 푼 것만 다시 시도한다.
       그래야 한 시간 뒤 조각을 넘길 때 조용해지지 않는다 */
    if (gesture) list.forEach(function (t) {
      t.els.forEach(function (a) { a.__blocked = false; });
    });
    list.forEach(function (t) {
      t.els.forEach(function (a, k) {
        if (a.__ok) return;
        tryPlay(a);
        if (k !== t.cur) setTimeout(function () { if (k !== t.cur) a.pause(); }, 0);
      });
    });
    grabLock();
    pump();
  }
  start(false);                                    // 사이트 안에서 넘어왔으면 바로 이어진다
  document.addEventListener('pointerdown', function () { start(true); });
  document.addEventListener('pointerdown', grabLock);

  setInterval(pump, 100);

  function save() {
    if (!on) return;
    var t = tracks.day;
    try { localStorage.setItem(KEY, JSON.stringify({ i: t.idx, t: t.els[t.cur].currentTime })); } catch (e) {}
  }
  setInterval(save, 3000);
  addEventListener('pagehide', save);

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
    mode: mode,
    lock: function () { return !!lock; },
    ctx: function () { return ctx; },
    tracks: tracks,
    stat: function () {
      var one = function (t) {
        var a = t.els[t.cur];
        return {
          chunk: t.idx, t: +a.currentTime.toFixed(2), paused: a.paused, ready: a.readyState,
          gain: wired ? +t.master.gain.value.toFixed(3) : +a.volume.toFixed(3),
          next: t.els[1 - t.cur].readyState,
          unlocked: t.els.map(function (x) { return !!x.__ok; }),
        };
      };
      return {
        on: on, wired: wired, probed: probed, peak: peak, mode: mode(), chunks: N,
        ctx: ctx ? ctx.state : null,
        session: (function () { try { return navigator.audioSession ? navigator.audioSession.type : 'n/a'; } catch (e) { return 'err'; } })(),
        day: one(tracks.day), night: one(tracks.night),
      };
    },
  };
})();
