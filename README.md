# 🍅 Cà Chua Tập Trung

Ứng dụng desktop hỗ trợ **làm việc sâu**: một quả cà chua nổi trên màn hình, hít thở vài nhịp cho tĩnh, rồi đếm ngược phiên làm việc — con số luôn nằm trên mọi cửa sổ khác, kể cả khi bạn đang mở trình duyệt hay DSH.

Không cần cài đặt gì thêm, không cần tài khoản, không có máy chủ nào cả. Toàn bộ dữ liệu nằm trên máy bạn.

---

## Chạy ứng dụng

```
npm start
```

Hoặc nháy đúp **`Chay-Ca-Chua.cmd`**, hoặc dùng shortcut **Cà Chua Tập Trung** trên Desktop / menu Start (nếu đã tạo).

Sau khi chạy, quả cà chua sẽ nổi ở góc dưới bên phải màn hình. Kéo nó đi chỗ khác được, vị trí được nhớ cho lần sau.

> Lần đầu chạy cần `npm install` một lần để tải Electron.

---

## Dùng thế nào

**Bấm** quả cà chua → menu hiện ra với hai lối vào:

1. **Hít thở tập trung** — chọn một trong 6 bài thở. Vòng tròn lớn dần khi hít vào, nhỏ lại khi thở ra, có tiếng dẫn nhịp để nhắm mắt vẫn theo được. Xong bài sẽ có nút mời bạn vào phiên luôn.
2. **Bắt đầu phiên làm việc** — ghi *mục tiêu của phiên* (một câu thôi), chọn độ dài (15/25/50/90 phút), rồi bắt đầu.

Các thao tác nhanh trên cà chua:

| Thao tác | Kết quả |
| --- | --- |
| Bấm đúng quả cà chua | Mở menu |
| Nháy đúp quả cà chua | Vào phiên tập trung ngay (nhớ lại mục tiêu lần trước) |

Vùng trong suốt quanh quả cà chua **xuyên chuột**: chỉ khi trỏ đúng vào quả thì cửa sổ mới nhận chuột, còn lại bạn bấm thẳng được vào ứng dụng bên dưới.

Bảng đếm ngược giờ chỉ có **con số** (cỡ tuỳ chỉnh trong Cài đặt ▸ Giao diện). Bấm vào con số để tạm dừng, kéo để đổi chỗ, nút ✕ hiện ra khi rê chuột vào để kết thúc phiên. Các nút **tạm dừng / +5 phút / bỏ qua** đã chuyển về Cài đặt ▸ Giao diện.

Khi lỡ phải dừng giữa phiên, cửa sổ đồng hồ sẽ hỏi **lý do**. Cứ chọn thật — vài ngày sau tab Thống kê sẽ chỉ ra thứ đang cắt ngang bạn nhiều nhất.

---

## Phím tắt toàn cục

Dùng được từ bất kỳ ứng dụng nào:

| Phím | Việc |
| --- | --- |
| `Ctrl` `Alt` `P` | Bắt đầu / tạm dừng phiên tập trung |
| `Ctrl` `Alt` `B` | Vào bài hít thở gần nhất |
| `Ctrl` `Alt` `X` | Kết thúc phiên đang chạy |
| `Ctrl` `Alt` `M` | Mở menu cà chua |
| `Ctrl` `Alt` `H` | Ẩn/hiện quả cà chua |

Ngoài ra còn **khay hệ thống** (góc phải taskbar): trạng thái hiện tại, bắt đầu/dừng, chọn bài thở, chọn âm thanh nền, mở Thống kê & Cài đặt.

---

## Sáu bài hít thở

| Bài | Nhịp | Dùng khi |
| --- | --- | --- |
| **Thở hộp** | 4 · 4 · 4 · 4 | Bình tĩnh & kiểm soát — cân bằng nhất, hợp để bắt đầu phiên |
| **4-7-8** | 4 · 7 · 8 | Dễ ngủ, hạ nhịp tim — hợp khi căng thẳng hoặc cuối ngày |
| **Thở mạch** | 5.5 · 5.5 | Nhịp ~5.5 giây, cộng hưởng với nhịp tim — ổn định cảm xúc |
| **Thở dài sinh lý** | 2 nhịp hít + thở ra dài | Giảm căng nhanh nhất, chỉ ~76 giây |
| **Nạp năng lượng** | 2 · 1 · 2 | Tỉnh táo trước việc nặng |
| **Wim Hof** | 30 nhịp + nín thở | Đẩy năng lượng mạnh — **không làm khi đang lái xe hoặc ở trong nước** |

Mỗi bài đều có tiếng dẫn: âm cao dần khi hít vào, trầm dần khi thở ra.

---

## Âm thanh nền

Tất cả được **sinh trực tiếp bằng Web Audio** — không có file nhạc nào trong ứng dụng:

tiếng nâu · mưa · sóng biển · quán cà phê · lửa · chuông 432 Hz · **binaural beats** (cần tai nghe; 10 Hz cho dải alpha hợp với đọc viết, 14–18 Hz khi cần tỉnh).

---

## Những thứ khác đã có trong máy

- **Chuỗi ngày (streak)** hiện ngay trên quả cà chua — đừng để đứt.
- **Nhắc 20-20-20**: vào giờ nghỉ, nhắc nhìn ra xa 6 mét trong 20 giây.
- **Nhắc uống nước** trong giờ nghỉ dài.
- **Tự chuyển nhịp**: hết phiên tự vào giờ nghỉ, nghỉ dài sau mỗi N phiên.
- **Thống kê**: biểu đồ 7 ngày, tổng thời gian, chuỗi ngày, lý do bỏ phiên, và phần *insight* nói thẳng thói quen của bạn.
- **Mục tiêu mỗi ngày** (mặc định 8 phiên) — cà chua hiện tiến độ `2/8`.

---

## Cài đặt

Bấm đúp vào cà chua rồi chọn Thống kê & Cài đặt, hoặc từ khay hệ thống. Có 6 tab: **Phòng làm việc · Hít thở · Âm thanh · Giao diện · Thống kê · Phím tắt & mẹo**.

Nếu lỡ kéo cửa sổ ra ngoài màn hình, tab *Giao diện* có nút **đưa cà chua & đồng hồ về vị trí mặc định**.

---

## Dữ liệu

Lưu tại `%APPDATA%\Cà Chua Tập Trung\deepwork.json` (một file JSON duy nhất, mở ra đọc được). Trong đó có lịch sử phiên, lý do bỏ phiên, mục tiêu từng phiên và vị trí các cửa sổ. Nút *Xoá toàn bộ lịch sử* nằm ở tab Thống kê.

---

## Cấu trúc mã nguồn

```
main.js              tiến trình chính: 6 cửa sổ, engine đếm giờ, tray, phím tắt, IPC
preload.js           cầu nối an toàn (contextBridge) → window.tomato
patterns.js          6 bài thở, mỗi bài là danh sách bước {loại, giây, nhãn}
store.js             lưu/đọc deepwork.json + thống kê, chuỗi ngày, lý do bỏ phiên
tools/make-icons.js  tự vẽ và tự mã hoá PNG/ICO, không dùng thư viện ngoài
renderer/
  orb/       quả cà chua nổi + vòng tiến độ (chỉ quả nhận chuột)
  timer/     con số đếm ngược + panel lý do dừng sớm
  breathe/   màn hình hít thở
  menu/      menu 3 view khi bấm cà chua
  settings/  cửa sổ cài đặt 6 tab
  shared/    style, tiện ích, và toàn bộ âm thanh (Web Audio)
```

Sinh lại icon: `npm run icons`.

---

## Ghi chú kỹ thuật

- Cửa sổ dùng `alwaysOnTop` mức `screen-saver` để nổi trên cả ứng dụng toàn màn hình.
- Đồng hồ đếm bằng `setInterval` 100 ms nhưng luôn tính lại từ `Date.now()`, nên không bị trôi khi máy bận.
- Cà chua, đồng hồ và màn hình thở đều là cửa sổ trong suốt, không viền, kéo thả tự do và tự neo vào cạnh màn hình.
