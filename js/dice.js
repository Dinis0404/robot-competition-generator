/* ==========================================================
   3D 骰子模組 — CSS 3D cube
   面配置：前1 後6 右3 左4 上2 下5（相對面和為 7）
   ========================================================== */
const Dice = (function () {
  'use strict';

  // 每個點數在 3x3 格中的 pip 位置（index 0..8）
  const PIPS = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };
  // 讓指定點數朝向正面所需的旋轉 [rotateX, rotateY]
  const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

  let el = null;
  let rx = 0;
  let ry = 0;
  let current = 1;
  let rolling = false;

  function mod360(d) { return ((d % 360) + 360) % 360; }

  /** 密碼學等級隨機整數 1..n（含頭尾） */
  function randInt(n) {
    const max = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    let v;
    do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= max);
    return (v % n) + 1;
  }

  function build(container) {
    el = container;
    let html = '';
    for (let f = 1; f <= 6; f++) {
      html += '<div class="face face-' + f + '">';
      PIPS[f].forEach(function (cell) {
        const row = Math.floor(cell / 3) + 1;
        const col = (cell % 3) + 1;
        html += '<span class="pip" style="grid-area:' + row + ' / ' + col + '"></span>';
      });
      html += '</div>';
    }
    el.innerHTML = html;
    el.style.transform = 'rotateX(0deg) rotateY(0deg)';
  }

  /**
   * 擲骰：轉兩圈以上後停在指定點數，回傳 Promise
   */
  function rollTo(face, dur) {
    dur = dur || 1450;
    return new Promise(function (resolve) {
      if (!el) return resolve();
      rolling = true;
      current = face;
      const tr = FACE_ROT[face];
      rx += 720 + mod360(tr[0] - rx);
      ry += 720 + mod360(tr[1] - ry);
      el.style.transition = 'transform ' + dur + 'ms cubic-bezier(.16,.6,.08,1)';
      el.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
      setTimeout(function () {
        rolling = false;
        resolve();
      }, dur + 80);
    });
  }

  return {
    build: build,
    rollTo: rollTo,
    randInt: randInt,
    get current() { return current; },
    isRolling: function () { return rolling; }
  };
})();

/* ==========================================================
   十面骰（d10）— 點數 1～10 對應地點 01～10
   以「翻滾動畫 + 快速跳號」呈現，停止時落在大字點數上
   ========================================================== */
const Dice10 = (function () {
  'use strict';
  let el = null;
  let numEl = null;
  let cycling = null;
  let rolling = false;

  function build(container) {
    el = container;
    numEl = el.querySelector('.d10-num');
    el.classList.remove('rolling', 'land');
    numEl.textContent = '?';
  }

  /** 擲骰：拋擲翻滾 + 跳號 dur 毫秒後停在 face，回傳 Promise */
  function rollTo(face, dur) {
    dur = dur || 1250;
    return new Promise(function (resolve) {
      if (!el) return resolve();
      rolling = true;
      const wrap = el.closest('.dice-wrap');
      el.classList.remove('land');
      el.classList.add('rolling');
      if (wrap) wrap.classList.add('d10-rolling');
      Sfx.roll();
      // 快速跳號
      cycling = setInterval(function () {
        numEl.textContent = String(randInt(10));
      }, 75);
      setTimeout(function () {
        clearInterval(cycling);
        cycling = null;
        el.classList.remove('rolling');
        if (wrap) wrap.classList.remove('d10-rolling');
        el.classList.add('land');
        numEl.textContent = String(face);
        Sfx.land();
        setTimeout(function () {
          el.classList.remove('land');
          rolling = false;
          resolve();
        }, 420);
      }, dur);
    });
  }

  return {
    build: build,
    rollTo: rollTo,
    isRolling: function () { return rolling; }
  };
})();
