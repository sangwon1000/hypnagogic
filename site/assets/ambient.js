/* 정글 앰비언스 — 어느 페이지에 있든 흐르고, 페이지를 옮겨도 이어진다.
   유튜브에서 추출해 둔 1시간짜리 로컬 오디오(assets/audio/) 두 트랙을
   함께 틀어 두고 낮밤 따라 볼륨만 크로스페이드한다(사파리 제스처 규칙 대응).
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

  function start() {
    if (on) return;
    on = true;
    Object.values(els).forEach(a => {
      const p = a.play();
      if (p) p.catch(() => { on = false; });                         // 막히면 다음 터치에 재시도
    });
    grabLock();
  }
  start();                                                           // 사이트 안에서 넘어왔으면 바로 이어진다
  document.addEventListener('pointerdown', start);                   // 첫 방문이면 첫 터치에 깨어난다
  document.addEventListener('pointerdown', grabLock);                // 로드 때 거부됐어도 터치에 다시 잡는다

  const mode = () => document.documentElement.dataset.theme === 'night' ? 'night' : 'day';
  setInterval(() => {
    if (!on) return;
    const m = mode();
    els.day.volume += ((m === 'day' ? VOL : 0) - els.day.volume) * 0.2;
    els.night.volume += ((m === 'night' ? VOL : 0) - els.night.volume) * 0.2;
  }, 100);

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
      if (hiddenPause) {
        hiddenPause = false;
        Object.values(els).forEach(a => { const p = a.play(); if (p) p.catch(() => {}); });
      }
      grabLock();                                                    // 돌아오면 화면 지킴이도 다시 잡는다
    }
  });

  window.__ambient = { els, on: () => on, mode, lock: () => !!lock };
})();
