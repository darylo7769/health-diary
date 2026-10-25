'use strict';

/* ================= 数据层 ================= */
const LS_REC = 'jk.records.v1';
const LS_SET = 'jk.settings.v1';

const TYPES = {
  weight: { key: 'weight', name: '体重', unit: '斤',   color: '#2f9df8' },
  heart:  { key: 'heart',  name: '心率', unit: 'bpm',  color: '#e5484d' },
  bp:     { key: 'bp',     name: '血压', unit: 'mmHg', color: '#7c5cff' },
};

// 体重内部按 kg 存储,界面统一按斤显示(1 kg = 2 斤)
const kg2jin = v => Math.round(v * 20) / 10;
const jin2kg = v => Math.round(v / 2 * 10) / 10;

let records = [];
let settings = { height: '', goal: '' };

function load() {
  try { records = JSON.parse(localStorage.getItem(LS_REC)) || []; } catch { records = []; }
  try { settings = Object.assign({ height: '', goal: '' }, JSON.parse(localStorage.getItem(LS_SET)) || {}); } catch {}
}
function saveRecords() { localStorage.setItem(LS_REC, JSON.stringify(records)); }
function saveSettings() { localStorage.setItem(LS_SET, JSON.stringify(settings)); }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtTime = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toLocalInput = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function dayLabel(ts) {
  const k = dayKey(ts), today = dayKey(Date.now());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (k === today) return '今天';
  if (k === dayKey(y.getTime())) return '昨天';
  const d = new Date(ts);
  const yPrefix = d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}年`;
  return `${yPrefix}${d.getMonth() + 1}月${d.getDate()}日 周${WEEK[d.getDay()]}`;
}

/* ================= 健康判定 ================= */
function bpCategory(sys, dia) {
  if (sys < 90 || dia < 60) return { label: '偏低', cls: 'low' };
  if (sys >= 160 || dia >= 100) return { label: '偏高 2级', cls: 'danger' };
  if (sys >= 140 || dia >= 90) return { label: '偏高', cls: 'danger' };
  if (sys >= 120 || dia >= 80) return { label: '正常高值', cls: 'warn' };
  return { label: '正常', cls: 'ok' };
}
function hrStatus(v) {
  if (v < 60) return { label: '偏低', cls: 'low' };
  if (v > 100) return { label: '偏高', cls: 'warn' };
  return { label: '正常', cls: 'ok' };
}
function bmiInfo() {
  const h = parseFloat(settings.height);
  if (!h) return null;
  const w = latestOf('weight');
  if (!w) return null;
  const bmi = w.value / Math.pow(h / 100, 2);
  let label = '正常', cls = 'ok';
  if (bmi < 18.5) { label = '偏瘦'; cls = 'low'; }
  else if (bmi >= 28) { label = '肥胖'; cls = 'danger'; }
  else if (bmi >= 24) { label = '超重'; cls = 'warn'; }
  return { bmi: bmi.toFixed(1), label, cls };
}

/* ================= 查询 ================= */
// O(n) 查找最新/次新记录,避免反复 filter+sort
function latestOf(t) {
  let best = null;
  for (const r of records) if (r.type === t && (!best || r.ts > best.ts)) best = r;
  return best;
}
function prevOf(t) {
  let b1 = null, b2 = null;
  for (const r of records) {
    if (r.type !== t) continue;
    if (!b1 || r.ts > b1.ts) { b2 = b1; b1 = r; }
    else if (!b2 || r.ts > b2.ts) b2 = r;
  }
  return b2;
}

function streakDays() {
  const keys = new Set(records.map(r => dayKey(r.ts)));
  let n = 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (!keys.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1); // 今天还没记,从昨天算起
  while (keys.has(dayKey(d.getTime()))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ================= 图标 ================= */
const ICONS = {
  weight: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8 9h3"/><path d="M12 15a3 3 0 0 0 6 0"/></svg>',
  heart: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.6-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.4-9 9-9 9z"/></svg>',
  bp: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3.2 4.2 6 7 6 10a6 6 0 1 1-12 0c0-3 2.8-5.8 6-10z"/></svg>',
};

// 卡片数字自适应:三列卡片窄(内宽约 83px),数字越长字号越小,保证单位不换行
function fitSize(text) {
  const len = String(text).length;
  if (len >= 6) return 18;   // 120/80
  if (len >= 5) return 21;   // 131.6
  return 26;
}

function valueText(r) {
  if (r.type === 'bp') return `${r.sys}<small>/${r.dia} ${TYPES.bp.unit}</small>`;
  const v = r.type === 'weight' ? kg2jin(r.value) : r.value;
  return `${v}<small> ${TYPES[r.type].unit}</small>`;
}

/* ================= 首页 ================= */
function renderHome() {
  const now = new Date();
  document.getElementById('home-date').textContent =
    `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${WEEK[now.getDay()]}`;
  document.getElementById('streak-num').textContent = streakDays();

  renderWeightCard();
  renderHeartCard();
  renderBpCard();
  renderTodayList();
}

function renderWeightCard() {
  const el = document.getElementById('card-weight');
  const cur = latestOf('weight'), prev = prevOf('weight');
  let html = `<div class="mc-head"><span class="mc-ico" style="--c:${TYPES.weight.color}">${ICONS.weight}</span>体重</div>`;
  if (!cur) {
    html += `<div class="mc-empty">暂无数据<br>点击下方记一笔</div>`;
  } else {
    const jin = kg2jin(cur.value).toFixed(1);
    html += `<div class="mc-value" style="font-size:${fitSize(jin)}px">${jin}<small>斤</small></div>`;
    const bmi = bmiInfo();
    if (bmi) html += `<span class="mc-badge ${bmi.cls}">BMI ${bmi.bmi}·${bmi.label}</span>`;
    if (prev) {
      const diff = kg2jin(cur.value) - kg2jin(prev.value);
      const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '—';
      const color = diff > 0 ? 'var(--danger)' : diff < 0 ? 'var(--ok)' : 'var(--muted)';
      html += `<div class="mc-sub">较上次 <b style="color:${color}">${arrow}${Math.abs(diff).toFixed(1)}</b></div>`;
    }
    if (settings.goal) html += `<div class="mc-sub">目标 ${kg2jin(settings.goal)} 斤</div>`;
  }
  el.innerHTML = html;
}

function renderHeartCard() {
  const el = document.getElementById('card-heart');
  const cur = latestOf('heart');
  let html = `<div class="mc-head"><span class="mc-ico" style="--c:${TYPES.heart.color}">${ICONS.heart}</span>心率</div>`;
  if (!cur) {
    html += `<div class="mc-empty">暂无数据<br>点击下方记一笔</div>`;
  } else {
    const st = hrStatus(cur.value);
    html += `<div class="mc-value" style="font-size:${fitSize(cur.value)}px">${cur.value}<small>bpm</small></div>
             <span class="mc-badge ${st.cls}">${st.label}</span>
             <div class="mc-sub">${dayLabel(cur.ts)} ${fmtTime(cur.ts)}</div>`;
  }
  el.innerHTML = html;
}

function renderBpCard() {
  const el = document.getElementById('card-bp');
  const cur = latestOf('bp');
  let html = `<div class="mc-head"><span class="mc-ico" style="--c:${TYPES.bp.color}">${ICONS.bp}</span>血压</div>`;
  if (!cur) {
    html += `<div class="mc-empty">暂无数据<br>点击下方记一笔</div>`;
  } else {
    const cat = bpCategory(cur.sys, cur.dia);
    html += `<div class="mc-value" style="font-size:${fitSize(cur.sys + '/' + cur.dia)}px">${cur.sys}<span class="sep">/</span>${cur.dia}<small>mmHg</small></div>
             <span class="mc-badge ${cat.cls}">${cat.label}</span>
             <div class="mc-sub">${dayLabel(cur.ts)} ${fmtTime(cur.ts)}</div>`;
  }
  el.innerHTML = html;
}

function renderTodayList() {
  const el = document.getElementById('today-list');
  const k = dayKey(Date.now());
  const list = records.filter(r => dayKey(r.ts) === k).sort((a, b) => b.ts - a.ts);
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><span class="big">📝</span>今天还没记录,点下面按钮记一笔</div>`;
    return;
  }
  el.innerHTML = list.map(recItemHtml).join('');
}

function recItemHtml(r) {
  const t = TYPES[r.type];
  return `<div class="rec-item" data-id="${r.id}">
    <span class="rec-ico" style="--c:${t.color}">${ICONS[r.type]}</span>
    <div class="rec-main">
      <div class="rec-type">${t.name}</div>
      ${r.note ? `<div class="rec-note">${escapeHtml(r.note)}</div>` : ''}
    </div>
    <div class="rec-right">
      <div class="rec-value">${valueText(r)}</div>
      <div class="rec-time">${fmtTime(r.ts)}</div>
    </div>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ================= 历史 ================= */
let histFilter = 'all';
function renderHistory() {
  const el = document.getElementById('history-list');
  let list = [...records].sort((a, b) => b.ts - a.ts);
  if (histFilter !== 'all') list = list.filter(r => r.type === histFilter);
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><span class="big">🗂️</span>暂无记录</div>`;
    return;
  }
  const groups = new Map();
  list.forEach(r => {
    const k = dayKey(r.ts);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  });
  let html = '';
  for (const [k, arr] of groups) {
    html += `<div class="day-group">
      <div class="day-head">${dayLabel(arr[0].ts)}<small>${arr.length} 条</small></div>
      ${arr.map(recItemHtml).join('')}
    </div>`;
  }
  el.innerHTML = html;
}

/* ================= 趋势图表 ================= */
let chartMetric = 'weight';
let chartRange = 7;

function buildSeries(metric, days) {
  // 先按天分组,O(n) 代替逐天 filter
  const groups = new Map();
  for (const r of records) {
    if (r.type !== metric) continue;
    const k = dayKey(r.ts);
    const arr = groups.get(k);
    if (arr) arr.push(r); else groups.set(k, [r]);
  }
  const out = [];
  const base = new Date(); base.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    const day = groups.get(dayKey(d.getTime())) || [];
    const p = { label: `${d.getMonth() + 1}/${d.getDate()}`, value: null, sys: null, dia: null };
    if (day.length) {
      if (metric === 'bp') {
        p.sys = day.reduce((s, r) => s + r.sys, 0) / day.length;
        p.dia = day.reduce((s, r) => s + r.dia, 0) / day.length;
      } else {
        p.value = day.reduce((s, r) => s + r.value, 0) / day.length;
      }
    }
    out.push(p);
  }
  return out;
}

function seriesNumbers(series, metric, key) {
  if (metric === 'bp') return series.map(p => p[key]);
  return series.map(p => p.value);
}

function statsOf(nums) {
  const valid = nums.map((v, i) => ({ v, i })).filter(x => x.v != null);
  if (!valid.length) return null;
  const vals = valid.map(x => x.v);
  const first = valid[0].v, last = valid[valid.length - 1].v;
  return {
    latest: last,
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    min: Math.min(...vals),
    max: Math.max(...vals),
    change: last - first,
  };
}

function fmtStat(v, metric) {
  if (v == null) return '--';
  return metric === 'weight' ? v.toFixed(1) : Math.round(v);
}

function renderCharts() {
  const series = buildSeries(chartMetric, chartRange);
  // 体重图表统一换算为斤
  if (chartMetric === 'weight') series.forEach(p => { if (p.value != null) p.value = kg2jin(p.value); });
  const statsEl = document.getElementById('chart-stats');
  const legendEl = document.getElementById('chart-legend');

  const keys = chartMetric === 'bp' ? ['sys', 'dia'] : ['value'];
  const statsArr = keys.map(k => statsOf(seriesNumbers(series, chartMetric, k)));

  const fmtNum = v => fmtStat(v, chartMetric);
  let statHtml = '';
  const s0 = statsArr[0];
  if (!s0) {
    statHtml = ['最新', '平均', '最高', '最低'].map(l => `<div class="stat-box"><b>--</b><span>${l}</span></div>`).join('');
  } else if (chartMetric === 'bp') {
    const [ss, sd] = statsArr;
    statHtml = `
      <div class="stat-box"><b>${fmtNum(ss.latest)}/${fmtNum(sd.latest)}</b><span>最新</span></div>
      <div class="stat-box"><b>${fmtNum(ss.avg)}/${fmtNum(sd.avg)}</b><span>平均</span></div>
      <div class="stat-box"><b>${fmtNum(ss.max)}/${fmtNum(sd.max)}</b><span>最高</span></div>
      <div class="stat-box"><b>${fmtNum(ss.min)}/${fmtNum(sd.min)}</b><span>最低</span></div>`;
  } else {
    const cls = s0.change > 0 ? 'up' : s0.change < 0 ? 'down' : '';
    const arrow = s0.change > 0 ? '↑' : s0.change < 0 ? '↓' : '';
    statHtml = `
      <div class="stat-box"><b>${fmtNum(s0.latest)}</b><span>最新</span></div>
      <div class="stat-box"><b>${fmtNum(s0.avg)}</b><span>平均</span></div>
      <div class="stat-box"><b>${fmtNum(s0.max)}</b><span>最高</span></div>
      <div class="stat-box"><b class="${cls}">${arrow}${Math.abs(chartMetric === 'weight' ? s0.change.toFixed(1) : Math.round(s0.change))}</b><span>区间变化</span></div>`;
  }
  statsEl.innerHTML = statHtml;

  if (chartMetric === 'bp') {
    legendEl.innerHTML = `<span><i style="background:#e5484d"></i>收缩压(高压)</span><span><i style="background:#2f9df8"></i>舒张压(低压)</span>`;
  } else {
    legendEl.innerHTML = `<span><i style="background:${TYPES[chartMetric].color}"></i>${TYPES[chartMetric].name}(${TYPES[chartMetric].unit})</span>`;
  }

  requestAnimationFrame(() => drawChart(series));
}

function drawChart(series) {
  const canvas = document.getElementById('chart');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const lines = chartMetric === 'bp'
    ? [{ nums: seriesNumbers(series, 'bp', 'sys'), color: '#e5484d' },
       { nums: seriesNumbers(series, 'bp', 'dia'), color: '#2f9df8' }]
    : [{ nums: seriesNumbers(series, chartMetric), color: TYPES[chartMetric].color }];

  const all = lines.flatMap(l => l.nums).filter(v => v != null);
  const padL = 40, padR = 14, padT = 18, padB = 26;
  if (!all.length) {
    ctx.fillStyle = '#8a94a3';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无数据,点下方 + 记一笔', w / 2, h / 2);
    return;
  }

  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const margin = (max - min) * 0.15;
  min -= margin; max += margin;

  const n = series.length;
  const iw = w - padL - padR, ih = h - padT - padB;
  const x = i => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = v => padT + (1 - (v - min) / (max - min)) * ih;

  // 网格与 Y 轴标签
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  for (let g = 0; g <= 4; g++) {
    const gv = min + (max - min) * (g / 4);
    const gy = y(gv);
    ctx.strokeStyle = '#eef1f4';
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
    ctx.fillStyle = '#a8b1bd';
    const label = chartMetric === 'weight' ? gv.toFixed(1) : Math.round(gv);
    ctx.fillText(label, padL - 6, gy + 3);
  }

  // X 轴标签(最多 6 个)
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.ceil(n / 6));
  ctx.fillStyle = '#a8b1bd';
  for (let i = 0; i < n; i += step) {
    ctx.fillText(series[i].label, x(i), h - 8);
  }
  if ((n - 1) % step !== 0) ctx.fillText(series[n - 1].label, x(n - 1), h - 8);

  // 折线(跨过空点,把相邻数据点直接相连)
  lines.forEach(({ nums, color }) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const pts = [];
    nums.forEach((v, i) => { if (v != null) pts.push({ i, v }); });
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(x(pts[0].i), y(pts[0].v));
      for (let s = 1; s < pts.length; s++) {
        const prev = pts[s - 1], cur = pts[s];
        const mx = (x(prev.i) + x(cur.i)) / 2;
        ctx.bezierCurveTo(mx, y(prev.v), mx, y(cur.v), x(cur.i), y(cur.v));
      }
      ctx.stroke();
    }

    // 数据点
    nums.forEach((v, i) => {
      if (v == null) return;
      ctx.beginPath();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.arc(x(i), y(v), 3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    });

    // 最新点高亮 + 数值
    for (let i = n - 1; i >= 0; i--) {
      const v = nums[i];
      if (v == null) continue;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x(i), y(v), 5, 0, Math.PI * 2);
      ctx.globalAlpha = 0.18; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x(i), y(v), 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      const label = chartMetric === 'weight' ? v.toFixed(1) : Math.round(v);
      ctx.fillText(label, Math.min(Math.max(x(i), padL), w - padR - 8), y(v) - 10);
      break;
    }
  });
}

/* ================= 记一笔弹层 ================= */
let sheetType = 'weight';
let editingId = null;

const sheet = document.getElementById('sheet');
const backdrop = document.getElementById('sheet-backdrop');
const sheetInputs = document.getElementById('sheet-inputs');
const sheetTime = document.getElementById('sheet-time');
const sheetNote = document.getElementById('sheet-note');

function sheetInputsHtml(type) {
  if (type === 'bp') {
    return `<div class="big-inputs">
      <div class="big-field"><label>收缩压(高压)</label><div class="wrap"><input type="number" id="in-sys" inputmode="numeric" placeholder="120" min="50" max="260"></div><small>mmHg</small></div>
      <div class="bp-sep">/</div>
      <div class="big-field"><label>舒张压(低压)</label><div class="wrap"><input type="number" id="in-dia" inputmode="numeric" placeholder="80" min="30" max="180"></div><small>mmHg</small></div>
    </div>`;
  }
  const t = TYPES[type];
  const ph = type === 'weight' ? '130.0' : '72';
  return `<div class="big-inputs">
    <div class="big-field"><label>${t.name}</label><div class="wrap"><input type="number" id="in-value" inputmode="decimal" placeholder="${ph}" step="0.1"></div><small>${t.unit}</small></div>
  </div>`;
}

function openSheet(type, rec) {
  editingId = rec ? rec.id : null;
  sheetType = rec ? rec.type : (type || 'weight');
  document.getElementById('sheet-title').textContent = rec ? '编辑记录' : '记一笔';
  document.querySelectorAll('#sheet-type-seg button').forEach(b => {
    b.classList.toggle('active', b.dataset.type === sheetType);
    b.classList.toggle('disabled', !!rec);
  });
  sheetInputs.innerHTML = sheetInputsHtml(sheetType);
  sheetTime.value = toLocalInput(rec ? rec.ts : Date.now());
  sheetNote.value = rec ? (rec.note || '') : '';
  document.getElementById('sheet-delete').classList.toggle('hidden', !rec);

  if (rec) {
    if (rec.type === 'bp') {
      document.getElementById('in-sys').value = rec.sys;
      document.getElementById('in-dia').value = rec.dia;
    } else {
      document.getElementById('in-value').value = rec.type === 'weight' ? kg2jin(rec.value) : rec.value;
    }
  }

  sheet.classList.add('show');
  backdrop.classList.add('show');
}

function closeSheet() {
  sheet.classList.remove('show');
  backdrop.classList.remove('show');
  editingId = null;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ---------- iOS 主屏幕 App 兼容 ---------- */
// standalone 模式下 confirm()/blob 下载不可用
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// 自定义确认框,返回 Promise<boolean>
function showConfirm(msg, okText = '确定') {
  return new Promise(resolve => {
    const mask = document.getElementById('confirm-mask');
    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    document.getElementById('confirm-text').textContent = msg;
    ok.textContent = okText;
    mask.classList.add('show');
    const done = val => {
      mask.classList.remove('show');
      ok.onclick = cancel.onclick = mask.onclick = null;
      resolve(val);
    };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
    mask.onclick = e => { if (e.target === mask) done(false); };
  });
}

// 导出:浏览器走下载;主屏幕 App 走文本弹层 + 复制
function deliverFile(name, content, mime) {
  if (isStandalone()) return showExportText(name, content);
  downloadFile(name, content, mime);
  toast('已导出');
}

function showExportText(name, content) {
  const mask = document.getElementById('export-mask');
  document.getElementById('export-title').textContent =
    name + '(主屏幕模式无法下载,请复制保存)';
  document.getElementById('export-text').value = content;
  mask.classList.add('show');
}

function copyExportText() {
  const ta = document.getElementById('export-text');
  const done = () => toast('已复制,可粘贴到备忘录保存');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ta.value).then(done).catch(() => { ta.select(); document.execCommand('copy'); done(); });
  } else {
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch {}
    done();
  }
}

function saveSheet() {
  const ts = new Date(sheetTime.value).getTime();
  if (!sheetTime.value || isNaN(ts)) return toast('请选择时间');
  if (ts > Date.now() + 86400000) return toast('时间不能超过当前太多');

  let rec = { id: editingId || uid(), type: sheetType, ts, note: sheetNote.value.trim() };

  if (sheetType === 'bp') {
    const sys = parseFloat(document.getElementById('in-sys').value);
    const dia = parseFloat(document.getElementById('in-dia').value);
    if (!sys || !dia) return toast('请填写收缩压和舒张压');
    if (sys < 50 || sys > 260 || dia < 30 || dia > 180) return toast('血压数值超出合理范围');
    if (sys <= dia) return toast('收缩压应大于舒张压');
    rec.sys = Math.round(sys); rec.dia = Math.round(dia);
  } else {
    const v = parseFloat(document.getElementById('in-value').value);
    if (!v) return toast('请填写数值');
    if (sheetType === 'weight') {
      if (v < 40 || v > 600) return toast('体重数值超出合理范围(斤)');
      rec.value = jin2kg(v);
    } else {
      if (v < 30 || v > 220) return toast('心率数值超出合理范围');
      rec.value = Math.round(v);
    }
  }

  if (editingId) {
    const i = records.findIndex(r => r.id === editingId);
    if (i >= 0) records[i] = rec;
    toast('已更新');
  } else {
    records.push(rec);
    toast('已记下 ✓');
  }
  saveRecords();
  closeSheet();
  refreshAll();
}

async function deleteSheet() {
  if (!editingId) return;
  if (!(await showConfirm('确定删除这条记录吗?', '删除'))) return;
  records = records.filter(r => r.id !== editingId);
  saveRecords();
  closeSheet();
  refreshAll();
  toast('已删除');
}

/* ================= 我的 ================= */
function renderMe() {
  document.getElementById('height-input').value = settings.height || '';
  document.getElementById('goal-input').value = settings.goal ? kg2jin(settings.goal) : '';
}

function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCsv() {
  if (!records.length) return toast('暂无数据可导出');
  const rows = [['类型', '时间', '体重斤', '心率bpm', '收缩压', '舒张压', '备注']];
  [...records].sort((a, b) => a.ts - b.ts).forEach(r => {
    const t = new Date(r.ts);
    const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
    rows.push([TYPES[r.type].name, ts,
      r.type === 'weight' ? kg2jin(r.value) : '',
      r.type === 'heart' ? r.value : '',
      r.type === 'bp' ? r.sys : '',
      r.type === 'bp' ? r.dia : '',
      r.note || '']);
  });
  const csv = '\uFEFF' + rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  deliverFile(`每日健康数据_${dayKey(Date.now())}.csv`, csv, 'text/csv;charset=utf-8');
}

function exportJson() {
  if (!records.length) return toast('暂无数据可导出');
  deliverFile(`每日健康备份_${dayKey(Date.now())}.json`, JSON.stringify({ records, settings }, null, 2), 'application/json');
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const list = Array.isArray(data) ? data : data.records;
      if (!Array.isArray(list)) throw new Error('bad');
      const valid = list.filter(r => r && TYPES[r.type] && typeof r.ts === 'number');
      if (!valid.length) throw new Error('bad');
      const ids = new Set(records.map(r => r.id));
      valid.forEach(r => {
        if (!r.id || ids.has(r.id)) r.id = uid();
        records.push(r);
      });
      if (data.settings) settings = Object.assign(settings, data.settings);
      saveRecords(); saveSettings();
      refreshAll();
      toast(`已导入 ${valid.length} 条记录`);
    } catch {
      toast('文件格式不正确');
    }
  };
  reader.readAsText(file);
}

async function seedDemo() {
  if (records.length && !(await showConfirm('已有数据,继续追加示例数据吗?', '追加'))) return;
  const base = new Date(); base.setHours(0, 0, 0, 0);
  const rand = (a, b) => a + Math.random() * (b - a);
  let w = 66.5;
  for (let i = 34; i >= 0; i--) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    const ts = h => new Date(d.getTime() + h * 3600000 + rand(0, 1800000)).getTime();
    if (Math.random() < 0.85) {
      w += rand(-0.35, 0.25);
      records.push({ id: uid(), type: 'weight', ts: ts(7.5), value: Math.round(w * 10) / 10, note: '晨起空腹' });
    }
    if (Math.random() < 0.8) {
      records.push({ id: uid(), type: 'heart', ts: ts(8), value: Math.round(rand(58, 92)), note: '' });
    }
    if (Math.random() < 0.8) {
      records.push({ id: uid(), type: 'bp', ts: ts(21), sys: Math.round(rand(110, 138)), dia: Math.round(rand(66, 90)), note: '睡前测量' });
    }
  }
  saveRecords();
  refreshAll();
  toast('示例数据已填入');
}

/* ================= 刷新 & 路由 ================= */
function refreshAll() {
  renderHome();
  renderHistory();
  renderCharts();
  renderMe();
}

function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
  document.querySelectorAll('#tabbar .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  if (tab === 'charts') renderCharts();
  if (tab === 'history') renderHistory();
  window.scrollTo(0, 0);
}

/* ================= 事件绑定 ================= */
function bind() {
  document.querySelectorAll('#tabbar .tab').forEach(t =>
    t.addEventListener('click', () => switchTab(t.dataset.tab)));

  document.getElementById('fab').addEventListener('click', () => openSheet('weight'));
  document.querySelectorAll('.quick-btn').forEach(b =>
    b.addEventListener('click', () => openSheet(b.dataset.quick)));

  document.getElementById('metric-seg').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    chartMetric = btn.dataset.metric;
    document.querySelectorAll('#metric-seg button').forEach(b => b.classList.toggle('active', b === btn));
    renderCharts();
  });
  document.getElementById('range-seg').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    chartRange = parseInt(btn.dataset.range, 10);
    document.querySelectorAll('#range-seg button').forEach(b => b.classList.toggle('active', b === btn));
    renderCharts();
  });
  document.getElementById('hist-seg').addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    histFilter = btn.dataset.filter;
    document.querySelectorAll('#hist-seg button').forEach(b => b.classList.toggle('active', b === btn));
    renderHistory();
  });

  document.getElementById('sheet-type-seg').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.classList.contains('disabled')) return;
    sheetType = btn.dataset.type;
    document.querySelectorAll('#sheet-type-seg button').forEach(b => b.classList.toggle('active', b === btn));
    sheetInputs.innerHTML = sheetInputsHtml(sheetType);
  });

  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  document.getElementById('sheet-save').addEventListener('click', saveSheet);
  document.getElementById('sheet-delete').addEventListener('click', deleteSheet);

  // 点击记录 → 编辑
  document.addEventListener('click', e => {
    const item = e.target.closest('.rec-item');
    if (!item) return;
    const rec = records.find(r => r.id === item.dataset.id);
    if (rec) openSheet(rec.type, rec);
  });

  document.getElementById('height-input').addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    settings.height = (v >= 80 && v <= 230) ? v : '';
    e.target.value = settings.height;
    saveSettings(); renderHome();
    toast(settings.height ? '身高已保存' : '请输入 80-230 之间的身高');
  });
  document.getElementById('goal-input').addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    settings.goal = (v >= 40 && v <= 600) ? jin2kg(v) : '';
    e.target.value = settings.goal ? kg2jin(settings.goal) : '';
    saveSettings(); renderHome();
  });

  document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
  document.getElementById('btn-export-json').addEventListener('click', exportJson);
  document.getElementById('btn-import-json').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', e => {
    if (e.target.files[0]) importJson(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btn-seed').addEventListener('click', seedDemo);
  document.getElementById('btn-clear').addEventListener('click', async () => {
    if (!(await showConfirm('确定清空全部数据吗?此操作不可恢复!', '清空'))) return;
    records = [];
    saveRecords();
    refreshAll();
    toast('已清空');
  });

  // 导出弹层按钮
  document.getElementById('export-close').addEventListener('click', () =>
    document.getElementById('export-mask').classList.remove('show'));
  document.getElementById('export-copy').addEventListener('click', copyExportText);

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (document.getElementById('page-charts').classList.contains('active')) renderCharts();
    }, 150);
  });
}

/* ================= 启动 ================= */
load();
bind();
refreshAll();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
