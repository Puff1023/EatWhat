/* ===========================================================
 *  今天吃什麼 — 食物選擇輪盤
 * =========================================================== */
(function () {
  'use strict';

  const STORE_KEY = 'eatwhat.store.v1';
  const CUR_KEY = 'eatwhat.current.v1';
  const TAU = Math.PI * 2;

  // 輪盤配色:同一個暖色調的深淺兩階,交錯排列(乾淨、不雜亂)
  const PALETTE = [
    '#DB8B52', // 陶土(深)
    '#F3DAB2', // 奶茶(淺)
  ];

  // 綜合輪盤:每個主題最多取幾樣(避免格子太多太密)。想更多/更少就改這個數字。
  const MIX_PER_THEME = 4;

  /* ---------- 資料層 ---------- */
  // localStorage 存的覆寫資料:
  //   { overrides:{id:{name,emoji,items}}, deleted:[id], custom:[theme], order:[id] }
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const s = raw ? JSON.parse(raw) : {};
      return {
        overrides: s.overrides || {},
        deleted: s.deleted || [],
        custom: s.custom || [],
        order: s.order || null,
      };
    } catch (e) {
      return { overrides: {}, deleted: [], custom: [], order: null };
    }
  }
  function saveStore(s) {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  }

  // 由「預設 + 覆寫」組出目前所有主題(不含綜合)
  function buildThemes() {
    const s = loadStore();
    let list = [];
    (window.DEFAULT_THEMES || []).forEach((def) => {
      if (s.deleted.includes(def.id)) return;
      const ov = s.overrides[def.id];
      list.push(ov ? { id: def.id, name: ov.name, emoji: ov.emoji, items: ov.items.slice(), _def: true }
                   : { ...def, items: def.items.slice(), _def: true });
    });
    s.custom.forEach((c) => {
      if (s.deleted.includes(c.id)) return;
      list.push({ ...c, items: c.items.slice(), _def: false });
    });
    if (s.order) {
      list.sort((a, b) => {
        const ia = s.order.indexOf(a.id), ib = s.order.indexOf(b.id);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });
    }
    return list;
  }

  // 綜合主題 = 各主題各取前幾樣,混合去重(格數不會太多)
  function buildMix(themes) {
    const seen = new Set();
    const items = [];
    themes.forEach((t) => t.items.slice(0, MIX_PER_THEME).forEach((it) => {
      const k = it.trim();
      if (k && !seen.has(k)) { seen.add(k); items.push(k); }
    }));
    return { id: 'mix', name: '綜合', emoji: '🍽️', items, _mix: true };
  }

  function getAllTabs() {
    const themes = buildThemes();
    return [buildMix(themes), ...themes];
  }

  /* ---------- 狀態 ---------- */
  let tabs = getAllTabs();
  let currentId = localStorage.getItem(CUR_KEY) || 'mix';
  if (!tabs.some((t) => t.id === currentId)) currentId = tabs[0].id;
  let spinning = false;
  let rotation = 0;

  const current = () => tabs.find((t) => t.id === currentId) || tabs[0];

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const canvas = $('wheel');
  const ctx = canvas.getContext('2d');
  const themeTabs = $('themeTabs');
  const resultEl = $('result');
  const spinCenter = $('spinBtn');
  const spinBig = $('spinBtnBig');
  const itemCount = $('itemCount');

  /* ---------- 分頁 ---------- */
  function renderTabs() {
    themeTabs.innerHTML = '';
    tabs.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'tab' + (t.id === currentId ? ' active' : '');
      b.innerHTML = `<span class="em">${t.emoji || '🍴'}</span>${escapeHtml(t.name)}`;
      b.onclick = () => selectTab(t.id);
      themeTabs.appendChild(b);
    });
    const add = document.createElement('button');
    add.className = 'tab add-tab';
    add.textContent = '＋ 主題';
    add.onclick = openNewTheme;
    themeTabs.appendChild(add);
  }

  function selectTab(id) {
    if (spinning) return;
    currentId = id;
    localStorage.setItem(CUR_KEY, id);
    renderTabs();
    resetResult();
    drawWheel();
    // 讓選中的分頁滑進視野
    const active = themeTabs.querySelector('.tab.active');
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  /* ---------- 輪盤繪製 ---------- */
  function drawWheel() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = canvas.clientWidth || 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2, cy = size / 2, r = size / 2 - 4;
    ctx.clearRect(0, 0, size, size);

    const items = current().items;
    const n = items.length;

    if (n === 0) {
      ctx.fillStyle = '#ECE3D1';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#928979';
      ctx.font = `600 ${Math.max(14, size * 0.05)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('這裡還沒有食物', cx, cy - 12);
      ctx.fillText('按右上角 ✏️ 新增', cx, cy + 16);
      return;
    }

    const seg = TAU / n;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * seg;
      const a1 = a0 + seg;
      // 扇形
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = pickColor(i, n);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.28)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 文字
      ctx.save();
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#413A31';
      const fs = fontSizeFor(items[i], n, size);
      ctx.font = `700 ${fs}px sans-serif`;
      const label = fitText(items[i], n);
      ctx.fillText(label, r - 14, 0);
      ctx.restore();
    }
    ctx.restore();

    // 中心圓底
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.16, 0, TAU);
    ctx.fillStyle = '#4A433A';
    ctx.fill();
  }

  function pickColor(i, n) {
    let c = PALETTE[i % PALETTE.length];
    // 避免頭尾同色
    if (i === n - 1 && c === PALETTE[0] && n > 1) c = PALETTE[1 % PALETTE.length];
    return c;
  }
  function fontSizeFor(text, n, size) {
    let base = size * 0.052;
    if (n > 10) base = size * 0.044;
    if (n > 16) base = size * 0.036;
    if (text.length > 5) base *= 0.9;
    return Math.max(11, base);
  }
  function fitText(text, n) {
    const max = n > 14 ? 6 : 8;
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  /* ---------- 轉動 ---------- */
  function normalize(a) { return ((a % TAU) + TAU) % TAU; }

  // 由最終角度反推指針指到哪一格
  function winnerIndex(rot, n) {
    const seg = TAU / n;
    const local = normalize(-Math.PI / 2 - rot); // 指針(正上方)對到輪盤的本地角度
    return Math.floor(normalize(local + Math.PI / 2) / seg) % n;
  }

  function spin() {
    if (spinning) return;
    const items = current().items;
    const n = items.length;
    if (n === 0) { openEdit(); return; }
    if (n === 1) { showResult(items[0]); return; }

    spinning = true;
    setSpinDisabled(true);
    resultEl.innerHTML = '<span class="result-hint">命運轉動中… 🎰</span>';

    const seg = TAU / n;
    const winner = Math.floor(Math.random() * n);
    // 讓 winner 的中心轉到正上方指針處
    const targetMod = normalize(-(winner * seg + seg / 2));
    const jitter = (Math.random() - 0.5) * seg * 0.5; // 小抖動,看起來自然
    const turns = 5 + Math.floor(Math.random() * 3);
    const delta = normalize(targetMod - rotation) + turns * TAU + jitter;
    const start = rotation;
    const end = rotation + delta;
    const dur = 4200 + Math.random() * 800;
    const t0 = performance.now();

    function frame(now) {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      rotation = start + (end - start) * eased;
      drawWheel();
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        rotation = normalize(end);
        drawWheel();
        spinning = false;
        setSpinDisabled(false);
        const idx = winnerIndex(rotation, n);
        showResult(items[idx]);
      }
    }
    requestAnimationFrame(frame);
  }

  function showResult(text) {
    resultEl.innerHTML = `<span class="result-win">${escapeHtml(text)}</span>`;
    buzz();
  }
  function resetResult() {
    resultEl.innerHTML = '<span class="result-hint">點下方按鈕,決定你的一餐 👇</span>';
    updateCount();
  }
  function setSpinDisabled(v) { spinCenter.disabled = v; spinBig.disabled = v; }
  function updateCount() {
    itemCount.textContent = `${current().name} · ${current().items.length} 種選擇`;
  }
  function buzz() { if (navigator.vibrate) try { navigator.vibrate(40); } catch (e) {} }

  /* ---------- 編輯面板 ---------- */
  const editSheet = $('editSheet');
  const itemList = $('itemList');
  const themeNameInput = $('themeNameInput');
  const themeEmojiInput = $('themeEmojiInput');
  const addItemInput = $('addItemInput');

  function openEdit() {
    const t = current();
    if (t._mix) {
      alert('「綜合」會自動集合其他主題的所有食物,請到各主題裡編輯 🙂');
      return;
    }
    themeNameInput.value = t.name;
    themeEmojiInput.value = t.emoji || '';
    renderItemList(t.items);
    $('editTitle').textContent = `編輯「${t.name}」`;
    $('resetThemeBtn').style.display = t._def ? '' : 'none';
    $('deleteThemeBtn').style.display = t._def ? 'none' : '';
    showSheet(editSheet);
  }

  function renderItemList(items) {
    itemList.innerHTML = '';
    if (!items.length) {
      itemList.innerHTML = '<li class="empty-hint" style="border:none;background:none;justify-content:center">還沒有食物,在上面新增一個吧</li>';
      return;
    }
    items.forEach((it, i) => {
      const li = document.createElement('li');
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = it; inp.maxLength = 20;
      inp.dataset.idx = i;
      const del = document.createElement('button');
      del.className = 'item-del'; del.textContent = '🗑'; del.title = '刪除';
      del.onclick = () => { li.remove(); };
      li.appendChild(inp); li.appendChild(del);
      itemList.appendChild(li);
    });
  }

  function collectItems() {
    return [...itemList.querySelectorAll('input')]
      .map((i) => i.value.trim())
      .filter((v) => v.length);
  }

  function addItemFromInput() {
    const v = addItemInput.value.trim();
    if (!v) return;
    // 若目前是空清單提示,先清掉
    const hint = itemList.querySelector('.empty-hint');
    if (hint) itemList.innerHTML = '';
    const li = document.createElement('li');
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = v; inp.maxLength = 20;
    const del = document.createElement('button');
    del.className = 'item-del'; del.textContent = '🗑';
    del.onclick = () => li.remove();
    li.appendChild(inp); li.appendChild(del);
    itemList.appendChild(li);
    addItemInput.value = '';
    addItemInput.focus();
    li.scrollIntoView({ block: 'nearest' });
  }

  function saveEdit() {
    const t = current();
    const name = themeNameInput.value.trim() || t.name;
    const emoji = themeEmojiInput.value.trim() || '🍴';
    const items = collectItems();
    const s = loadStore();
    if (t._def) {
      s.overrides[t.id] = { name, emoji, items };
    } else {
      const c = s.custom.find((x) => x.id === t.id);
      if (c) { c.name = name; c.emoji = emoji; c.items = items; }
    }
    saveStore(s);
    refresh();
    hideSheet(editSheet);
  }

  function resetTheme() {
    const t = current();
    if (!t._def) return;
    if (!confirm(`「${t.name}」要還原成預設食物嗎?你自己的修改會被清除。`)) return;
    const s = loadStore();
    delete s.overrides[t.id];
    // 若曾被刪除也一併恢復
    s.deleted = s.deleted.filter((id) => id !== t.id);
    saveStore(s);
    refresh();
    hideSheet(editSheet);
  }

  function deleteTheme() {
    const t = current();
    if (t._def || t._mix) return;
    if (!confirm(`確定刪除主題「${t.name}」?`)) return;
    const s = loadStore();
    s.custom = s.custom.filter((x) => x.id !== t.id);
    saveStore(s);
    currentId = 'mix';
    refresh();
    hideSheet(editSheet);
  }

  /* ---------- 新增主題 ---------- */
  const newSheet = $('newThemeSheet');
  function openNewTheme() {
    $('newThemeName').value = '';
    $('newThemeEmoji').value = '';
    showSheet(newSheet);
  }
  function createTheme() {
    const name = $('newThemeName').value.trim();
    const emoji = $('newThemeEmoji').value.trim() || '🍴';
    if (!name) { alert('請輸入主題名稱'); return; }
    const s = loadStore();
    const id = 'c_' + Math.abs(hashStr(name + '_' + (s.custom.length))) .toString(36);
    s.custom.push({ id, name, emoji, items: [] });
    saveStore(s);
    refresh();
    currentId = id;
    localStorage.setItem(CUR_KEY, id);
    renderTabs();
    drawWheel();
    hideSheet(newSheet);
    openEdit(); // 直接進入編輯,方便加食物
  }

  /* ---------- 面板顯示 ---------- */
  function showSheet(el) { el.hidden = false; document.body.style.overflow = 'hidden'; }
  function hideSheet(el) { el.hidden = true; document.body.style.overflow = ''; }
  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => {
      const sheet = el.closest('.sheet');
      if (sheet) hideSheet(sheet);
    });
  });

  /* ---------- 刷新 ---------- */
  function refresh() {
    tabs = getAllTabs();
    if (!tabs.some((t) => t.id === currentId)) currentId = 'mix';
    renderTabs();
    resetResult();
    drawWheel();
  }

  /* ---------- 工具 ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return h;
  }

  /* ---------- 事件綁定 ---------- */
  spinCenter.onclick = spin;
  spinBig.onclick = spin;
  canvas.onclick = () => { if (!spinning) spin(); };
  $('editBtn').onclick = openEdit;
  $('addItemBtn').onclick = addItemFromInput;
  addItemInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItemFromInput(); });
  $('saveEditBtn').onclick = saveEdit;
  $('resetThemeBtn').onclick = resetTheme;
  $('deleteThemeBtn').onclick = deleteTheme;
  $('createThemeBtn').onclick = createTheme;

  window.addEventListener('resize', () => drawWheel());
  // 用 ResizeObserver 確保版面拿到尺寸後一定會重畫(避免首次載入輪盤空白)
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => { if (!spinning) drawWheel(); });
    ro.observe(canvas);
  }

  /* ---------- 安裝到主畫面 ---------- */
  let deferredPrompt = null;
  const installBtn = $('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  };
  window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

  /* ---------- Service Worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  /* ---------- 啟動 ---------- */
  renderTabs();
  updateCount();
  // 立刻畫一次(不靠 rAF,避免背景分頁時 rAF 被延後導致空白),
  // 再用 rAF 補畫一次確保版面尺寸已定。
  drawWheel();
  requestAnimationFrame(drawWheel);
})();
