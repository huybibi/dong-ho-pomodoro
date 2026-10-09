'use strict';

const AMBIENTS = [
  ['off', 'Tắt'],
  ['brown', 'Tiếng nâu'],
  ['rain', 'Mưa'],
  ['ocean', 'Sóng biển'],
  ['cafe', 'Quán cà phê'],
  ['fire', 'Lửa'],
  ['bowl', 'Chuông 432Hz'],
  ['binaural', 'Binaural'],
];

let st = null;

/* ---------- điều hướng ---------- */

U.qa('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    U.qa('.tab').forEach((x) => x.classList.toggle('on', x === t));
    U.qa('.pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === t.dataset.pane));
  });
});

U.q('#close').addEventListener('click', () => window.tomato.win.close('settings'));
U.q('#min').addEventListener('click', () => window.tomato.win.hide('settings'));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.tomato.win.hide('settings');
});

/* ---------- ràng buộc điều khiển ---------- */

function patch(obj) {
  window.tomato.action('settings:set', { patch: obj });
}

function updateOutputs() {
  U.qa('output[data-for]').forEach((o) => {
    const input = U.q(`[data-key="${o.dataset.for}"]`);
    if (input) o.textContent = input.value;
  });
}

U.qa('[data-key]').forEach((el) => {
  const key = el.dataset.key;
  el.addEventListener('input', updateOutputs);
  el.addEventListener('change', () => {
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'range' || el.type === 'number') v = Number(el.value);
    else v = el.value;
    patch({ [key]: v });
  });
});

U.qa('[data-presets]').forEach((el) => {
  el.addEventListener('change', () => {
    const arr = el.value
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 180)
      .slice(0, 6);
    if (arr.length) patch({ focusPresets: arr });
    else el.value = st.settings.focusPresets.join(',');
  });
});

U.qa('[data-action]').forEach((b) => {
  b.addEventListener('click', () => {
    const a = b.dataset.action;
    if (a === 'pos:reset') window.tomato.action('pos:reset');
    else if (a === 'stats:reset') {
      if (confirm('Xoá toàn bộ lịch sử tập trung? Không khôi phục được.')) window.tomato.action('stats:reset');
    } else if (a === 'sound:test') window.tomato.action('sound:test', { cue: 'bell' });
    else if (a === 'session:pause') window.tomato.action('focus:toggle');
    else if (a === 'session:extend') window.tomato.action('focus:extend', { minutes: 5 });
    else if (a === 'session:skip') window.tomato.action('focus:skip');
  });
});

/* ---------- các khối sinh động ---------- */

function renderAmbChips() {
  const box = U.q('#amb-chips');
  box.innerHTML = '';
  for (const [id, label] of AMBIENTS) {
    const b = document.createElement('button');
    b.className = `chip${st.settings.ambient === id ? ' on' : ''}`;
    b.textContent = label;
    b.addEventListener('click', () => window.tomato.action('ambient:set', { kind: id }));
    box.appendChild(b);
  }
}

function renderPatterns() {
  const box = U.q('#pattern-list');
  box.innerHTML = '';
  for (const p of st.patterns) {
    const d = document.createElement('div');
    d.className = 'item';
    d.innerHTML = `<span class="em">${U.esc(p.icon || '○')}</span><span><b>${U.esc(p.name)}</b> · ${U.esc(p.tag)} — ${U.esc(p.desc)}</span><span class="rt">${Math.round(p.seconds / 60)} phút</span>`;
    box.appendChild(d);
  }
}

function renderStats() {
  const cards = U.q('#stat-cards');
  const s = st.summary;
  const items = [
    { v: String(st.today.focus), k: `phiên hôm nay / mục tiêu ${st.goal}` },
    { v: U.fmtLong(st.today.seconds), k: 'tập trung hôm nay' },
    { v: `${st.streak.current}`, k: `chuỗi ngày liên tiếp · kỷ lục ${st.streak.best}` },
    { v: U.fmtLong(s.totalFocusSeconds), k: `tổng cộng · ${s.totalSessions} phiên` },
  ];
  cards.innerHTML = items.map((i) => `<div class="stat"><div class="v">${U.esc(i.v)}</div><div class="k">${U.esc(i.k)}</div></div>`).join('');

  const week = U.q('#week');
  const max = Math.max(1, ...st.week.map((d) => d.focus));
  week.innerHTML = st.week
    .map((d, i) => {
      const h = Math.round((d.focus / max) * 100);
      const today = i === st.week.length - 1 ? ' today' : '';
      return `<div class="wcol${today}"><div class="wl">${d.focus || ''}</div><div class="wbar" style="height:${Math.max(3, h)}%"></div><div class="wl">${d.label}</div></div>`;
    })
    .join('');

  const ins = U.q('#insight');
  const lines = [];
  if (s.reasons.length) {
    lines.push(`Thứ hay cắt ngang bạn nhất: “${s.reasons[0].reason}” (${s.reasons[0].count} lần).`);
    if (s.totalAborts > 0 && st.today.focus + st.today.aborts > 0) {
      const rate = Math.round((s.totalAborts / Math.max(1, s.totalAborts + s.totalSessions)) * 100);
      lines.push(`Tỉ lệ bỏ giữa chừng: ${rate}%. Dưới 20% là rất tốt.`);
    }
  }
  if (s.totalBreathingSeconds > 60) lines.push(`Bạn đã dành ${U.fmtLong(s.totalBreathingSeconds)} để hít thở trước khi làm việc.`);
  if (st.streak.current >= 3) lines.push(`Chuỗi ${st.streak.current} ngày — đừng để đứt hôm nay.`);
  ins.textContent = lines.join('\n') || 'Cứ làm vài phiên rồi quay lại đây, mục này sẽ chỉ ra thói quen của bạn.';
  ins.style.display = lines.length ? 'block' : 'none';

  const intents = U.q('#intents');
  const today = st.today.intents.slice().reverse();
  if (today.length) {
    intents.innerHTML = `<h2>Hôm nay bạn nhắm tới</h2>` +
      today
        .map((it) => {
          const d = new Date(it.t);
          return `<div class="item"><span class="em">🍅</span><span>${U.esc(it.text)}</span><span class="rt">${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}${it.seconds ? ` · ${Math.round(it.seconds / 60)}′` : ''}</span></div>`;
        })
        .join('');
  } else {
    intents.innerHTML = '';
  }
}

/* ---------- vẽ ---------- */

function paint(next) {
  st = next;
  const s = st.settings;

  U.qa('[data-key]').forEach((el) => {
    const key = el.dataset.key;
    if (el.type === 'checkbox') el.checked = !!s[key];
    else if (document.activeElement !== el) el.value = String(s[key]);
  });
  U.qa('[data-presets]').forEach((el) => {
    if (document.activeElement !== el) el.value = s.focusPresets.join(',');
  });
  updateOutputs();
  renderAmbChips();
  renderPatterns();
  renderStats();
}

window.tomato.getState().then((s) => {
  st = s;
  U.q('#data-path').textContent = 'Lịch sử được lưu trong thư mục dữ liệu của ứng dụng (deepwork.json).';
  paint(s);
});
window.tomato.onState(paint);
