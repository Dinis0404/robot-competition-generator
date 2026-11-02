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
   十面骰（d10）— 五棱十二面體風格 SVG，點數 1～10 對應地點 01～10
   滾動時整顆旋轉翻滾 + 跳號，停止時落在大字點數上
   ========================================================== */
const Dice10 = (function () {
  'use strict';
  let el = null;
  let numEl = null;
  let cycling = null;
  let rolling = false;

  /** 生成 d10（五棱十二面體）正面視圖 SVG：上下頂點 + 赤道橢圓 10 點組成 10 個風箏面 */
  function d10Svg() {
    const T = [0, -95], B = [0, 95];
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = k * Math.PI / 5;               // 36° 步進
      pts.push([92 * Math.cos(a), 26 * Math.sin(a)]);
    }
    let faces = '';
    // 先畫背面（暗），再畫正面（亮），正面中央最亮
    const order = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4];
    order.forEach(function (k) {
      const p1 = pts[k], p2 = pts[(k + 1) % 10];
      const front = (p1[1] + p2[1]) >= 0;
      const cx = Math.abs((p1[0] + p2[0]) / 2);
      let fill;
      if (front) {
        const t = Math.pow(Math.max(0, 1 - cx / 92), 1.4);
        const L = Math.round(64 + 34 * t);
        fill = 'hsl(228, 32%, ' + L + '%)';
      } else {
        fill = 'hsl(228, 26%, 46%)';
      }
      faces += '<polygon points="' + T[0] + ',' + T[1] + ' ' +
        p1[0].toFixed(1) + ',' + p1[1].toFixed(1) + ' ' +
        B[0] + ',' + B[1] + ' ' +
        p2[0].toFixed(1) + ',' + p2[1].toFixed(1) +
        '" fill="' + fill + '" stroke="rgba(26,36,80,.45)" stroke-width="1.5"/>';
    });
    // 上下頂點小亮面
    return '<svg viewBox="-105 -112 210 224" xmlns="http://www.w3.org/2000/svg">' +
      '<ellipse cx="0" cy="0" rx="92" ry="26" fill="none" stroke="rgba(26,36,80,.18)" stroke-width="1"/>' +
      faces +
      '<circle cx="0" cy="-95" r="4.5" fill="#e8edff"/>' +
      '<circle cx="0" cy="95" r="4.5" fill="#8d99c9"/>' +
      '</svg>';
  }

  function build(container) {
    el = container;
    el.innerHTML = d10Svg() + '<span class="d10-num">?</span>';
    numEl = el.querySelector('.d10-num');
    el.classList.remove('rolling', 'land');
  }

  /** 擲骰：旋轉翻滾 + 跳號 dur 毫秒後停在 face，回傳 Promise */
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
        }, 380);
      }, dur);
    });
  }

  return {
    build: build,
    rollTo: rollTo,
    isRolling: function () { return rolling; }
  };
})();
