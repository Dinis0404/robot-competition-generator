/* ==========================================================
   倒計時引擎 — 基於時間戳，切頁不漂移
   ========================================================== */
const Timer = (function () {
  'use strict';
  let totalMs = 0;
  let remainingMs = 0;
  let endAt = 0;
  let running = false;
  let intervalId = null;
  let cbTick = null;
  let cbFinish = null;
  let lastWholeSec = -1;

  function pad(n) { return String(n).padStart(2, '0'); }

  function split(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return {
      h: Math.floor(s / 3600),
      m: Math.floor((s % 3600) / 60),
      s: s % 60,
      whole: s
    };
  }

  function fmt(ms) {
    const t = split(ms);
    return pad(t.h) + ':' + pad(t.m) + ':' + pad(t.s);
  }

  // 用 setInterval 而非 rAF：背景分頁時 rAF 會停擺，計時器不能漏掉結束瞬間
  function frame() {
    if (!running) return;
    const left = Math.max(0, endAt - Date.now());
    const t = split(left);
    if (t.whole !== lastWholeSec) {
      lastWholeSec = t.whole;
      if (cbTick) cbTick({ text: fmt(left), ms: left, secondsLeft: t.whole, fraction: totalMs ? left / totalMs : 0 });
      if (t.whole === 0) {
        running = false;
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        if (cbFinish) cbFinish();
        return;
      }
    }
  }

  return {
    init: function (seconds, opts) {
      totalMs = seconds * 1000;
      remainingMs = totalMs;
      cbTick = opts && opts.onTick;
      cbFinish = opts && opts.onFinish;
      running = false;
      lastWholeSec = -1;
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    },
    start: function () {
      if (running || remainingMs <= 0) return;
      endAt = Date.now() + remainingMs;
      running = true;
      lastWholeSec = -1;
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(frame, 200);
      frame();
    },
    pause: function () {
      if (!running) return;
      remainingMs = Math.max(0, endAt - Date.now());
      running = false;
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    },
    reset: function () {
      this.init(totalMs / 1000, { onTick: cbTick, onFinish: cbFinish });
    },
    isRunning: function () { return running; },
    remaining: function () {
      return running ? Math.max(0, endAt - Date.now()) : remainingMs;
    },
    total: function () { return totalMs; }
  };
})();
