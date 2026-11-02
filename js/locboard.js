/* ==========================================================
   地點卡牌桌 — 建立 / 洗牌動畫 / 翻牌 / 自動揭曉
   每張卡背後藏一個地點；被抽中的地點附帶任務配對
   ========================================================== */
const LocBoard = (function () {
  'use strict';

  let gridEl = null;
  let items = [];      // 與 DOM 子元素順序一致
  let onFlipCb = null; // function(item)
  let busy = false;

  function shuffleArr(arr) {
    const a = arr.slice();
    const buf = new Uint32Array(a.length);
    crypto.getRandomValues(buf);
    for (let i = a.length - 1; i > 0; i--) {
      const j = buf[i] % (i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function build(el, entries, opts) {
    gridEl = el;
    onFlipCb = (opts && opts.onFlip) || null;
    items = entries.map(function (e) { return { loc: e.loc, task: e.task || null, revealed: false }; });
    gridEl.classList.remove('shuffling');
    gridEl.innerHTML = '';
    items.forEach(function (it, i) {
      const card = document.createElement('div');
      card.className = 'loc-card';
      card.style.animationDelay = (i * 0.05) + 's';
      card.innerHTML =
        '<div class="loc-inner">' +
        '  <div class="loc-face loc-front">' +
        '    <div class="q-mark">?</div>' +
        '    <div class="loc-brand">ROBOT RACE</div>' +
        '  </div>' +
        '  <div class="loc-face loc-rear">' + rearHtml(it) + '</div>' +
        '</div>';
      // 綁定「物件」而非索引：洗牌會交換 DOM 順序，索引會失準
      card.addEventListener('click', function () { tapFlip(it); });
      gridEl.appendChild(card);
      it.el = card;
    });
  }

  function rearHtml(it) {
    if (it.task) {
      const t = window.APP_GET_TASK(it.task);
      const color = window.APP_TASK_COLOR(it.task);
      const img = t && t.image ? '<img class="loc-thumb" src="' + t.image + '" alt="">' : '';
      return '<div class="loc-num">' + it.loc.id + '</div>' +
        '<div class="loc-name">' + esc(it.loc.name || '') + '</div>' +
        '<div class="loc-task-chip" style="--tc:' + color + '">⚙ ' + esc(it.task) + ' · ' + esc(t ? t.title : '') + '</div>' + img;
    }
    return '<div class="loc-num miss-num">✕</div>' +
      '<div class="loc-miss-label">未選中</div>';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function tapFlip(it) {
    if (!it || it.revealed || busy || gridEl.classList.contains('shuffling')) return;
    flipOne(it);
  }

  function flipOne(it) {
    it.revealed = true;
    it.el.classList.add('flipped');
    if (it.task) it.el.classList.add('is-hit');
    else it.el.classList.add('is-miss');
    Sfx.flip();
    if (onFlipCb) onFlipCb(it);
  }

  /** 視覺洗牌：隨機挑兩張互換位置（FLIP 動畫） */
  function shuffle(rounds) {
    if (!gridEl || busy) return Promise.resolve();
    busy = true;
    gridEl.classList.add('shuffling');
    rounds = rounds || 11;
    let chain = Promise.resolve();
    for (let r = 0; r < rounds; r++) {
      chain = chain.then(function () { return swapTwo(); });
    }
    return chain.then(function () {
      gridEl.classList.remove('shuffling');
      busy = false;
    });
  }

  function swapTwo() {
    return new Promise(function (resolve) {
      const n = items.length;
      if (n < 2) return resolve();
      let i = Math.floor(Math.random() * n);
      let j = Math.floor(Math.random() * n);
      while (j === i) j = Math.floor(Math.random() * n);

      const ea = items[i].el, eb = items[j].el;
      const ra = ea.getBoundingClientRect();
      const rb = eb.getBoundingClientRect();
      const dx1 = rb.left - ra.left, dy1 = rb.top - ra.top;
      const dx2 = ra.left - rb.left, dy2 = ra.top - rb.top;
      const rot = (Math.random() * 14 - 7).toFixed(1);

      ea.classList.add('shuffling-anim');
      eb.classList.add('shuffling-anim');
      ea.style.transition = 'transform .3s cubic-bezier(.45,.1,.25,1)';
      eb.style.transition = 'transform .3s cubic-bezier(.45,.1,.25,1)';
      ea.style.transform = 'translate(' + dx1 + 'px,' + dy1 + 'px) rotate(' + rot + 'deg) scale(1.07)';
      eb.style.transform = 'translate(' + dx2 + 'px,' + dy2 + 'px) rotate(' + (-rot) + 'deg) scale(1.07)';
      Sfx.click();

      setTimeout(function () {
        ea.style.transition = 'none';
        eb.style.transition = 'none';
        ea.style.transform = '';
        eb.style.transform = '';
        // 交換 DOM 順序，讓兩張卡真正互換格子位置（marker 法，任意相對位置都成立）
        const marker = document.createElement('div');
        marker.style.display = 'none';
        gridEl.insertBefore(marker, ea);
        gridEl.insertBefore(ea, eb);
        gridEl.insertBefore(eb, marker);
        marker.remove();
        // 同步 items 順序
        const t = items[i]; items[i] = items[j]; items[j] = t;
        ea.classList.remove('shuffling-anim');
        eb.classList.remove('shuffling-anim');
        // 不用 rAF（背景分頁時 rAF 會停擺），getBoundingClientRect 會自動強制重排
        setTimeout(resolve, 40);
      }, 320);
    });
  }

  /** 自動依隨機順序翻牌，全部翻完回呼 onDone */
  function autoReveal(onDone) {
    if (!gridEl || busy) return;
    busy = true;
    const pending = shuffleArr(items.filter(function (it) { return !it.revealed; }));
    let chain = Promise.resolve();
    pending.forEach(function (it) {
      chain = chain.then(function () {
        flipOne(it);
        return new Promise(function (res) { setTimeout(res, 620); });
      });
    });
    return chain.then(function () {
      busy = false;
      if (onDone) onDone();
    });
  }

  /** 翻開所有還沒翻的卡（不換順序） */
  function revealRest() {
    if (!gridEl || busy) return Promise.resolve();
    busy = true;
    const pending = items.filter(function (it) { return !it.revealed; });
    let chain = Promise.resolve();
    pending.forEach(function (it) {
      chain = chain.then(function () {
        flipOne(it);
        return new Promise(function (res) { setTimeout(res, 260); });
      });
    });
    return chain.then(function () { busy = false; });
  }

  function stats() {
    let revealed = 0, hits = 0;
    items.forEach(function (it) {
      if (it.revealed) { revealed++; if (it.task) hits++; }
    });
    return { revealed: revealed, hits: hits, total: items.length };
  }

  return {
    build: build,
    shuffle: shuffle,
    autoReveal: autoReveal,
    revealRest: revealRest,
    stats: stats,
    items: function () { return items; }
  };
})();
