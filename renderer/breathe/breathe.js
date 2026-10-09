'use strict';

const R = 112;
const C = 2 * Math.PI * R;

const ring = U.q('#ring .prog');
ring.style.strokeDasharray = String(C);

const orb = U.q('#orb');
const phaseEl = U.q('#phase');
const countEl = U.q('#count');
const stepEl = U.q('#step');
const leftEl = U.q('#left');
const descEl = U.q('#desc');

let pattern = null;
let lastIndex = -1;
let lastScale = 0.55;
let lastLeft = '';

const LABEL = { in: 'Hít vào', out: 'Thở ra', hold: 'Giữ hơi', holdout: 'Giữ trống' };

function setPhase(kind, seconds) {
  document.body.className = document.body.className
    .split(' ')
    .filter((c) => !c.startsWith('k-'))
    .join(' ');
  document.body.classList.add(`k-${kind}`);

  let target = lastScale;
  if (kind === 'in') target = 1;
  else if (kind === 'out') target = 0.55;
  else if (kind === 'hold') target = 1;
  else if (kind === 'holdout') target = 0.55;

  const dur = Math.max(0.2, Math.min(30, seconds || 4));
  orb.style.transition = `transform ${kind === 'hold' || kind === 'holdout' ? 0.6 : dur}s linear, background 0.6s, box-shadow 0.6s`;
  orb.style.transform = `scale(${target})`;
  lastScale = target;
}

function paint(st) {
  const b = st.breath;
  if (!b) return;

  if (st.mode !== 'breathe') {
    if (!document.body.classList.contains('finished')) window.tomato.win.hide('breathe');
    return;
  }

  if (b.index !== lastIndex) {
    lastIndex = b.index;
    setPhase(b.kind, b.stepTotal);
    phaseEl.textContent = b.label && b.label.length > 26 ? LABEL[b.kind] : b.label || LABEL[b.kind];
    descEl.textContent = b.label && b.label.length > 26 ? b.label : '';
  }

  countEl.textContent = b.stepLeft > 9.5 ? String(Math.ceil(b.stepLeft)) : b.stepLeft.toFixed(1);
  stepEl.textContent = `Bước ${b.index + 1}/${b.count}`;
  if (st.clock !== lastLeft) {
    lastLeft = st.clock;
    leftEl.textContent = `còn ${st.clock}`;
  }
  ring.style.strokeDashoffset = String(C * (1 - Math.min(1, Math.max(0, st.progress))));
}

U.q('#close').addEventListener('click', () => {
  document.body.classList.remove('finished');
  window.tomato.action('breathe:stop');
  window.tomato.win.hide('breathe');
});
U.q('#skip').addEventListener('click', () => window.tomato.action('breathe:skip'));
U.q('#loop').addEventListener('click', () => {
  document.body.classList.remove('finished');
  window.tomato.action('breathe:loop');
});
U.q('#done').addEventListener('click', () => {
  window.tomato.action('breathe:stop');
  window.tomato.win.hide('breathe');
});
U.q('#again').addEventListener('click', () => {
  document.body.classList.remove('finished');
  if (pattern) window.tomato.action('breathe:start', { patternId: pattern.id });
});
U.q('#go-focus').addEventListener('click', () => {
  document.body.classList.remove('finished');
  window.tomato.win.hide('breathe');
  window.tomato.action('focus:start', { minutes: 25 });
});

U.drag(U.q('#head'), null);

window.tomato.onEvent((ev) => {
  if (ev.type === 'pattern') {
    pattern = ev.pattern;
    U.q('#name').textContent = pattern.name;
    U.q('#tag').textContent = `${pattern.icon || ''} ${pattern.tag} · ${pattern.goal || ''}`.trim();
    descEl.textContent = pattern.desc;
    lastIndex = -1;
    lastScale = 0.55;
    orb.style.transition = 'none';
    orb.style.transform = 'scale(0.55)';
    document.body.classList.remove('finished');
  } else if (ev.type === 'breathe-done') {
    document.body.classList.add('finished');
  }
});

window.tomato.onState(paint);
window.tomato.getState().then(paint);
