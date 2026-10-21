'use strict';

/* Các bài hướng dẫn hít thở. Mỗi bước: { k: loại pha, s: số giây, l: nhãn }
   k = in (hít vào) | hold (nín thở) | out (thở ra) | holdout (nín thở) */

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
    desc: 'Hít 4 — nín 4 — thở ra 4 — nín 4. Bài của lực lượng đặc nhiệm, dùng khi cần bình tĩnh ngay lập tức.',
    icon: '▢',
    build() {
      return { steps: cycle([IN(4, 'Hít vào'), HOLD(4, 'Nín thở'), OUT(4, 'Thở ra'), EMPTY(4, 'Nín thở')], 6) };
    },
  },
  {
    id: '478',
    name: 'Thở 4-7-8',
    tag: '4 · 7 · 8',
    goal: 'Thư giãn sâu',
    desc: 'Hít 4 — nín 7 — thở ra 8. Nhịp thở dài giúp hạ nhịp tim, cắt cơn lo lắng, dễ vào giấc.',
    icon: '☾',
    build() {
      return { steps: cycle([IN(4, 'Hít vào'), HOLD(7, 'Nín thở'), OUT(8, 'Thở ra chậm')], 6) };
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
      return { steps: cycle([IN(2, 'Hít vào mạnh'), HOLD(1, 'Nín thở'), OUT(2, 'Thở ra dứt khoát')], 20) };
    },
  },
  {
    id: 'wimhof',
    name: 'Wimhof',
    tag: '11 phút · có giọng hướng dẫn',
    goal: 'Sức mạnh & tỉnh táo',
    desc: 'Bài thở Wim Hof có giọng hướng dẫn: 3 vòng, mỗi vòng 30 nhịp thở mạnh; nín thở 30 → 60 → 90 giây, hít đầy và nín 15 giây. Cảnh báo: không làm khi đang lái xe, ở trong nước hoặc có bệnh tim mạch.',
    icon: '✦',
    build() {
      /* Mỗi cặp số là mốc bắt đầu hít vào / thở ra của từng nhịp, lấy từ chính
         bản audio hướng dẫn. Nhờ vậy hình phồng–xẹp khớp với giọng đọc. */
      const rounds = [
        [20.6, 22.4, 24.3, 26.1, 28.0, 29.8, 31.6, 33.4, 35.3, 37.1, 39.0, 40.8,
          42.6, 44.4, 46.3, 48.1, 50.0, 51.8, 53.6, 55.4, 57.3, 59.1, 61.0, 62.8,
          64.6, 66.4, 68.3, 70.1, 72.0, 73.8, 75.6, 77.4, 79.3, 81.1, 83.0, 84.8,
          86.6, 88.4, 90.3, 92.1, 94.0, 95.7, 97.6, 99.4, 101.3, 103.1, 105.0, 106.8,
          108.6, 110.4, 112.3, 114.1, 116.0, 117.7, 119.6, 121.4, 123.3, 125.1, 127.1, 130.0],
        [186.2, 188.5, 190.4, 192.2, 194.0, 195.8, 197.7, 199.5, 201.4, 203.2, 205.0, 206.8,
          208.7, 210.5, 212.4, 214.2, 216.0, 217.8, 219.7, 221.5, 223.4, 225.2, 227.0, 228.8,
          230.7, 232.5, 234.4, 236.2, 238.0, 239.8, 241.7, 243.5, 245.4, 247.2, 249.0, 250.8,
          252.7, 254.5, 256.4, 258.2, 260.0, 261.8, 263.7, 265.5, 267.4, 269.2, 271.0, 272.8,
          274.7, 276.5, 278.4, 280.2, 282.0, 283.8, 285.7, 287.5, 289.4, 291.2, 293.2, 296.3],
        [386.4, 388.2, 390.1, 391.9, 393.7, 395.5, 397.4, 399.2, 401.1, 402.9, 404.7, 406.5,
          408.4, 410.2, 412.1, 413.9, 415.7, 417.5, 419.4, 421.2, 423.1, 424.9, 426.7, 428.5,
          430.4, 432.2, 434.1, 435.9, 437.7, 439.5, 441.4, 443.2, 445.1, 446.9, 448.7, 450.5,
          452.4, 454.2, 456.1, 457.9, 459.7, 461.5, 463.4, 465.2, 467.1, 468.9, 470.7, 472.5,
          474.4, 476.2, 478.1, 479.9, 481.7, 483.5, 485.4, 487.2, 489.1, 490.9, 492.9, 495.8],
      ];
      const holdStart = [132.4, 298.5, 498.2];
      const steps = [];
      let at = 0;
      const push = (k, s, l) => {
        s = Math.round(s * 100) / 100;
        steps.push({ k, s, l, at: Math.round(at * 100) / 100 });
        at = Math.round((at + s) * 100) / 100;
      };

      push('holdout', 20.6, 'Giới thiệu · Vòng 1');
      for (let r = 0; r < 3; r++) {
        const t = rounds[r];
        for (let i = 0; i < t.length; i += 2) {
          const next = i + 2 < t.length ? t[i + 2] : holdStart[r];
          push('in', t[i + 1] - t[i], `Vòng ${r + 1} · nhịp ${i / 2 + 1}/30`);
          push('out', next - t[i + 1], `Vòng ${r + 1} · thở ra ${i / 2 + 1}/30`);
        }
        if (r === 0) {
          push('holdout', 30, 'Vòng 1 · nín thở 30 giây');
          push('in', 1.86, 'Vòng 1 · hít đầy');
          push('hold', 15.77, 'Vòng 1 · nín 15 giây');
          push('out', 6.17, 'Vòng 1 · thở ra chậm');
        } else if (r === 1) {
          push('holdout', 2.61, 'Vòng 2 · dừng lại');
          push('holdout', 60, 'Vòng 2 · nín thở 60 giây');
          push('in', 1.44, 'Vòng 2 · hít đầy');
          push('hold', 14.71, 'Vòng 2 · nín 15 giây');
          push('out', 9.14, 'Vòng 2 · thở ra chậm');
        } else {
          push('holdout', 90, 'Vòng 3 · nín thở 90 giây');
          push('holdout', 1.7, 'Sẵn sàng hít vào');
          push('in', 1.84, 'Vòng 3 · hít đầy');
          push('hold', 14.35, 'Vòng 3 · nín 15 giây');
          push('out', 2.31, 'Vòng 3 · thở ra chậm');
          push('holdout', 51.6, 'Thả lỏng · kết thúc');
        }
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
