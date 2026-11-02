/* ==========================================================
   音效模組 — Web Audio 合成，不需任何音檔
   ========================================================== */
const Sfx = (function () {
  'use strict';
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, opts) {
    const c = ac();
    if (!c || muted) return;
    opts = opts || {};
    const t0 = c.currentTime + (opts.delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain || 0.18, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  return {
    setMuted: function (v) { muted = v; },
    isMuted: function () { return muted; },

    click: function () { tone(660, 0.07, { type: 'square', gain: 0.07 }); },

    roll: function () {
      for (let i = 0; i < 6; i++) {
        tone(220 + Math.random() * 480, 0.05, { type: 'triangle', gain: 0.06, delay: i * 0.09 });
      }
    },

    land: function () { tone(170, 0.22, { type: 'sine', gain: 0.28, slideTo: 80 }); },

    dup: function () {
      tone(230, 0.16, { type: 'sawtooth', gain: 0.11 });
      tone(180, 0.24, { type: 'sawtooth', gain: 0.11, delay: 0.13 });
    },

    flip: function () { tone(480, 0.1, { type: 'triangle', gain: 0.11, slideTo: 940 }); },

    success: function () {
      tone(523, 0.13, { gain: 0.15 });
      tone(659, 0.13, { gain: 0.15, delay: 0.1 });
      tone(784, 0.2, { gain: 0.15, delay: 0.2 });
    },

    fanfare: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.22, { gain: 0.17, delay: i * 0.13 }); });
      tone(1318, 0.42, { gain: 0.19, delay: 0.55 });
    },

    tick: function () { tone(1000, 0.05, { type: 'square', gain: 0.08 }); },

    alarm: function () {
      for (let i = 0; i < 4; i++) {
        tone(880, 0.18, { type: 'square', gain: 0.18, delay: i * 0.4 });
        tone(622, 0.18, { type: 'square', gain: 0.18, delay: i * 0.4 + 0.2 });
      }
    }
  };
})();
