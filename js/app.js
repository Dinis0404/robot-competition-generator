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
    pairs: [],        // [{loc:{id,name}, task}] 依地點編號排序
    timerStarted: false
  };

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
          locDraw: intOr(cfg.locations_draw, 7),
          minutes: intOr(cfg.timer_minutes, 90)
        },
        fixedCodes: fixedCodes,
        randomCodes: randomCodes,
        tasks: tasks,
        locations: locations
      };

      if (DATA.locDraw > DATA.locations.length) throw new Error('config：locations_draw（' + DATA.locDraw + '）不可大於地點數量（' + DATA.locations.length + '）');

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
    $$('.js-ldraw').forEach(function (el) { el.textContent = DATA.cfg.locDraw; });
    $$('.js-minutes').forEach(function (el) { el.textContent = DATA.cfg.minutes; });

    $('#randomPreview').innerHTML = DATA.randomCodes.map(function (c, i) { return taskCardHtml(c, i); }).join('');
    $('#fixedCards').innerHTML = DATA.fixedCodes.map(function (c, i) { return taskCardHtml(c, i); }).join('');
    $('#drawCards').innerHTML = DATA.randomCodes.map(function (c, i) { return taskCardHtml(c, i); }).join('');
    $('#fixedChips').innerHTML = DATA.fixedCodes.map(chipHtml).join('');

    // 卡片點擊 → 詳情彈窗
    $$('.task-card').forEach(function (card) {
      card.addEventListener('click', function () { openTaskModal(card.getAttribute('data-code')); });
    });

    Dice.build($('#die'));
    updateRollStatus('按下「擲骰子」開始抽取', false);
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

  // ---------------- Phase 2：地點 ----------------
  function enterLocations() {
    showScreen('locations');

    // 1) 決定哪些地點被抽中
    const n = DATA.locations.length;
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    const idx = DATA.locations.map(function (_, i) { return i; });
    // Fisher-Yates 洗地點索引，取前 locDraw 個
    for (let i = n - 1; i > 0; i--) {
      const j = buf[i] % (i + 1);
      const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    const drawnIdx = idx.slice(0, DATA.cfg.locDraw);
    const drawnSet = new Set(drawnIdx);

    // 2) 隨機配對：洗任務順序，依地點編號排序後依序配
    const tasksShuffled = state.finalTasks.slice();
    const tb = new Uint32Array(tasksShuffled.length);
    crypto.getRandomValues(tb);
    for (let i = tasksShuffled.length - 1; i > 0; i--) {
      const j = tb[i] % (i + 1);
      const t = tasksShuffled[i]; tasksShuffled[i] = tasksShuffled[j]; tasksShuffled[j] = t;
    }
    const drawnLocs = drawnIdx.map(function (i) { return DATA.locations[i]; })
      .sort(function (a, b) { return a.id.localeCompare(b.id, 'en', { numeric: true }); });
    state.pairs = drawnLocs.map(function (loc, i) {
      return { loc: loc, task: tasksShuffled[i] };
    });
    const taskByLoc = {};
    state.pairs.forEach(function (p) { taskByLoc[p.loc.id] = p.task; });

    // 3) 10 張卡面朝下，地點隨機分布
    const arrangement = DATA.locations.map(function (loc) {
      return { loc: loc, task: drawnSet.has(DATA.locations.indexOf(loc)) ? taskByLoc[loc.id] : null };
    });
    const ab = new Uint32Array(arrangement.length);
    crypto.getRandomValues(ab);
    for (let i = arrangement.length - 1; i > 0; i--) {
      const j = ab[i] % (i + 1);
      const t = arrangement[i]; arrangement[i] = arrangement[j]; arrangement[j] = t;
    }
    LocBoard.build($('#locGrid'), arrangement, { onFlip: onLocFlip });
    updateLocProgress();
    $('#pairSummary').classList.add('hidden');
    $('#btnShuffle').disabled = false;
    $('#btnAutoReveal').disabled = false;
    $('#btnRevealRest').classList.add('hidden');
  }

  function onLocFlip() {
    const s = LocBoard.stats();
    updateLocProgress();
    if (s.hits >= DATA.cfg.locDraw && s.revealed < s.total) {
      $('#btnRevealRest').classList.remove('hidden');
    }
    if (s.revealed >= s.total) {
      showPairSummary();
    }
  }

  function updateLocProgress() {
    const s = LocBoard.stats();
    $('#locProgress').innerHTML = '已翻出 <b>' + s.hits + '</b> / ' + DATA.cfg.locDraw + ' 個地點' + (s.revealed < s.total ? '' : ' · 全部揭曉！');
  }

  function showPairSummary() {
    $('#pairList').innerHTML = state.pairs.map(function (p) {
      const t = DATA.tasks[p.task];
      return '<div class="pair-row" style="--tc:' + taskColor(p.task) + '">' +
        '<span class="pair-loc">📍 ' + p.loc.id + ' ' + escHtml(p.loc.name || '') + '</span>' +
        '<span class="pair-arrow">→</span>' +
        '<span class="pair-task">' + p.task + '</span>' +
        '<span class="pair-task-name">' + escHtml(t.title) + '</span>' +
        '</div>';
    }).join('');
    $('#pairSummary').classList.remove('hidden');
    $('#pairSummary').scrollIntoView({ behavior: 'smooth', block: 'center' });
    Sfx.fanfare();
    Confetti.burst(130);
  }

  function renderTimerPairs() {
    $('#timerPairs').innerHTML = state.pairs.map(function (p) {
      const t = DATA.tasks[p.task];
      return '<div class="pair-row" style="--tc:' + taskColor(p.task) + '">' +
        '<span class="pair-loc">📍 ' + p.loc.id + '</span>' +
        '<span class="pair-arrow">→</span>' +
        '<span class="pair-task">' + p.task + '</span>' +
        '<span class="pair-task-name">' + escHtml(t.title) + '</span>' +
        '</div>';
    }).join('');
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
    $('#timerLabel').textContent = '準備開始 · 全長 ' + DATA.cfg.minutes + ' 分鐘';
    $('#timerHint').textContent = '開始後會自動存入「上次結果」，結束前 10 分鐘轉黃、10 秒逐秒提示音。';
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
      $('#timerLabel').textContent = '⏰ 最後 1 分鐘！';
    } else if (d.secondsLeft <= 600) {
      disp.className = 'timer-display warn';
      fill.className = 'timer-fill warn';
      $('#timerLabel').textContent = '⚠ 剩餘 ' + Math.ceil(d.secondsLeft / 60) + ' 分鐘';
    } else {
      disp.className = 'timer-display';
      fill.className = 'timer-fill';
      $('#timerLabel').textContent = '比賽進行中';
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
        pairs: state.pairs.map(function (p) { return { loc: p.loc.id + ' ' + (p.loc.name || ''), task: p.task, title: DATA.tasks[p.task].title }; })
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
      return '<div class="history-item"><span class="h-time">🕘 ' + dateStr + '</span><span class="h-pairs">' + chips + '</span></div>';
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
    rollCount = 0;
    rollingBusy = false;

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
    $('#pairSummary').classList.add('hidden');
    $('#timeUp').classList.add('hidden');
    $('#btnRevealRest').classList.add('hidden');
    $('#locGrid').innerHTML = '';
    $('#locProgress').innerHTML = '已翻出 0 / ' + DATA.cfg.locDraw + ' 個地點';

    renderHistory();
    showScreen('welcome');
  }

  // ---------------- 事件綁定 ----------------
  function bindEvents() {
    $('#btnStart').addEventListener('click', function () {
      Sfx.click();
      showScreen('draw');
    });

    $('#btnRoll').addEventListener('click', throwOnce);

    $('#btnToLocations').addEventListener('click', function () {
      Sfx.click();
      enterLocations();
    });

    $('#btnShuffle').addEventListener('click', function () {
      if (LocBoard.stats().revealed > 0) return;
      this.disabled = true;
      const self = this;
      LocBoard.shuffle(11).then(function () { self.disabled = false; });
    });

    $('#btnAutoReveal').addEventListener('click', function () {
      this.disabled = true;
      $('#btnShuffle').disabled = true;
      $('#btnRevealRest').classList.add('hidden');
      LocBoard.autoReveal(function () {
        $('#btnRevealRest').classList.add('hidden');
        showPairSummary();
      });
    });

    $('#btnRevealRest').addEventListener('click', function () {
      this.disabled = true;
      LocBoard.revealRest().then(function () {
        $('#btnRevealRest').classList.add('hidden');
        showPairSummary();
      });
    });

    $('#btnToTimer').addEventListener('click', function () {
      Sfx.click();
      enterTimer();
    });

    $('#btnTimerStart').addEventListener('click', function () {
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

    $('#btnTimerPause').addEventListener('click', function () {
      Timer.pause();
      Sfx.click();
      $('#timerLabel').textContent = '⏸ 已暫停';
      this.classList.add('hidden');
      const startBtn = $('#btnTimerStart');
      startBtn.textContent = '▶ 繼續比賽';
      startBtn.classList.remove('hidden');
    });

    $('#btnTimerReset').addEventListener('click', function () {
      Timer.pause();
      Timer.reset();
      Sfx.click();
      enterTimer();
    });

    $('#btnTimeUpClose').addEventListener('click', function () {
      $('#timeUp').classList.add('hidden');
    });

    $('#btnTimeUpHome').addEventListener('click', function () {
      $('#timeUp').classList.add('hidden');
      resetAll();
    });

    $('#btnHome').addEventListener('click', resetAll);

    $('#btnClearHistory').addEventListener('click', function () {
      localStorage.removeItem('rcg_history');
      renderHistory();
      Sfx.click();
    });

    $('#btnSound').addEventListener('click', function () {
      const muted = !Sfx.isMuted();
      Sfx.setMuted(muted);
      this.textContent = muted ? '🔇' : '🔊';
      if (!muted) Sfx.click();
    });

    $('#btnFatalRetry').addEventListener('click', function () {
      location.reload();
    });
  }

  // ---------------- 啟動 ----------------
  bindEvents();
  boot();
})();
