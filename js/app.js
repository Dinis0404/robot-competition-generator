/* ==========================================================
   主流程 — 載入內容 → 擲骰抽任務 → 翻卡配地點 → 倒計時
   ========================================================== */
(function () {
  'use strict';

  // ---------------- 資料 ----------------
  let DATA = null; // { cfg, fixedCodes, randomCodes, tasks, locations }
  const PALETTE = ['#4cc9f0', '#7b5cff', '#3ddc97', '#ffc857', '#ff7ab6', '#5eb0ff', '#ff9d5c', '#63e6be', '#ffe066', '#c78bff'];

  // 本次抽籤狀態
  const state = {
    drawnCodes: [],   // 本輪抽中的隨機任務（依抽出順序）
    finalTasks: [],   // 固定 + 抽中，共 7 個代號
    pairs: [],        // [{task, loc:{id,name}}] 依擲骰順序
    timerStarted: false,
    round: 1          // 比賽輪次：第 2 輪起沿用任務、地點重新隨機
  };
  let rollCursor = 0;     // 已完成配對的任務數
  let usedLocs = new Set(); // 已占用的地點編號
  let taskOrder = [];     // 打亂後的擲骰順序（任務代號）

  const $ = function (sel) { return document.querySelector(sel); };
  const $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function taskColor(code) {
    if (!DATA) return 'var(--acc)';
    const all = DATA.fixedCodes.concat(DATA.randomCodes);
    const i = all.indexOf(code);
    return PALETTE[(i >= 0 ? i : 0) % PALETTE.length];
  }

  // 給 locboard.js 使用的鉤子
  window.APP_GET_TASK = function (code) { return DATA && DATA.tasks[code]; };
  window.APP_TASK_COLOR = taskColor;

  // ---------------- 載入內容 ----------------
  function fetchText(url) {
    // cache: 'no-cache' → 每次向伺服器驗證版本，改完 md 推上 GitHub 立即生效
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
      return r.text();
    });
  }

  function intOr(v, dflt) {
    const n = parseInt(v, 10);
    return isNaN(n) ? dflt : n;
  }

  async function boot() {
    try {
      const cfgRaw = MD.parseFrontmatter(await fetchText('content/config.md'));
      const cfg = cfgRaw.attrs;
      const locRaw = MD.parseFrontmatter(await fetchText('content/locations.md'));

      const locations = locRaw.body.split('\n').map(function (l) { return l.trim(); })
        .filter(function (l) { return l && l.charAt(0) !== '#'; })
        .map(function (l) {
          const parts = l.split('|');
          return { id: parts[0].trim(), name: (parts[1] || '').trim() };
        })
        .filter(function (loc) { return /^[A-Za-z0-9_-]+$/.test(loc.id); });

      const fixedCodes = (cfg.fixed_tasks || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      const randomCodes = (cfg.random_tasks || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      const need = intOr(cfg.r_draw, 3);
      if (need > randomCodes.length) throw new Error('config：r_draw（' + need + '）不可大於隨機任務數量（' + randomCodes.length + '）');

      const codes = fixedCodes.concat(randomCodes);
      const tasks = {};
      await Promise.all(codes.map(async function (code) {
        const raw = await fetchText('content/tasks/' + code + '.md');
        const parsed = MD.parseFrontmatter(raw);
        tasks[code] = {
          code: code,
          title: parsed.attrs.title || code,
          image: parsed.attrs.image || '',
          tag: parsed.attrs.tag || (fixedCodes.indexOf(code) >= 0 ? '固定任務' : '隨機任務'),
          body: parsed.body,
          desc: MD.firstPlain(parsed.body)
        };
      }));

      DATA = {
        cfg: {
          title: cfg.title || '機器人競賽 · 抽籤生成器',
          rDraw: need,
          minutes: intOr(cfg.timer_minutes, 90)
        },
        fixedCodes: fixedCodes,
        randomCodes: randomCodes,
        tasks: tasks,
        locations: locations
      };

      // 十面骰固定對應 10 個地點
      if (DATA.locations.length !== 10) {
        throw new Error('十面骰對應 10 個地點：請在 content/locations.md 維護恰好 10 個地點（目前 ' + DATA.locations.length + ' 個）');
      }
      const taskTotal = fixedCodes.length + need;
      if (taskTotal > 10) {
        throw new Error('任務總數（固定 ' + fixedCodes.length + ' + 隨機 ' + need + ' = ' + taskTotal + '）不可超過地點數量 10');
      }

      renderStatic();
      renderHistory();
    } catch (err) {
      showFatal(err && err.message ? err.message : String(err));
    }
  }

  function showFatal(msg) {
    $('#fatalMsg').textContent = msg;
    $('#fatal').classList.remove('hidden');
  }

  // ---------------- 靜態渲染 ----------------
  function renderStatic() {
    document.title = DATA.cfg.title;
    $('#siteTitle').textContent = DATA.cfg.title;
    $('#heroTitle').innerHTML = escHtml(DATA.cfg.title).replace(/(·|｜|\||-|—)\s*[^<]*$/, '') + '<br><span class="grad-text">抽籤生成器</span>';
    $$('.js-rdraw').forEach(function (el) { el.textContent = DATA.cfg.rDraw; });
    const tcountVal = DATA.fixedCodes.length + DATA.cfg.rDraw;
    $$('.js-tcount').forEach(function (el) { el.textContent = tcountVal; });
    $$('.js-minutes').forEach(function (el) { el.textContent = DATA.cfg.minutes; });
    $('#footerYear').textContent = new Date().getFullYear();

    $('#randomPreview').innerHTML = DATA.randomCodes.map(function (c, i) { return taskCardHtml(c, i); }).join('');
    $('#fixedCards').innerHTML = DATA.fixedCodes.map(function (c, i) { return taskCardHtml(c, i); }).join('');
    $('#drawCards').innerHTML = DATA.randomCodes.map(function (c, i) { return taskCardHtml(c, i); }).join('');
    $('#fixedChips').innerHTML = DATA.fixedCodes.map(chipHtml).join('');

    // 卡片點擊 → 詳情彈窗
    $$('.task-card').forEach(function (card) {
      card.addEventListener('click', function () { openTaskModal(card.getAttribute('data-code')); });
    });

    Dice.build($('#die'));
    Dice10.build($('#die10'));
    updateRollStatus('按下「擲骰子」開始抽取', false);
    setRollStatus10('準備中……');
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function taskCardHtml(code, i) {
    const t = DATA.tasks[code];
    const color = taskColor(code);
    return '<article class="task-card" data-code="' + code + '" style="--tc:' + color + ';animation-delay:' + (i * 0.06) + 's">' +
      '<div class="tc-badge hidden"></div>' +
      '<div class="tc-img"><img src="' + t.image + '" alt="' + escHtml(t.title) + '" loading="lazy"></div>' +
      '<div class="tc-body">' +
      '  <div class="tc-code-row"><span class="task-code">' + code + '</span><span class="task-tag">' + escHtml(t.tag) + '</span></div>' +
      '  <h3 class="tc-title">' + escHtml(t.title) + '</h3>' +
      '  <p class="tc-desc">' + escHtml(t.desc) + '</p>' +
      '  <span class="tc-more">🔍 點看任務細節</span>' +
      '</div></article>';
  }

  function chipHtml(code, lg) {
    const t = DATA.tasks[code];
    return '<span class="chip' + (lg ? ' lg' : '') + '" style="--tc:' + taskColor(code) + '">' +
      '<span class="chip-dot"></span>' + code + ' · ' + escHtml(t ? t.title : code) + '</span>';
  }

  // ---------------- 彈窗 ----------------
  function openTaskModal(code) {
    const t = DATA.tasks[code];
    if (!t) return;
    Sfx.click();
    $('#modalImg').src = t.image;
    $('#modalImg').alt = t.title;
    $('#modalCode').textContent = code;
    $('#modalCode').style.setProperty('--tc', taskColor(code));
    $('#modalCode').style.color = taskColor(code);
    $('#modalCode').style.borderColor = taskColor(code);
    $('#modalCode').style.background = 'transparent';
    $('#modalTag').textContent = t.tag;
    $('#modalTitle').textContent = t.title;
    $('#modalBody').innerHTML = MD.mdToHtml(t.body);
    $('#modal').classList.remove('hidden');
  }

  function closeModal() { $('#modal').classList.add('hidden'); }

  $('#modal').addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  // ---------------- 畫面切換 ----------------
  function showScreen(id) {
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    $('#screen-' + id).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------------- Phase 1：擲骰 ----------------
  let rollCount = 0;
  let rollingBusy = false;

  function updateRollStatus(msg, isDup) {
    const el = $('#rollStatus');
    el.textContent = msg;
    el.classList.toggle('dup', !!isDup);
  }

  function addLog(text, cls) {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = text;
    $('#rollLog').appendChild(li);
    li.scrollIntoView({ block: 'nearest' });
  }

  function diceWrap() { return $('#die').closest('.dice-wrap'); }

  async function throwOnce() {
    if (rollingBusy || rollCount >= DATA.cfg.rDraw) return;
    rollingBusy = true;
    $('#btnRoll').disabled = true;
    diceWrap().classList.add('rolling');

    const pool = DATA.randomCodes;
    const n = pool.length;
    addLog('第 ' + (rollCount + 1) + ' 擲中……');
    updateRollStatus('骰子滾動中……', false);
    Sfx.roll();

    let face = Dice.randInt(n);
    await Dice.rollTo(face);
    diceWrap().classList.remove('rolling');
    Sfx.land();

    while (state.drawnCodes.indexOf(pool[face - 1]) >= 0) {
      Sfx.dup();
      updateRollStatus('擲到重複（' + pool[face - 1] + '）→ 自動重擲！', true);
      addLog('點數 ' + face + ' → ' + pool[face - 1] + ' 已抽過，自動重擲', 'dup-line');
      await sleep(650);
      face = Dice.randInt(n);
      diceWrap().classList.add('rolling');
      Sfx.roll();
      await Dice.rollTo(face);
      diceWrap().classList.remove('rolling');
      Sfx.land();
    }

    const code = pool[face - 1];
    state.drawnCodes.push(code);
    rollCount++;

    // 標記卡片
    const card = $('#drawCards .task-card[data-code="' + code + '"]');
    if (card) {
      card.classList.add('drawn-task');
      const badge = card.querySelector('.tc-badge');
      badge.textContent = '抽中 #' + rollCount;
      badge.classList.remove('hidden');
    }
    $$('#drawCards .task-card').forEach(function (c) {
      if (!c.classList.contains('drawn-task')) c.classList.add('dim-out');
    });
    const t = DATA.tasks[code];
    addLog('第 ' + rollCount + ' 擲：點數 ' + face + ' → 抽中 ' + code + ' · ' + t.title + ' ✅', 'hit');
    updateRollStatus('抽中 ' + code + ' · ' + t.title + '！', false);
    Sfx.success();

    if (rollCount >= DATA.cfg.rDraw) {
      finishDraw();
    } else {
      $('#btnRoll').disabled = false;
      rollingBusy = false;
    }
  }

  function finishDraw() {
    rollingBusy = false;
    $('#btnRoll').disabled = true;
    updateRollStatus('🎉 全部抽完！', false);

    state.finalTasks = DATA.fixedCodes.concat(state.drawnCodes);
    $('#finalTaskChips').innerHTML = state.finalTasks.map(function (c) { return chipHtml(c, true); }).join('');
    $('#drawFooter').classList.remove('hidden');
    Sfx.fanfare();
    Confetti.burst(110);
  }

  // ---------------- Phase 2：十面骰配地點 ----------------
  function tcount() { return state.finalTasks.length; }

  function sortedPairs() {
    return state.pairs.slice().sort(function (a, b) {
      return a.loc.id.localeCompare(b.loc.id, 'en', { numeric: true });
    });
  }

  /** 配對列：locFirst=true → 「地點 → 任務」；false → 「#順位 任務 → 地點」 */
  function pairRowHtml(p, orderNum, locFirst) {
    const t = DATA.tasks[p.task];
    const taskPart = '<span class="pair-task">' + p.task + '</span>' +
      '<span class="pair-task-name">' + escHtml(t.title) + '</span>';
    const locPart = '<span class="pair-loc">📍 ' + p.loc.id + ' ' + escHtml(p.loc.name || '') + '</span>';
    return '<div class="pair-row" style="--tc:' + taskColor(p.task) + '">' +
      (orderNum ? '<span class="pair-order">' + orderNum + '</span>' : '') +
      (locFirst ? locPart + '<span class="pair-arrow">→</span>' + taskPart
                : taskPart + '<span class="pair-arrow">→</span>' + locPart) +
      '</div>';
  }

  function updateQueueStates() {
    $$('#taskQueue .q-chip').forEach(function (chip, k) {
      chip.classList.remove('pending', 'current', 'done');
      if (k < rollCursor) {
        chip.classList.add('done');
        const p = state.pairs[k];
        if (p && !chip.querySelector('.q-loc')) {
          const tag = document.createElement('span');
          tag.className = 'q-loc';
          tag.textContent = '📍' + p.loc.id;
          chip.appendChild(tag);
        }
      } else if (k === rollCursor && rollCursor < tcount()) {
        chip.classList.add('current');
      } else {
        chip.classList.add('pending');
      }
    });
  }

  function updatePairProgress() {
    $('#pairProgress').innerHTML = '已分配 <b>' + state.pairs.length + '</b> / ' + tcount() + ' 個地點';
  }

  function setRollStatus10(msg, isDup) {
    const el = $('#rollStatus10');
    el.textContent = msg;
    el.classList.toggle('dup', !!isDup);
  }

  function addLog10(text, cls) {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.textContent = text;
    $('#rollLog10').appendChild(li);
    li.scrollIntoView({ block: 'nearest' });
  }

  /** FLIP：動畫交換佇列中兩個 chip 的位置 */
  function swapChips() {
    return new Promise(function (resolve) {
      const chips = $$('#taskQueue .q-chip');
      if (chips.length < 2) return resolve();
      let i = Math.floor(Math.random() * chips.length);
      let j = Math.floor(Math.random() * chips.length);
      while (j === i) j = Math.floor(Math.random() * chips.length);
      const ea = chips[i], eb = chips[j];
      const ra = ea.getBoundingClientRect();
      const rb = eb.getBoundingClientRect();
      ea.classList.add('swapping');
      eb.classList.add('swapping');
      ea.style.transition = 'transform .26s cubic-bezier(.45,.1,.25,1)';
      eb.style.transition = 'transform .26s cubic-bezier(.45,.1,.25,1)';
      ea.style.transform = 'translate(' + (rb.left - ra.left) + 'px,' + (rb.top - ra.top) + 'px) scale(1.08)';
      eb.style.transform = 'translate(' + (ra.left - rb.left) + 'px,' + (ra.top - rb.top) + 'px) scale(1.08)';
      Sfx.click();
      setTimeout(function () {
        ea.style.transition = 'none';
        eb.style.transition = 'none';
        ea.style.transform = '';
        eb.style.transform = '';
        const marker = document.createElement('span');
        marker.style.display = 'none';
        ea.parentNode.insertBefore(marker, ea);
        ea.parentNode.insertBefore(ea, eb);
        ea.parentNode.insertBefore(eb, marker);
        marker.remove();
        ea.classList.remove('swapping');
        eb.classList.remove('swapping');
        setTimeout(resolve, 40);
      }, 280);
    });
  }

  function enterLocations() {
    showScreen('locations');
    state.pairs = [];
    rollCursor = 0;
    usedLocs.clear();
    taskOrder = [];
    $('#pairSummary').classList.add('hidden');
    $('#pairResults').innerHTML = '';
    $('#rollLog10').innerHTML = '';
    $('#btnRoll10').disabled = true;
    Dice10.build($('#die10'));
    updatePairProgress();

    // 依原順序排出任務 chips
    $('#taskQueue').innerHTML = state.finalTasks.map(function (code) {
      const t = DATA.tasks[code];
      return '<span class="q-chip" data-code="' + code + '" style="--tc:' + taskColor(code) + '">' +
        code + ' · ' + escHtml(t.title) + '</span>';
    }).join('');

    setRollStatus10('準備中……');
    $('#queueStatus').textContent = '🌀 程式正在隨機打亂任務順序……';

    // 動畫打亂，打亂後的畫面順序即為擲骰順序
    let chain = sleep(600);
    for (let s = 0; s < 9; s++) {
      chain = chain.then(function () { return swapChips(); });
    }
    chain.then(function () {
      taskOrder = $$('#taskQueue .q-chip').map(function (c) { return c.getAttribute('data-code'); });
      $('#queueStatus').textContent = '✅ 任務順序已打亂，將依畫面順序由左至右逐一擲骰';
      updateQueueStates();
      const first = DATA.tasks[taskOrder[0]];
      setRollStatus10('按下「擲骰子」，為 ' + taskOrder[0] + ' · ' + first.title + ' 抽地點');
      $('#btnRoll10').disabled = false;
    });
  }

  async function rollOnce10() {
    if (rollingBusy || rollCursor >= tcount()) return;
    rollingBusy = true;
    $('#btnRoll10').disabled = true;

    const code = taskOrder[rollCursor];
    const t = DATA.tasks[code];
    updateQueueStates();
    setRollStatus10('為 ' + code + ' · ' + t.title + ' 擲骰中……');
    addLog10('第 ' + (rollCursor + 1) + ' 順位 ' + code + '：擲骰中……');
    Sfx.click();

    let face = 0;
    while (true) {
      face = Dice.randInt(10);
      await Dice10.rollTo(face);
      const loc = DATA.locations[face - 1];
      if (!usedLocs.has(loc.id)) break;
      // 重複地點 → 自動重擲（確保不重複）
      Sfx.dup();
      setRollStatus10('地點 ' + loc.id + ' 已被占用 → 自動重擲！', true);
      addLog10('點數 ' + face + ' → 地點 ' + loc.id + ' 已占用，自動重擲', 'dup-line');
      await sleep(650);
    }

    const loc = DATA.locations[face - 1];
    usedLocs.add(loc.id);
    state.pairs.push({ task: code, loc: loc });
    rollCursor++;

    addLog10('第 ' + rollCursor + ' 擲：點數 ' + face + ' → ' + code + ' · ' + t.title + ' 落地 📍 ' + loc.id + ' ' + (loc.name || ''), 'hit');
    setRollStatus10(code + ' · ' + t.title + ' → 地點 ' + loc.id + ' ✅');
    $('#pairResults').insertAdjacentHTML('beforeend', pairRowHtml({ task: code, loc: loc }, rollCursor, false));
    updateQueueStates();
    updatePairProgress();
    Sfx.success();

    if (rollCursor >= tcount()) {
      finishPairing();
    } else {
      const nextCode = taskOrder[rollCursor];
      setRollStatus10('下一個：' + nextCode + ' · ' + DATA.tasks[nextCode].title);
      $('#btnRoll10').disabled = false;
      rollingBusy = false;
    }
  }

  function finishPairing() {
    rollingBusy = false;
    $('#btnRoll10').disabled = true;
    setRollStatus10('🎉 全部任務都已分配地點！');
    $('#queueStatus').textContent = '🏁 配對完成！';
    showPairSummary();
  }

  function showPairSummary() {
    $('#pairList').innerHTML = sortedPairs().map(function (p) { return pairRowHtml(p, 0, true); }).join('');
    $('#pairSummary').classList.remove('hidden');
    $('#pairSummary').scrollIntoView({ behavior: 'smooth', block: 'center' });
    Sfx.fanfare();
    Confetti.burst(130);
  }

  function renderTimerPairs() {
    $('#timerPairs').innerHTML = sortedPairs().map(function (p) { return pairRowHtml(p, 0, true); }).join('');
  }

  // ---------------- Phase 3：倒計時 ----------------
  function enterTimer() {
    showScreen('timer');
    renderTimerPairs();
    state.timerStarted = false;

    const seconds = DATA.cfg.minutes * 60;
    Timer.init(seconds, {
      onTick: onTimerTick,
      onFinish: onTimerFinish
    });

    const disp = $('#timerDisplay');
    disp.className = 'timer-display';
    const totalSec = DATA.cfg.minutes * 60;
    disp.textContent = pad2(Math.floor(totalSec / 3600)) + ':' + pad2(Math.floor(totalSec % 3600 / 60)) + ':' + pad2(totalSec % 60);
    $('#timerFill').style.width = '100%';
    $('#timerFill').className = 'timer-fill';
    $('#roundBadge').textContent = '· 第 ' + state.round + ' 輪';
    $('#timerLabel').textContent = '第 ' + state.round + ' 輪 · 準備開始 · 全長 ' + DATA.cfg.minutes + ' 分鐘';
    $('#timerHint').textContent = '開始後會自動存入「上次結果」。「🔒 長按重置」需按住 1.2 秒才會重置（防誤觸）；「🖥 大屏模式」適合投影，按 Esc 或右上角 ✕ 退出。';
    $('#btnTimerStart').classList.remove('hidden');
    $('#btnTimerStart').disabled = false;
    $('#btnTimerStart').textContent = '▶ 開始比賽';
    $('#btnTimerPause').classList.add('hidden');
    $('#timeUp').classList.add('hidden');
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function onTimerTick(d) {
    const disp = $('#timerDisplay');
    disp.textContent = d.text;
    const fill = $('#timerFill');
    fill.style.width = (d.fraction * 100).toFixed(2) + '%';

    if (d.secondsLeft <= 60) {
      disp.className = 'timer-display danger';
      fill.className = 'timer-fill danger';
      $('#timerLabel').textContent = '第 ' + state.round + ' 輪 · ⏰ 最後 1 分鐘！';
    } else if (d.secondsLeft <= 600) {
      disp.className = 'timer-display warn';
      fill.className = 'timer-fill warn';
      $('#timerLabel').textContent = '第 ' + state.round + ' 輪 · ⚠ 剩餘 ' + Math.ceil(d.secondsLeft / 60) + ' 分鐘';
    } else {
      disp.className = 'timer-display';
      fill.className = 'timer-fill';
      $('#timerLabel').textContent = '第 ' + state.round + ' 輪 · 比賽進行中';
    }
    if (d.secondsLeft <= 10 && d.secondsLeft > 0) Sfx.tick();
  }

  function onTimerFinish() {
    $('#timerDisplay').textContent = '00:00:00';
    $('#timerFill').style.width = '0%';
    $('#timerLabel').textContent = '比賽結束';
    $('#btnTimerStart').classList.add('hidden');
    $('#btnTimerPause').classList.add('hidden');
    $('#timerHint').textContent = '比賽時間到，請各隊停止操作機器人。';
    $('#btnNextRound').textContent = '🔁 開始第 ' + (state.round + 1) + ' 輪（重新分配地點）';
    $('#timeUp').classList.remove('hidden');
    Sfx.alarm();
    Confetti.burst(160);
  }

  function saveHistory() {
    try {
      const list = JSON.parse(localStorage.getItem('rcg_history') || '[]');
      list.unshift({
        ts: Date.now(),
        minutes: DATA.cfg.minutes,
        round: state.round,
        pairs: sortedPairs().map(function (p) { return { loc: p.loc.id + ' ' + (p.loc.name || ''), task: p.task, title: DATA.tasks[p.task].title }; })
      });
      localStorage.setItem('rcg_history', JSON.stringify(list.slice(0, 5)));
    } catch (e) { /* 私密模式等情況忽略 */ }
  }

  function renderHistory() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('rcg_history') || '[]'); } catch (e) { /* ignore */ }
    const panel = $('#historyPanel');
    if (!list.length) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    $('#historyList').innerHTML = list.map(function (h) {
      const d = new Date(h.ts);
      const dateStr = d.getFullYear() + '/' + pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      const chips = h.pairs.map(function (p) {
        return '<span class="chip" style="--tc:' + taskColor(p.task) + '">' + escHtml(p.loc) + ' → ' + p.task + '</span>';
      }).join('');
      return '<div class="history-item"><span class="h-time">🕘 ' + dateStr + (h.round && h.round > 1 ? ' · 第 ' + h.round + ' 輪' : '') + '</span><span class="h-pairs">' + chips + '</span></div>';
    }).join('');
  }

  // ---------------- 重置 ----------------
  function resetAll() {
    if (Timer.isRunning() && !window.confirm('比賽計時中，確定要放棄本次抽籤並重新開始？')) return;
    Timer.pause();

    state.drawnCodes = [];
    state.finalTasks = [];
    state.pairs = [];
    state.timerStarted = false;
    state.round = 1;
    rollCount = 0;
    rollingBusy = false;
    rollCursor = 0;
    usedLocs.clear();
    taskOrder = [];

    // 還原抽卡畫面
    $$('#drawCards .task-card').forEach(function (c) {
      c.classList.remove('drawn-task', 'dim-out');
      const badge = c.querySelector('.tc-badge');
      badge.classList.add('hidden');
    });
    $('#rollLog').innerHTML = '';
    updateRollStatus('按下「擲骰子」開始抽取', false);
    $('#btnRoll').disabled = false;
    $('#drawFooter').classList.add('hidden');

    // 還原配對畫面
    $('#pairSummary').classList.add('hidden');
    $('#timeUp').classList.add('hidden');
    $('#pairResults').innerHTML = '';
    $('#rollLog10').innerHTML = '';
    $('#taskQueue').innerHTML = '';
    $('#queueStatus').textContent = '任務順序打亂中……';
    setRollStatus10('準備中……');
    $('#btnRoll10').disabled = true;
    Dice10.build($('#die10'));
    if (DATA) updatePairProgress();

    renderHistory();
    showScreen('welcome');
  }

  // ---------------- 大屏模式 ----------------
  let idleTimer = null;

  function pokeIdle() {
    document.body.classList.remove('mouse-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (document.body.classList.contains('big-mode')) {
        document.body.classList.add('mouse-idle');
      }
    }, 3000);
  }

  function enterBigMode() {
    document.body.classList.add('big-mode');
    $('#btnExitBig').classList.remove('hidden');
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    try { if (req) req.call(el); } catch (e) { /* 全螢幕不可用時仍套用大屏樣式 */ }
    pokeIdle();
  }

  function exitBigMode() {
    document.body.classList.remove('big-mode', 'mouse-idle');
    $('#btnExitBig').classList.add('hidden');
    clearTimeout(idleTimer);
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    try { if (ex && (document.fullscreenElement || document.webkitFullscreenElement)) ex.call(document); } catch (e) { /* ignore */ }
  }

  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (document.body.classList.contains('big-mode')) exitBigMode();
    }
  });
  document.addEventListener('webkitfullscreenchange', function () {
    if (!document.webkitFullscreenElement && document.body.classList.contains('big-mode')) exitBigMode();
  });
  document.addEventListener('mousemove', function () {
    if (document.body.classList.contains('big-mode')) pokeIdle();
  });

  /** 長按確認：按住 ms 毫秒才觸發，快速點擊只會震動提示（防誤觸）
   *  用 setInterval 而非 rAF：背景分頁 / 縮略視窗時 rAF 會停擺，導致長按永遠無法完成 */
  function makeHold(btn, ms, onConfirm) {
    if (!btn) return;
    btn.classList.add('hold-btn');
    const fill = document.createElement('span');
    fill.className = 'hold-fill';
    btn.appendChild(fill);
    let t0 = null, iv = null, finished = false;

    function stopFill() {
      if (iv) clearInterval(iv);
      iv = null;
      setTimeout(function () { fill.style.width = '0%'; }, 120);
    }
    function start() {
      if (btn.disabled || t0) return;
      finished = false;
      t0 = Date.now();
      iv = setInterval(function () {
        if (t0 === null) return;
        const p = Math.min(1, (Date.now() - t0) / ms);
        fill.style.width = (p * 100) + '%';
        if (p >= 1) {
          finished = true;
          t0 = null;
          stopFill();
          onConfirm();
        }
      }, 40);
    }
    function cancel() {
      if (t0 === null || finished) return;
      t0 = null;
      stopFill();
      btn.classList.add('nudge');
      setTimeout(function () { btn.classList.remove('nudge'); }, 500);
    }
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', function () { start(); }, { passive: true });
    btn.addEventListener('mouseup', cancel);
    btn.addEventListener('mouseleave', cancel);
    btn.addEventListener('touchend', cancel);
    btn.addEventListener('touchcancel', cancel);
  }

  // ---------------- 事件綁定 ----------------
  /** 綁定按鈕事件；元素不存在時略過（避免瀏覽器快取新舊版本混搭時整頁靜默失效） */
  function onBtn(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
    else console.warn('[app] 找不到元素 #' + id + '，略過綁定（可能是快取了舊版頁面，請強制重新整理）');
  }

  function bindEvents() {
    onBtn('btnStart', function () {
      Sfx.click();
      showScreen('draw');
    });

    onBtn('btnRoll', throwOnce);

    onBtn('btnToLocations', function () {
      Sfx.click();
      enterLocations();
    });

    onBtn('btnRoll10', rollOnce10);

    onBtn('btnToTimer', function () {
      Sfx.click();
      enterTimer();
    });

    onBtn('btnTimerStart', function () {
      if (!state.timerStarted) {
        state.timerStarted = true;
        saveHistory();
        Sfx.fanfare();
        Confetti.burst(120);
        $('#timerHint').textContent = '計時中！結束前 10 分鐘會轉黃、最後 10 秒有提示音。';
      } else {
        Sfx.click();
        $('#timerLabel').textContent = '比賽進行中';
      }
      Timer.start();
      this.classList.add('hidden');
      $('#btnTimerPause').classList.remove('hidden');
    });

    onBtn('btnTimerPause', function () {
      Timer.pause();
      Sfx.click();
      $('#timerLabel').textContent = '⏸ 已暫停';
      this.classList.add('hidden');
      const startBtn = $('#btnTimerStart');
      startBtn.textContent = '▶ 繼續比賽';
      startBtn.classList.remove('hidden');
    });

    onBtn('btnBigScreen', function () {
      Sfx.click();
      enterBigMode();
    });

    onBtn('btnExitBig', function () {
      Sfx.click();
      exitBigMode();
    });

    onBtn('btnNextRound', function () {
      Sfx.click();
      $('#timeUp').classList.add('hidden');
      state.round++;
      enterLocations();
    });

    // 重置需長按確認，防止比賽中被誤觸
    makeHold($('#btnTimerReset'), 1200, function () {
      Timer.pause();
      Timer.reset();
      Sfx.click();
      enterTimer();
    });

    onBtn('btnTimeUpClose', function () {
      $('#timeUp').classList.add('hidden');
    });

    onBtn('btnTimeUpHome', function () {
      $('#timeUp').classList.add('hidden');
      resetAll();
    });

    onBtn('btnHome', resetAll);

    onBtn('btnClearHistory', function () {
      localStorage.removeItem('rcg_history');
      renderHistory();
      Sfx.click();
    });

    onBtn('btnSound', function () {
      const muted = !Sfx.isMuted();
      Sfx.setMuted(muted);
      this.textContent = muted ? '🔇' : '🔊';
      if (!muted) Sfx.click();
    });

    onBtn('btnFatalRetry', function () {
      location.reload();
    });
  }

  // ---------------- 啟動 ----------------
  bindEvents();
  boot();
})();
