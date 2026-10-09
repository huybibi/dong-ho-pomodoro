'use strict';

/* Các bài hướng dẫn hít thở. Mỗi bước: { k: loại pha, s: số giây, l: nhãn }
   k = in (hít vào) | hold (giữ hơi) | out (thở ra) | holdout (giữ trống) */

const IN = (s, l) => ({ k: 'in', s, l });
const HOLD = (s, l) => ({ k: 'hold', s, l });
const OUT = (s, l) => ({ k: 'out', s, l });
const EMPTY = (s, l) => ({ k: 'holdout', s, l });

function cycle(steps, times) {
  const out = [];
  for (let i = 0; i < times; i++) for (const st of steps) out.push({ ...st });
  return out;
}

function total(steps) {
  return steps.reduce((a, s) => a + s.s, 0);
}

const PATTERNS = [
  {
    id: 'box',
    name: 'Thở hộp',
    tag: '4 · 4 · 4 · 4',
    goal: 'Bình tĩnh & kiểm soát',
    desc: 'Hít 4 — giữ 4 — thở ra 4 — giữ trống 4. Bài của lực lượng đặc nhiệm, dùng khi cần bình tĩnh ngay lập tức.',
    icon: '▢',
    build() {
      return { steps: cycle([IN(4, 'Hít vào'), HOLD(4, 'Giữ hơi'), OUT(4, 'Thở ra'), EMPTY(4, 'Giữ trống')], 6) };
    },
  },
  {
    id: '478',
    name: 'Thở 4-7-8',
    tag: '4 · 7 · 8',
    goal: 'Thư giãn sâu',
    desc: 'Hít 4 — giữ 7 — thở ra 8. Nhịp thở dài giúp hạ nhịp tim, cắt cơn lo lắng, dễ vào giấc.',
    icon: '☾',
    build() {
      return { steps: cycle([IN(4, 'Hít vào'), HOLD(7, 'Giữ hơi'), OUT(8, 'Thở ra chậm')], 6) };
    },
  },
  {
    id: 'coherent',
    name: 'Thở cộng hưởng',
    tag: '5.5 · 5.5',
    goal: 'Vào guồng tập trung',
    desc: '~5.5 nhịp mỗi phút — nhịp tối ưu cho biến thiên nhịp tim (HRV). Đây là bài "khởi động" trước phiên deep work.',
    icon: '∿',
    build() {
      return { steps: cycle([IN(5.5, 'Hít vào'), OUT(5.5, 'Thở ra')], 12) };
    },
  },
  {
    id: 'sigh',
    name: 'Thở dài sinh lý',
    tag: '2 hít · 1 thở ra dài',
    goal: 'Xả stress tức thì',
    desc: 'Hít vào, hít thêm một hơi ngắn, rồi thở ra thật dài. Cách hạ căng thẳng nhanh nhất theo nghiên cứu Stanford.',
    icon: '⇉',
    build() {
      const steps = [];
      for (let i = 0; i < 8; i++) {
        steps.push(IN(2.5, 'Hít vào'));
        steps.push(IN(1, 'Hít thêm một hơi'));
        steps.push(OUT(6, 'Thở ra thật dài'));
      }
      return { steps };
    },
  },
  {
    id: 'energize',
    name: 'Thở năng lượng',
    tag: '2 · 1 · 2',
    goal: 'Tỉnh táo, chống buồn ngủ',
    desc: 'Nhịp nhanh, dứt khoát. Dùng cho phiên đầu giờ chiều khi não muốn sập nguồn.',
    icon: '⚡',
    build() {
      return { steps: cycle([IN(2, 'Hít vào mạnh'), HOLD(1, 'Giữ'), OUT(2, 'Thở ra dứt khoát')], 20) };
    },
  },
  {
    id: 'wimhof',
    name: 'Wimhof',
    tag: '30 nhịp · giữ hơi · hồi phục',
    goal: 'Sức mạnh & tỉnh táo',
    desc: '3 vòng: 30 nhịp thở mạnh, giữ hơi 30s, hít đầy giữ 15s. Cảnh báo: không làm khi đang lái xe, đang ở trong nước, hoặc có bệnh tim mạch.',
    icon: '✦',
    build() {
      const steps = [];
      for (let r = 1; r <= 3; r++) {
        for (let i = 1; i <= 30; i++) {
          steps.push(IN(2, `Vòng ${r} · nhịp mạnh ${i}/30`));
          steps.push(OUT(2, `Vòng ${r} · thở ra ${i}/30`));
        }
        steps.push(HOLD(30, `Vòng ${r} · giữ hơi, thả lỏng`));
        steps.push(IN(3, `Vòng ${r} · hít đầy`));
        steps.push(HOLD(15, `Vòng ${r} · giữ`));
        steps.push(OUT(4, `Vòng ${r} · thở ra chậm`));
      }
      return { steps };
    },
  },
];

function getPattern(id) {
  return PATTERNS.find((p) => p.id === id) || null;
}

function listPatterns() {
  return PATTERNS.map((p) => {
    const steps = p.build().steps;
    return { id: p.id, name: p.name, tag: p.tag, goal: p.goal, desc: p.desc, icon: p.icon, seconds: total(steps), steps: steps.length };
  });
}

module.exports = { PATTERNS, getPattern, listPatterns, total };
