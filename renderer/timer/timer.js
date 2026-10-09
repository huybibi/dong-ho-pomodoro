'use strict';

/* Cỡ gốc của cửa sổ đồng hồ; nhân với timerScale trong Cài đặt ▸ Giao diện. */
const BASE = { w: 230, h: 96 };
/* Bảng hỏi lý do giữ cỡ cố định để chữ luôn đọc được. */
const ABORT = { w: 336, h: 236 };

const el = {
  card: U.q('#card'),
  clock: U.q('#clock'),
  intent: U.q('#intent'),
  toast: U.q('#toast'),
  reasons: U.q('#reasons'),
};

const REASONS = [
  'Có người gọi',
  'Họp đột xuất',
  'Mất tập trung',
  'Mệt / buồn ngủ',
  'Việc khác gấp',
  'Đói / khát',
];

for (const r of REASONS) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = r;
  b.addEventListener('click', () => {
    window.tomato.action('focus:stop', { reason: r });
    closeAbort();
  });
  el.reasons.appendChild(b);
}

let last = null;
let size = { w: 0, h: 0 };

function scale() {
  const v = last ? Number(last.settings.timerScale) : 1;
  return Number.isFinite(v) ? Math.min(2.2, Math.max(0.6, v)) : 1;
}

function resize(aborting) {
  const s = scale();
  el.card.style.setProperty('--ts', String(s));
  const next = aborting ? ABORT : { w: Math.round(BASE.w * s), h: Math.round(BASE.h * s) };
  if (next.w === size.w && next.h === size.h) return;
  size = next;
  window.tomato.win.setSize(next.w, next.h);
}

function openAbort() {
  document.body.classList.add('aborting');
  resize(true);
}

function closeAbort() {
  document.body.classList.remove('aborting');
  resize(false);
}

U.q('#abort-cancel').addEventListener('click', closeAbort);

let toastTimer = null;
function toast(text) {
  el.toast.textContent = text;
  el.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('on'), 9000);
}

U.q('#stop').addEventListener('click', () => {
  if (document.body.classList.contains('aborting')) return closeAbort();
  if (last && last.mode === 'focus') openAbort();
  else window.tomato.action('focus:stop', {});
});

U.drag(el.card, (e) => {
  if (e.target.closest('#stop') || e.target.closest('#abort')) return;
  window.tomato.action('focus:toggle');
});

function paint(st) {
  const wasAborting = document.body.classList.contains('aborting');
  last = st;
  document.body.className = document.body.className
    .split(' ')
    .filter((c) => !c.startsWith('mode-') && c !== 'paused')
    .join(' ');
  document.body.classList.add(`mode-${st.mode}`);
  if (!st.running && (st.mode === 'focus' || st.mode === 'break' || st.mode === 'long')) document.body.classList.add('paused');

  el.clock.textContent = st.clock;
  el.intent.textContent = st.intent || '';

  const active = st.mode === 'focus' || st.mode === 'break' || st.mode === 'long';
  if (active) resize(wasAborting);
  else if (wasAborting) closeAbort();
  else resize(false);
}

window.tomato.onState(paint);
window.tomato.onEvent((ev) => {
  if (ev.type === 'toast') toast(ev.text);
});
window.tomato.getState().then(paint);
