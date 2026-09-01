/* 방 — 블렌더가 구운 2초 클립이 곧 방이다 (Meditation Room 4K, 60프레임).
   스틸은 들어냈다: 낮 = 클립의 첫 프레임에 멈춘 것, 밤 = 끝 프레임에 멈춘 것.
   3D 엔진(room3d.js)은 은퇴했다: 렌더는 Cycles가 다 하고, 웹은 핫스팟만 얹는다.
   물건마다 기능 하나씩 — 방석=앉기(세션), 볼=댕, 전축=음악. session.js 무수정.
   볼은 제 필름을 가졌다: 말렛이 때리고 볼이 도는 3초 롤(낮/밤 각 하나)을 스틸 위에
   겹쳐 튼다 — 첫/끝 프레임이 스틸과 같은 픽셀이라 나타나고 사라질 때 이음새가 없다.
   호버는 조용하다: 물건은 꿈쩍 않고, 그 위에 명패(plate3d)만 뜬다.
   히트영역은 블렌더 카메라로 실측한 실루엣 폴리곤(4K px) — 렌더와 픽셀 단위로 맞는다.
   밤낮은 우측 상단 칩 — 클립이 해를 지우고 전등을 켠다. 아침은 같은 필름을 거꾸로 튼
   역방향 클립(night2day.mp4)이 맡는다 — 브라우저는 되감기를 못 하니까. */
(function () {
  'use strict';

  var IMG_W = 3840, IMG_H = 2160;

  /* 스틸 속 '방 상자' — 나무 끝에서 마루 그림자까지. 카메라(레이아웃)는 이 상자만 지킨다 */
  var ROOM = { x: 560, y: 16, w: 2672, h: 2032 };
  var CUSHION = { x: 1601, y: 1516 };            // sit() 줌의 소실점 — 방석 실측 중심

  /* 핫스팟 — 블렌더 실루엣 실측 폴리곤. SVG 페인트 순서상 뒤의 것이 겹침을 이긴다(볼 > 방석) */
  var HOTS = [
    { act: 'timer', name: 'cushion', sub: 'sit — pick a time',
      poly: [[1391, 1503], [1519, 1445], [1612, 1418], [1803, 1534], [1601, 1617], [1582, 1617], [1396, 1516]] },
    { act: 'music', name: 'turntable', sub: 'music on / off',
      poly: [[2176, 1289], [2279, 1243], [2431, 1264], [2549, 1293], [2604, 1319], [2526, 1418], [2334, 1433], [2172, 1349]] },
    { act: 'bowl', name: 'singing bowl', sub: 'ding —',
      poly: [[1459, 1613], [1478, 1601], [1517, 1599], [1538, 1607], [1546, 1620], [1544, 1643], [1531, 1659], [1519, 1666], [1493, 1670], [1466, 1655], [1456, 1637]] },
  ];

  var container = document.querySelector('.scene');
  if (!container) throw new Error('no scene container');

  /* ── 무대 ── */
  var frame = document.createElement('div');
  frame.className = 'frame';
  frame.style.transformOrigin = (CUSHION.x / IMG_W * 100) + '% ' + (CUSHION.y / IMG_H * 100) + '%';
  /* 폰에는 가벼운 필름을 — 4K 롤 셋(합 7.9MB, 15Mbps)은 폰의 디코더와 메모리에 버겁다.
     화면 최장변이 1100 CSS px 미만이면 1080p 판을 쓴다(폰만 걸리고 태블릿·데스크톱은 4K).
     패치는 원래 작아 한 벌로 족하다 — 어차피 퍼센트로 앉으니 해상도는 선명함에만 관여한다. */
  var SMALL = Math.max(screen.width, screen.height) < 1100;
  function film(name, v) { return 'assets/' + name + (SMALL ? '_1080' : '') + '.mp4?v=' + v; }

  /* ── 필름 두 롤이 방의 전부 — fwd(낮→밤)가 정지 화면까지 맡고, rev(밤→낮)는 전환에만 나온다 ── */
  function mkVid(src) {
    var v = document.createElement('video');
    v.muted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    v.src = src;
    frame.appendChild(v);
    return v;
  }
  var fwd = mkVid(film('day2night', 6));
  fwd.setAttribute('role', 'img');
  fwd.setAttribute('aria-label', 'a meditation room on a wooden deck, wrapped in a banyan tree');
  var rev = mkVid(film('night2day', 6));
  rev.hidden = true;
  rev.setAttribute('aria-hidden', 'true');
  /* 셋째 롤 — 반딧불. 검은 배경에 빛점만 있는 5초 루프를 screen 블렌드로 겹친다.
     밤낮 필름과 같은 카메라로 찍어 홀드아웃 재단까지 픽셀이 맞고,
     등장·퇴장은 렌더가 아니라 여기 페이드가 맡는다 */
  var ff = mkVid(film('fireflies', 3));
  ff.classList.add('ff');
  ff.loop = true;
  ff.setAttribute('aria-hidden', 'true');
  container.appendChild(frame);

  var plate = document.createElement('div');       // 오브젝트 명패 — 3D 시절의 plate3d 그대로 (handoff 2: Object hover label)
  plate.className = 'plate3d';
  plate.hidden = true;
  container.appendChild(plate);

  /* ── 핫스팟: 투명 SVG 히트맵 ── */
  var svgNS = 'http://www.w3.org/2000/svg';
  var hotmap = document.createElementNS(svgNS, 'svg');
  hotmap.setAttribute('class', 'hotmap');
  hotmap.setAttribute('viewBox', '0 0 ' + IMG_W + ' ' + IMG_H);
  hotmap.setAttribute('preserveAspectRatio', 'none');
  var hovered = null;
  HOTS.forEach(function (h) {
    var xs = h.poly.map(function (p) { return p[0]; });
    var ys = h.poly.map(function (p) { return p[1]; });
    h.cx = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
    h.top = Math.min.apply(null, ys);
    var pg = document.createElementNS(svgNS, 'polygon');
    pg.setAttribute('points', h.poly.map(function (p) { return p[0] + ',' + p[1]; }).join(' '));
    pg.setAttribute('role', 'button');
    pg.setAttribute('tabindex', '0');
    pg.setAttribute('aria-label', h.name + ' — ' + h.sub);
    pg.addEventListener('pointerenter', function () { hoverOn(h); });
    pg.addEventListener('pointerleave', function () { hoverOff(h); });
    pg.addEventListener('focus', function () { hoverOn(h); });
    pg.addEventListener('blur', function () { hoverOff(h); });
    pg.addEventListener('click', function () { act(h); });
    pg.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(h); }
    });
    hotmap.appendChild(pg);
    h.el = pg;
  });
  frame.appendChild(hotmap);
  if (/[?&]dev\b/.test(location.search)) frame.classList.add('dev');

  function hoverOn(h) {
    if (hovered === h) return;
    hovered = h;
    if (h.act === 'bowl') loadPatches();           // 볼에 커서가 닿는 순간 — 클릭보다 한 발 먼저 싣는다
    tick();                                        // 딸깍 — 명패 등장음
    showPlate(h);
  }
  function hoverOff(h) {
    if (hovered === h) { hovered = null; plate.hidden = true; }
  }
  function clearHover() { if (hovered) hoverOff(hovered); }

  function showPlate(h) {
    var sub = h.sub;
    if (h.act === 'music' && musicOn && ytReady) {
      try {
        var d = ytPlayer.getVideoData();
        if (d && d.title) sub = '♪ ' + (d.title.length > 26 ? d.title.slice(0, 25) + '…' : d.title);
      } catch (e) {}
    }
    plate.innerHTML = '<b>' + h.name + '</b><i></i>';
    var sp = document.createElement('span');
    sp.textContent = sub;                          // 곡 제목은 외부 문자열 — HTML로 안 넣는다
    plate.append(sp);
    placePlate(h);
    plate.hidden = false;
    plate.style.animation = 'none';                // 옆 물건으로 미끄러져도 등장 모션은 다시
    void plate.offsetWidth;
    plate.style.animation = '';
  }
  function placePlate(h) {
    var r = frame.getBoundingClientRect();
    plate.style.left = (r.left + h.cx / IMG_W * r.width) + 'px';
    plate.style.top = (r.top + h.top / IMG_H * r.height - 12) + 'px';
  }

  /* 세션 화면이 방을 덮으면 명패는 걷는다 (핫스팟 자체는 오버레이가 가려 준다) */
  new MutationObserver(function () {
    var v = document.body.dataset.s3;
    if (v === 'sitting' || v === 'log') clearHover();
  }).observe(document.body, { attributes: true, attributeFilter: ['data-s3'] });

  /* ── 카메라 — 필름이 화면을 가득 덮는다(커버). 브라우저 뷰포트는 16:9가 아니라
     어느 한 축이 늘 넘치는데, 잘림은 방 상자(나무 꼭대기~마루 그림자) 바깥 여백이
     먼저 떠안는다: 이상적 위치는 정중앙, 방이 잘리게 생기면 방이 보이는 범위로
     클램프. 그래도 방이 화면보다 크면 위아래(좌우)를 공평하게 희생 ── */
  function layout() {
    var vw = innerWidth, vh = innerHeight;
    var s = Math.max(vw / IMG_W, vh / IMG_H);
    var w = IMG_W * s, h = IMG_H * s;
    function axis(view, span, room0, roomLen) {   // frame 오프셋: 중앙 선호, 방 보호 클램프
      var ideal = (view - span) / 2;
      var lo = -room0 * s;                        // 방 시작이 화면 안: offset ≥ lo
      var hi = view - (room0 + roomLen) * s;      // 방 끝이 화면 안: offset ≤ hi
      var off = lo > hi ? (lo + hi) / 2           // 방이 화면보다 큼 — 위아래 공평하게 희생
        : Math.min(hi, Math.max(lo, ideal));
      return Math.min(0, Math.max(view - span, off));  // 커버 불변식 — 어떤 경우에도 배경 틈은 없다
    }
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
    frame.style.left = axis(vw, w, ROOM.x, ROOM.w) + 'px';
    frame.style.top = axis(vh, h, ROOM.y, ROOM.h) + 'px';
    if (hovered) placePlate(hovered);
  }
  addEventListener('resize', layout);
  layout();

  /* ── 앉기 — 카메라 대신 스틸이 방석 쪽으로 한 발짝 부푼다 ── */
  var seated = false;
  function sitDown() {
    if (seated) return;
    seated = true;
    clearHover();
    frame.classList.add('sit');
  }
  function riseUp() {
    if (!seated) return;
    seated = false;
    frame.classList.remove('sit');
  }

  /* ── 싱잉볼 — 댕. 소리는 room3d에서 그대로, 그림은 전용 필름 두 롤이 새로 맡는다.
     말렛이 떠올라 림을 치고 볼이 흔들리며 도는 3초(90f) — 타격은 필름의 10프레임째라
     소리를 0.33초 뒤로 WebAudio 시계에 걸어 그림과 맞춘다. 밤낮 전환 중엔 방 필름이
     무대 주인이라 그림은 쉬고 소리만 댕 ── */

  /* 패치는 방 전체가 아니라 말렛·볼이 실제로 움직이는 상자만 담는다(실측 후 여유 64px).
     .frame 이 곧 필름 상자라(layout: IMG 비율 그대로) 자리는 순수 퍼센트로 떨어진다.
     멀리 있는 것 — 캐노피든 마당이든 — 이 바뀌어도 이 상자 밖이면 패치는 살아남는다. */
  var PATCH = { x: 1280, y: 1504, w: 352, h: 304 };

  function mkPatch(src) {
    var v = document.createElement('video');
    v.muted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.preload = 'none';                            // 방 필름 먼저 — 패치는 한가할 때 몰래 싣는다
    v.src = src;
    v.hidden = true;
    v.setAttribute('aria-hidden', 'true');
    v.style.inset = 'auto';                        // 제네릭 video 규칙(inset:0 전면)에서 빠져나온다
    v.style.left = (PATCH.x / IMG_W * 100) + '%';
    v.style.top = (PATCH.y / IMG_H * 100) + '%';
    v.style.width = (PATCH.w / IMG_W * 100) + '%';
    v.style.height = (PATCH.h / IMG_H * 100) + '%';
    frame.insertBefore(v, ff);                     // 반딧불 아래, 방 필름 위
    v.addEventListener('ended', function () {
      v.hidden = true;
      try { v.currentTime = 0; } catch (e) {}
    });
    v.addEventListener('error', function () { v.hidden = true; });
    return v;
  }
  var bowlN = mkPatch('assets/bowl_night.mp4?v=2');
  var bowlD = mkPatch('assets/bowl_day.mp4?v=2');
  var patchesLoaded = false;
  function loadPatches() {
    if (patchesLoaded) return;
    patchesLoaded = true;
    [bowlN, bowlD].forEach(function (v) { v.preload = 'auto'; v.load(); });
  }
  addEventListener('am-ready', function () { setTimeout(function () { loadPatches(); loadTick(); }, 2500); }, { once: true });
  function bowlHide() {
    [bowlN, bowlD].forEach(function (v) {
      if (!v.hidden) { v.pause(); v.hidden = true; try { v.currentTime = 0; } catch (e) {} }
    });
  }

  var audioCtx = null;
  function strikeBowl(delay) {                     // delay(초) — 필름 속 타격 순간에 소리를 건다
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var t = audioCtx.currentTime + (delay || 0);
      /* 좌종의 배음렬 f·2.9f·5.4f·8.8f — 쌍마다 살짝 어긋나 맥놀이가 인다 */
      [[196, 0.11, 8], [568, 0.05, 6], [1058, 0.02, 4.2], [1725, 0.009, 2.8]].forEach(function (row) {
        [0.9985, 1.0015].forEach(function (det) {
          var o = audioCtx.createOscillator(), v = audioCtx.createGain();
          o.type = 'sine';
          o.frequency.value = row[0] * det;
          v.gain.setValueAtTime(row[1] / 2, t);
          v.gain.exponentialRampToValueAtTime(0.0001, t + row[2]);
          o.connect(v).connect(audioCtx.destination);
          o.start(t); o.stop(t + row[2] + 0.1);
        });
      });
    } catch (e) {}
  }
  /* ── 호버 틱 — 명패가 뜨는 순간의 아주 작은 딸깍. 오디오는 첫 제스처 뒤에만 깨어나므로
     (브라우저 정책) 첫 클릭 전의 호버는 조용히 지나간다 ── */
  var tickRaw = null, tickBuf = null, tickLoading = false, tickAt = 0;
  function loadTick() {
    if (tickLoading) return;
    tickLoading = true;
    fetch('assets/hover.mp3?v=1')
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (b) { tickRaw = b; tickDecode(); })
      .catch(function () {});
  }
  function tickDecode() {
    if (!tickRaw || tickBuf || !audioCtx) return;
    var raw = tickRaw;
    tickRaw = null;                                // decode는 한 번 — 사파리는 버퍼를 detach한다
    try { audioCtx.decodeAudioData(raw, function (b) { tickBuf = b; }, function () {}); } catch (e) {}
  }
  addEventListener('pointerdown', function () {    // 첫 누름에서 미리 깨워 둔다 — 볼 첫 타의 지연도 사라짐
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      tickDecode();
    } catch (e) {}
  }, { capture: true, passive: true });
  function tick() {
    try {
      if (!audioCtx || !tickBuf) { loadTick(); tickDecode(); return; }
      if (audioCtx.state === 'suspended') { audioCtx.resume(); return; }
      var t = audioCtx.currentTime;
      if (t - tickAt < 0.06) return;               // 명패 사이를 미끄러질 때 기관총은 사양
      tickAt = t;
      var s = audioCtx.createBufferSource(), v = audioCtx.createGain();
      s.buffer = tickBuf;
      v.gain.value = 0.5;
      s.connect(v).connect(audioCtx.destination);
      s.start();
    } catch (e) {}
  }

  var STRIKE_AT = 10 / 30;                         // 말렛이 림에 닿는 프레임 — 필름 기준 0.33초
  function ding() {
    var v = null;
    if (!NO_MOTION && !playingTo) {
      v = themeName() === 'night' ? bowlN : bowlD;
      if (v.error || v.readyState < 2) { loadPatches(); v = null; }  // 아직 안 실렸으면 소리만
    }
    if (!v) { strikeBowl(0); return; }
    try { v.currentTime = 0; } catch (e) {}        // 연타 = 다시 때리기
    v.hidden = false;
    var p = v.play();
    if (p) p.catch(function () { v.hidden = true; });
    strikeBowl(STRIKE_AT);
  }

  /* ── 전축 — 유튜브 플레이어를 화면 밖에 숨기고 소리만 듣는다 (room3d에서 그대로) ──
     지금 걸린 한 장: BREAKFAST — Morning Vinyl House Mix (Breakfast TILT) */
  var YT_VIDEO = 'VAXuZM8iLL4';
  var ytPlayer = null, ytReady = false, ytLoading = false, triedUnmute = false;
  var musicOn = false;
  function ensureMusic() {
    if (ytLoading) return;
    ytLoading = true;
    var holder = document.createElement('div');
    holder.id = 'lp-yt';
    holder.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:220px;height:220px;pointer-events:none;';
    document.body.appendChild(holder);
    window.onYouTubeIframeAPIReady = function () {
      ytPlayer = new YT.Player('lp-yt', {
        width: 220, height: 220,
        videoId: YT_VIDEO,
        playerVars: { playsinline: 1, loop: 1, playlist: YT_VIDEO },  // 한 장짜리 무한 루프
        events: {
          onReady: function (e) { ytReady = true; e.target.setVolume(75); e.target.setLoop(true); },
          onError: function (err) { console.warn('the turntable cannot read this record', err && err.data); },
        },
      });
    };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () { ytLoading = false; };
    document.head.appendChild(s);
  }
  ensureMusic();                                   // 미리 준비 — 클릭 제스처 안에서 바로 재생해야 자동재생 차단에 안 걸린다

  var musicHiddenPause = false;
  document.addEventListener('visibilitychange', function () {
    if (!ytReady) return;
    if (document.hidden) {
      var st = ytPlayer.getPlayerState();
      if (st === 1 || st === 3) { musicHiddenPause = true; ytPlayer.pauseVideo(); }
    } else if (musicHiddenPause) {
      musicHiddenPause = false;
      ytPlayer.playVideo();
    }
  });
  function toggleMusic() {
    if (!ytReady) { ensureMusic(); return; }
    var st = ytPlayer.getPlayerState();
    if (st === 1 || st === 3) {
      if (ytPlayer.isMuted() && !triedUnmute) { ytPlayer.unMute(); triedUnmute = true; }
      else { ytPlayer.pauseVideo(); triedUnmute = false; }
    } else {
      ytPlayer.unMute();
      ytPlayer.playVideo();
      triedUnmute = false;
    }
  }
  setInterval(function () {                        // 재생 상태를 계속 비춘다 — sound 칩·명패가 이걸 본다
    if (ytReady) { var st = ytPlayer.getPlayerState(); musicOn = st === 1 || st === 3; }
  }, 500);

  /* ── 클릭 → 기능 ── */
  function act(h) {
    if (h.act === 'timer') window.dispatchEvent(new Event('am-sit'));  // 방석 = 세션 (session.js가 듣는다)
    else if (h.act === 'bowl') ding();
    else if (h.act === 'music') toggleMusic();
  }

  /* ── 밤낮 — 우측 상단 칩. 필름을 앞으로 틀면 해가 지고(fwd), 되감아 둔 롤을 틀면 아침(rev).
     정지 상태는 늘 fwd가 맡는다: 낮 = 0초에 멈춘 것, 밤 = 끝 프레임에 멈춘 것.
     시계 자동 전환(6시/19시)도 같은 길을 지나므로, 머물러 있으면 방에 실제로 해가 진다 ── */
  var NO_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUR = 2;                                     // 클립 길이(초) — 메타데이터가 오면 실측으로 갱신
  fwd.addEventListener('loadedmetadata', function () { DUR = fwd.duration || DUR; });
  function END() { return Math.max(0, DUR - 0.017); }   // 마지막 프레임 안쪽 — ended 상태를 피한다

  /* 반딧불 점등·소등 — 밤이 완성되면 떠오르고, 새벽이 시작되면 그 자리에서 잦아든다.
     루프 위상은 어디든 상관없다: 전환 필름엔 반딧불이 없어서 이어붙을 상대가 없다 */
  var ffOn = false, ffTimer = null;
  function ffShow() {
    if (NO_MOTION || ff.error) return;
    ffOn = true;
    clearTimeout(ffTimer);
    var p = ff.play();
    if (p) p.catch(function () {});
    ff.classList.add('on');
  }
  function ffHide() {
    ffOn = false;
    ff.classList.remove('on');
    clearTimeout(ffTimer);
    ffTimer = setTimeout(function () { if (!ffOn) ff.pause(); }, 1500);  // 페이드가 끝난 뒤 필름 정지
  }
  var playingTo = null;                            // 지금 필름이 향하는 테마 ('night'|'day'|null)
  var seekGen = 0;                                 // 연타 가드 — 늦게 도착한 seek 콜백은 버린다
  function seekTo(v, t, cb) {
    var gen = ++seekGen, fired = false;
    var done = function () {
      if (fired) return;
      fired = true;
      v.removeEventListener('seeked', done);
      if (gen === seekGen) cb();
    };
    if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) { done(); return; }
    v.addEventListener('seeked', done);
    setTimeout(done, 300);                         // seeked가 침묵해도 방은 멈추지 않는다
    try { v.currentTime = t; } catch (e) { done(); }
  }
  function show(v, other) { v.hidden = false; other.hidden = true; other.pause(); }
  function play(v, t) {
    var p = v.play();
    if (p) p.catch(function (e) {
      console.warn('room clip refused to play', e && e.name, e && e.message);
      settle(t);                                   // 재생이 막히면 점프컷으로라도 밤낮은 맞춘다
    });
  }
  function settle(t) {                             // 전환 없이 그 테마의 정지 화면으로
    bowlHide();
    playingTo = null;
    fwd.pause(); rev.pause();
    if (t === 'night') ffShow(); else ffHide();
    seekTo(fwd, t === 'night' ? END() : 0, function () { show(fwd, rev); });
  }
  function transitionTo(t) {
    bowlHide();                                    // 방 필름이 도는 동안 패치는 걷는다
    if (NO_MOTION || fwd.error || rev.error) { settle(t); return; }
    if (t === 'night') {
      /* 밤으로 — fwd를 튼다. rev가 달리는 중이었으면 거울 시각에서 이어받는다 */
      var at = (!rev.hidden && playingTo === 'day') ? Math.max(0, DUR - rev.currentTime) : fwd.currentTime;
      playingTo = 'night';
      seekTo(fwd, at, function () { show(fwd, rev); play(fwd, 'night'); });
    } else {
      /* 아침으로 — rev를 fwd의 거울 시각에 맞춰 튼다. 스왑은 seek이 끝난 뒤라 깜빡임이 없다.
         반딧불은 새벽이 시작되는 즉시 그 자리에서 잦아든다 */
      ffHide();
      var mirror = Math.max(0, DUR - fwd.currentTime);
      playingTo = 'day';
      seekTo(rev, mirror, function () { show(rev, fwd); play(rev, 'day'); });
    }
  }
  fwd.addEventListener('ended', function () {
    if (playingTo === 'night') { playingTo = null; fwd.pause(); ffShow(); }  // 밤이 완성된 뒤에야 반딧불이 뜬다
  });
  rev.addEventListener('ended', function () { if (playingTo === 'day') settle('day'); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { bowlHide(); return; }   // 탭을 떠나면 브라우저가 필름을 멈춘다 — 반쯤 멈춘 워블은 걷는다
    if (ffOn && ff.paused) { var p = ff.play(); if (p) p.catch(function () {}); }
    if (!playingTo) return;
    var v = playingTo === 'night' ? fwd : rev;
    if (v.paused) play(v, playingTo);              // 돌아온 순간 그 자리부터 다시 돈다
  });
  var lastTheme = themeName();
  new MutationObserver(function () {
    var t = themeName();
    if (t === lastTheme) return;
    lastTheme = t;
    transitionTo(t);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function clockTheme() { var h = new Date().getHours(); return h >= 6 && h < 19 ? 'day' : 'night'; }
  function themeName() { return document.documentElement.dataset.theme === 'night' ? 'night' : 'day'; }
  window.amToggleTheme = function () {
    var next = themeName() === 'night' ? 'day' : 'night';
    try {
      if (next === clockTheme()) localStorage.removeItem('am-theme-override');
      else localStorage.setItem('am-theme-override', next);
    } catch (e) {}
    document.documentElement.dataset.theme = next;
  };
  (function mountThemeChip() {                     // .s3-nav는 session.js(뒤 스크립트)가 짓는다 — 지어질 때까지 기다린다
    var nav = document.querySelector('.s3-nav');
    if (!nav) { requestAnimationFrame(mountThemeChip); return; }
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 's3-chip s3-navtheme';
    b.setAttribute('aria-label', 'switch day and night');
    var paint = function () {
      var n = themeName();
      b.textContent = n;
      b.setAttribute('aria-pressed', n === 'night' ? 'true' : 'false');
    };
    paint();
    b.addEventListener('click', window.amToggleTheme);
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    nav.insertBefore(b, nav.firstChild);
  })();

  /* ── 첫 프레임 — 필름의 첫 장이 풀리면 방이 열린다 (로더·세션 등장·관문이 듣는다).
     밤에 열었으면 끝 프레임으로 감아 둔 다음에 연다 ── */
  var readyFired = false;
  function fireReady() {
    if (readyFired) return;
    readyFired = true;
    document.documentElement.dataset.amReady = '1';
    window.dispatchEvent(new Event('am-ready'));
  }
  function firstFrame() {
    if (themeName() === 'night') nightOpen(0);
    else fireReady();
  }
  /* Range 없는 서버·느린 회선에선 첫 seek이 0으로 클램프되거나 300ms 폴백이 먼저 울린다 —
     끝 프레임에 진짜 닿았는지 재고, 데이터가 더 오면 다시 감는다 */
  function nightOpen(tries) {
    seekTo(fwd, END(), function () {
      var landed = Math.abs(fwd.currentTime - END()) < 0.05;
      if (landed) { fireReady(); ffShow(); return; }
      var unseekable = fwd.readyState >= 3 &&
        (!fwd.seekable.length || fwd.seekable.end(fwd.seekable.length - 1) < END() - 0.05);
      if (unseekable || tries >= 8) { nightByPlaying(); return; }
      var once = false;
      var re = function () {
        if (once) return;
        once = true;
        fwd.removeEventListener('canplaythrough', re);
        fwd.removeEventListener('progress', re);
        nightOpen(tries + 1);
      };
      fwd.addEventListener('canplaythrough', re);
      fwd.addEventListener('progress', re);
      setTimeout(re, 700);
    });
  }
  /* 시킹이 안 되는 서버(Range 미지원)에선 필름을 끝까지 틀어서 밤에 닿는다 — 로더가 가려 주는 2초 */
  function nightByPlaying() {
    var once = false;
    var arrive = function () {
      if (once) return;
      once = true;
      fwd.removeEventListener('ended', arrive);
      fwd.pause();
      fireReady();
      ffShow();
    };
    fwd.addEventListener('ended', arrive);
    setTimeout(arrive, (DUR + 1.5) * 1000);      // 재생마저 막혀도 방은 연다
    var p = fwd.play();
    if (p) p.catch(arrive);
  }
  if (fwd.readyState >= 2) firstFrame();
  else fwd.addEventListener('loadeddata', firstFrame, { once: true });
  fwd.addEventListener('error', fireReady);       // 필름이 없어도 방문은 이어진다 — 마당색 위에서

  /* ── session.js가 빌리는 몸 — 3D 시절과 같은 이름들 ── */
  window.__am = {
    HOTS: HOTS,
    bowl: ding,
    tick: tick,
    sit: sitDown,
    rise: riseUp,
    musicToggle: toggleMusic,
    music: function () {
      return {
        on: musicOn, ready: ytReady,
        state: ytReady ? ytPlayer.getPlayerState() : null,
        muted: ytReady ? ytPlayer.isMuted() : null,
        t: ytReady ? ytPlayer.getCurrentTime() : null,
        vol: ytReady ? Math.round(ytPlayer.getVolume()) : null,
        title: ytReady && ytPlayer.getVideoData() ? ytPlayer.getVideoData().title : null,
      };
    },
    amb: function () {
      var A = window.__ambient;
      if (!A) return null;
      var info = function (a) { return { t: a.currentTime, vol: +a.volume.toFixed(3), paused: a.paused, dur: a.duration }; };
      return { unlocked: A.on(), mode: themeName(), day: info(A.els.day), night: info(A.els.night) };
    },
    ff: function () {
      return { on: ffOn, t: +ff.currentTime.toFixed(2), paused: ff.paused,
        opacity: getComputedStyle(ff).opacity, err: ff.error ? ff.error.code : null };
    },
  };
})();
