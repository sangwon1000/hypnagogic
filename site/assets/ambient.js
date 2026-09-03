/* 정글 앰비언스 — 어느 페이지에 있든 흐르고, 페이지를 옮겨도 이어진다.
   유튜브에서 추출해 둔 1시간짜리 로컬 오디오(assets/audio/) 두 트랙을
   함께 틀어 두고 낮밤 따라 볼륨만 크로스페이드한다(사파리 제스처 규칙 대응).
   단 iOS는 볼륨을 웹에 맡기지 않아 섞기가 통하지 않는다 — 그런 기기에서는
   지금 시간대의 것만 틀고 나머지는 재운다(아래 mixable).
   재생 위치는 localStorage에 적어 두고 다음 페이지가 그 자리부터 잇는다. */
(function () {
  if (window.top !== window) return;                 // 액자(iframe) 안에서는 침묵 — 소리는 바깥 방이 맡는다
  const VOL = 0.3;
  const KEY = 'am-amb-pos';
  const base = document.currentScript.src.replace(/[^/]*$/, '');
  const els = {
    day: new Audio(base + 'audio/jungle-day.m4a'),
    night: new Audio(base + 'audio/jungle-night.m4a'),
  };

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  Object.keys(els).forEach(k => {
    const a = els[k];
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    a.addEventListener('loadedmetadata', () => {
      const t = saved[k];
      a.currentTime = typeof t === 'number' && t > 0 && t < a.duration - 5
        ? t                                                          // 지난 페이지에서 듣던 자리부터
        : Math.random() * Math.max(0, a.duration - 60);              // 처음이면 아무 데서나
    });
  });

  let on = false;

  /* 소리가 흐르는 동안 화면도 깨어 있는다 — 탭이 보일 때만 잡고,
     탭이 숨거나 잠기면 브라우저가 알아서 놓는다(그때 소리도 같이 쉰다) */
  let lock = null;
  async function grabLock() {
    if (!('wakeLock' in navigator) || lock || document.hidden || !on) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch (e) {}
  }

  /* 소리의 크기를 우리가 정할 수 있는가 — iOS는 아니다. audio.volume 에 적어 넣는 것까지는
     받아 주지만, 울리는 동안 플랫폼이 슬그머니 1로 되돌려 놓는다(멈춰 있을 때는 우리 값을
     그대로 되읽어 주니, 재생 전 검사는 늘 거짓말을 한다 — iOS 26 시뮬레이터에서 실측).
     그래서 낮과 밤을 겹쳐 틀고 크기로 섞던 이 방식이 폰에서는 둘 다 제 소리로 울렸다.
     되돌려진 것을 보는 순간 섞기를 포기하고, 지금 시간대의 것만 틀고 나머지는 재운다 —
     폰에서는 크로스페이드 대신 갈아 끼우기. 웹오디오는 부르지 않는다: 방(room2d)이 이미
     제 AudioContext를 쓰고 있고, iOS에서 둘을 함께 세우는 건 조용해질 위험이 더 크다 */
  let mixable = true;

  const mode = () => document.documentElement.dataset.theme === 'night' ? 'night' : 'day';

  /* 지난 틱에 적어 둔 값이 그대로 남아 있는가 — 되돌림은 우리 손 밖에서, 한 박자 뒤에 일어난다.
     그래서 검사도 한 박자 뒤에. 우리가 쓰는 값은 늘 VOL(0.3) 이하라, 1로 돌아와 있으면 그것이 증거다 */
  function audit() {
    if (!mixable) return;
    Object.values(els).forEach(a => {
      if (a.paused || a.wrote === undefined) return;
      if (Math.abs(a.volume - a.wrote) > 0.02) mixable = false;
    });
    if (!mixable) Object.values(els).forEach(a => { a.volume = VOL; });   // 손잡이가 듣는 기기였다면 제 크기로
  }

  function ramp(k, target) {
    const a = els[k];
    a.wrote = a.volume + (target - a.volume) * 0.2;
    a.volume = a.wrote;
  }

  function settle() {
    if (!on) return;
    const m = mode();
    Object.keys(els).forEach(k => {
      const a = els[k];
      const wanted = mixable || k === m;                               // 섞을 수 있으면 둘 다, 아니면 지금의 것만
      if (wanted && a.paused) { const p = a.play(); if (p) p.catch(() => {}); }
      else if (!wanted && !a.paused) a.pause();
    });
    if (!mixable) return;
    audit();
    ramp('day', m === 'day' ? VOL : 0);
    ramp('night', m === 'night' ? VOL : 0);
  }

  function start() {
    if (on) return;
    on = true;
    /* 둘 다 이 손길로 잠금을 푼다 — 그래야 몇 시간 뒤 밤이 와도 제스처 없이 든다.
       섞을 수 없는 기기라면 바로 뒤의 settle()이 한쪽을 도로 재운다 */
    Object.values(els).forEach(a => {
      const p = a.play();
      if (p) p.catch(() => { on = false; });                         // 막히면 다음 터치에 재시도
    });
    grabLock();
    settle();
  }
  start();                                                           // 사이트 안에서 넘어왔으면 바로 이어진다
  document.addEventListener('pointerdown', start);                   // 첫 방문이면 첫 터치에 깨어난다
  document.addEventListener('pointerdown', grabLock);                // 로드 때 거부됐어도 터치에 다시 잡는다

  setInterval(settle, 100);

  function save() {
    if (!on) return;
    try { localStorage.setItem(KEY, JSON.stringify({ day: els.day.currentTime, night: els.night.currentTime })); } catch (e) {}
  }
  setInterval(save, 3000);
  addEventListener('pagehide', save);

  /* 탭이 뒤로 물러나면 조용해진다 — 이 탭을 보고 있을 때만 소리 */
  let hiddenPause = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!on) return;
      hiddenPause = true;
      Object.values(els).forEach(a => a.pause());
      save();
    } else {
      if (hiddenPause) { hiddenPause = false; settle(); }             // 지금 시간대의 것만 다시 든다
      grabLock();                                                    // 돌아오면 화면 지킴이도 다시 잡는다
    }
  });

  window.__ambient = { els, on: () => on, mode, lock: () => !!lock, mixable: () => mixable };
})();
