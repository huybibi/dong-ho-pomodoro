'use strict';

const ring = U.q('#ring .prog');
const C = 2 * Math.PI * 52;
ring.style.strokeDasharray = String(C);

const timeEl = U.q('#time');
const streakEl = U.q('#streak');
const body = document.body;

let last = null;

function paint(st) {
  last = st;
  const active = st.mode === 'focus' || st.mode === 'break' || st.mode === 'long';
  body.classList.toggle('running', active && st.running);
  body.classList.toggle('paused', active && !st.running);
  body.classList.toggle('hot', st.mode === 'focus');
  body.classList.toggle('mode-break', st.mode === 'break');
  body.classList.toggle('mode-long', st.mode === 'long');
  body.classList.toggle('mode-breathe', st.mode === 'breathe');
  body.classList.toggle('streaked', st.streak.current > 0);

  const p = st.mode === 'breathe' && st.breath ? st.breath.index / Math.max(1, st.breath.count) : st.progress;
  ring.style.strokeDashoffset = String(C * (1 - Math.min(1, Math.max(0, p))));

  if (st.mode === 'breathe' && st.breath) {
    timeEl.textContent = st.breath.label.length > 22 ? `${st.breath.label.slice(0, 21)}…` : st.breath.label;
  } else if (active) {
    timeEl.textContent = `${st.paused ? '⏸ ' : ''}${st.clock} · ${st.modeLabel}`;
  } else if (st.today && st.today.seconds > 0) {
    timeEl.textContent = `Hôm nay ${st.today.focus}/${st.goal} 🍅`;
  } else {
    timeEl.textContent = 'Bấm để bắt đầu';
  }
  streakEl.textContent = String(st.streak.current);
}

U.drag(U.q('#stage'), () => window.tomato.action('menu:toggle'));

U.q('#stage').addEventListener('dblclick', () => {
  if (!last) return;
  if (last.mode === 'focus') window.tomato.action('focus:toggle');
  else window.tomato.action('focus:start', { minutes: last.settings.focusMin, intent: last.intent });
});

/* Cửa sổ cà chua rộng 150px nhưng quả chỉ chiếm giữa: phần trong suốt để chuột xuyên qua,
   chỉ khi trỏ đúng vào quả cà chua thì cửa sổ mới nhận chuột. */
let clickThrough = null;
let dragging = false;

function setClickThrough(flag) {
  if (flag === clickThrough) return;
  clickThrough = flag;
  window.tomato.win.setClickThrough(flag);
}

/* Lúc kéo phải giữ cho cửa sổ nhận chuột liên tục: nếu bật xuyên chuột giữa chừng
   (con trỏ lệch khỏi quả trong lúc cửa sổ chạy chậm hơn) thì mousemove ngừng tới
   và quả cà chua đứng yên giữa đường. */
window.addEventListener(
  'mousedown',
  () => {
    dragging = true;
    setClickThrough(false);
  },
  true
);

window.addEventListener('mouseup', () => {
  dragging = false;
});

window.addEventListener('blur', () => {
  dragging = false;
});

window.addEventListener('mousemove', (e) => {
  if (dragging) return;
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  setClickThrough(!(hit && hit.closest && hit.closest('#fruit')));
});

document.addEventListener('mouseleave', () => {
  if (!dragging) setClickThrough(true);
});

setClickThrough(true);

window.tomato.onState(paint);
window.tomato.getState().then(paint);
