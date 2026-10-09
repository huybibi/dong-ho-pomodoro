'use strict';

window.U = {
  q: (sel, root) => (root || document).querySelector(sel),
  qa: (sel, root) => Array.from((root || document).querySelectorAll(sel)),

  fmt(sec) {
    const s = Math.max(0, Math.ceil(sec || 0));
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  },

  fmtLong(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    if (h) return `${h}g ${m}′`;
    return `${m}′`;
  },

  esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  },

  debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },

  /* Kéo cửa sổ bằng chuột, vẫn phân biệt được cú bấm (tap) với thao tác kéo. */
  drag(node, onTap, opts = {}) {
    let active = false;
    let moved = false;
    let sx = 0;
    let sy = 0;
    let t0 = 0;

    node.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      active = true;
      moved = false;
      sx = e.screenX;
      sy = e.screenY;
      t0 = Date.now();
      window.tomato.drag.start();
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
      if (!active) return;
      if (Math.abs(e.screenX - sx) + Math.abs(e.screenY - sy) > (opts.threshold || 4)) moved = true;
      if (moved) window.tomato.drag.move();
    });

    window.addEventListener('mouseup', (e) => {
      if (!active) return;
      active = false;
      window.tomato.drag.end();
      if (!moved && Date.now() - t0 < 700 && onTap) onTap(e);
    });

    /* Mất focus giữa chừng (bấm chỗ khác, alt-tab) thì kết thúc kéo, tránh cửa sổ
       còn bám theo con trỏ mãi. */
    window.addEventListener('blur', () => {
      if (!active) return;
      active = false;
      window.tomato.drag.end();
    });
  },
};
