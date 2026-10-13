#!/usr/bin/env python3
"""Kiểm tra hồi quy: kéo cửa sổ đồng hồ KHÔNG được làm nó phình to.

Vì sao cần bài kiểm tra này
---------------------------
Trên Windows ở màn hình có scale lệch (máy này 150%), toạ độ DIP và pixel vật lý
lệch nhau. Mỗi lần đặt lại vị trí cửa sổ, Windows làm tròn cả hình chữ nhật, nên
cửa sổ có thể rộng/cao thêm 1px; kéo một lúc là phình to. Đây là lớp lỗi "chỉ lộ
ra khi đo", không lộ ra khi đọc mã — nên cần một phép đo tự động.

Bài kiểm tra này cố tình KHÔNG dùng API của Electron: nó gửi sự kiện chuột thật
(SendInput) và đọc kích thước bằng Win32 GetWindowRect. Nhờ vậy nó đo đúng cái
người dùng nhìn thấy, và không thể "tự lừa mình" bằng cùng một nguồn dữ liệu.

Cách dùng
---------
    # app đang chạy (npm start). Chạy:
    python tools/check-drag-size.py                # đủ 4 kiểu kéo, ~30 lần
    python tools/check-drag-size.py --drags 10     # kéo ít cho nhanh
    python tools/check-drag-size.py --pattern fast # chỉ kéo giật
    python tools/check-drag-size.py --window orb   # kéo thử quả cà chua

Lưu ý: script di chuyển chuột thật. Trong lúc chạy, đừng cầm chuột.
Mã thoát 0 = đạt, 1 = cửa sổ đổi kích thước, 2 = không tìm thấy cửa sổ.
"""

import argparse
import ctypes
import sys
import time
from ctypes import wintypes as wt

user32 = ctypes.WinDLL('user32', use_last_error=True)
user32.GetWindowThreadProcessId.argtypes = [wt.HWND, ctypes.POINTER(wt.DWORD)]
user32.IsWindowVisible.argtypes = [wt.HWND]
user32.GetWindowRect.argtypes = [wt.HWND, ctypes.POINTER(wt.RECT)]
user32.GetClassNameW.argtypes = [wt.HWND, ctypes.c_wchar_p, ctypes.c_int]
user32.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]

ULONG_PTR = ctypes.c_ulonglong if ctypes.sizeof(ctypes.c_void_p) == 8 else ctypes.c_ulong


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [('dx', wt.LONG), ('dy', wt.LONG), ('mouseData', wt.DWORD),
                ('dwFlags', wt.DWORD), ('time', wt.DWORD), ('dwExtraInfo', ULONG_PTR)]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [('wVk', wt.WORD), ('wScan', wt.WORD), ('dwFlags', wt.DWORD),
                ('time', wt.DWORD), ('dwExtraInfo', ULONG_PTR)]


class _U(ctypes.Union):
    _fields_ = [('mi', MOUSEINPUT), ('ki', KEYBDINPUT)]


class INPUT(ctypes.Structure):
    _fields_ = [('type', wt.DWORD), ('u', _U)]


LEFTDOWN, LEFTUP, KEYUP = 0x0002, 0x0004, 0x0002
VK_CONTROL, VK_MENU, VK_P = 0x11, 0x12, 0x50
VK_X = 0x58

EnumProc = ctypes.WINFUNCTYPE(wt.BOOL, wt.HWND, wt.LPARAM)


# ---------------------------------------------------------------- Win32 helpers

def _send(inp):
    if user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT)) != 1:
        raise OSError(ctypes.get_last_error(), 'SendInput thất bại')


def mouse_down():
    _send(INPUT(type=0, u=_U(mi=MOUSEINPUT(0, 0, 0, LEFTDOWN, 0, 0))))


def mouse_up():
    _send(INPUT(type=0, u=_U(mi=MOUSEINPUT(0, 0, 0, LEFTUP, 0, 0))))


def _key(vk, up=False):
    _send(INPUT(type=1, u=_U(ki=KEYBDINPUT(vk, 0, KEYUP if up else 0, 0, 0))))


def hotkey(vk):
    """Ctrl+Alt+<vk> — dùng để bắt đầu / kết thúc phiên."""
    _key(VK_CONTROL); _key(VK_MENU); _key(vk)
    time.sleep(0.05)
    _key(vk, True); _key(VK_MENU, True); _key(VK_CONTROL, True)


def windows():
    out = []

    def cb(hwnd, _):
        pid = wt.DWORD(0)
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        cls = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, cls, 256)
        r = wt.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(r))
        out.append({'hwnd': hwnd, 'pid': pid.value, 'cls': cls.value,
                    'l': r.left, 't': r.top, 'w': r.right - r.left, 'h': r.bottom - r.top,
                    'visible': bool(user32.IsWindowVisible(hwnd))})
        return True

    user32.EnumWindows(EnumProc(cb), 0)
    return out


def screen_size():
    return user32.GetSystemMetrics(78), user32.GetSystemMetrics(79)


# ---------------------------------------------------------------- app windows

def app_pid():
    """Nhận ra tiến trình app qua cửa sổ quả cà chua (cửa sổ vuông ~180-200px)."""
    for w in windows():
        if w['cls'] == 'Chrome_WidgetWin_1' and 170 <= w['w'] <= 210 and abs(w['w'] - w['h']) <= 3:
            return w['pid']
    return None


def orb_window(pid):
    """Cửa sổ quả cà chua: cửa sổ vuông của app (luôn có, không cần phiên tập trung)."""
    for w in windows():
        if w['pid'] == pid and w['visible'] and w['cls'] == 'Chrome_WidgetWin_1' \
                and 170 <= w['w'] <= 210 and abs(w['w'] - w['h']) <= 3:
            return w
    return None


def timer_window(pid):
    """Cửa sổ đồng hồ: cửa sổ đang hiện của app, không vuông, thấp nhất trong các ứng viên.

    (Menu 372x580 và màn hình thở 440x600 đều cao hơn hẳn nên bị loại.)"""
    cands = [w for w in windows()
             if w['pid'] == pid and w['visible'] and w['cls'] == 'Chrome_WidgetWin_1'
             and 70 <= w['h'] <= 300 and 160 <= w['w'] <= 560 and abs(w['w'] - w['h']) > 3]
    if not cands:
        return None
    cands.sort(key=lambda w: w['h'])
    return cands[0]


def target_window(pid, kind):
    return orb_window(pid) if kind == 'orb' else timer_window(pid)


def size_of(w):
    return (w['w'], w['h'])


# ---------------------------------------------------------------- thao tác kéo

def drag(w, steps, step_px, sleep, sign=1, vertical=0.5):
    """Kéo cửa sổ bằng chuột thật: nhấn giữ ở giữa thân, di chuyển từng bước, nhả."""
    cx = w['l'] + w['w'] // 2
    cy = w['t'] + w['h'] // 2
    user32.SetCursorPos(cx, cy)
    time.sleep(0.10)
    mouse_down()
    time.sleep(0.05)
    for i in range(steps):
        dx = sign * step_px * (i + 1)
        dy = int(sign * step_px * (i + 1) * vertical)
        user32.SetCursorPos(cx + dx, cy + dy)
        time.sleep(sleep)
    time.sleep(0.04)
    mouse_up()
    time.sleep(0.30)


PATTERNS = {
    # tên      bước  px/bước  nghỉ    hướng
    'mix':   (45, 4, 0.014, 'alternate'),
    'fast':  (12, 14, 0.008, 'alternate'),   # giật mạnh, cửa sổ phải đuổi theo
    'slow':  (30, 2, 0.028, 'alternate'),
    'edge':  (100, 12, 0.010, 'outward'),    # kéo dài tới sát mép màn hình
}


def run(pid, name, drags, verbose, kind):
    steps, step_px, sleep, direction = PATTERNS[name]
    sw, sh = screen_size()
    first = target_window(pid, kind)
    if not first:
        print('  ! không thấy cửa sổ cần đo — bỏ qua kiểu kéo này')
        return None, 0

    base = size_of(first)
    print(f'  [{name}] bắt đầu {base[0]}x{base[1]}, {drags} lần kéo')
    bad = 0
    w = first
    for i in range(1, drags + 1):
        if direction == 'alternate':
            sign = 1 if i % 2 else -1
            drag(w, steps, step_px, sleep, sign=sign)
        else:
            # hướng ra xa tâm màn hình nhất để chạm mép -> kích hoạt snap/neo cạnh
            sign = 1 if w['l'] + w['w'] // 2 < sw // 2 else -1
            drag(w, steps, step_px, sleep, sign=sign, vertical=0.0)

        nxt = target_window(pid, kind)
        if not nxt:
            print(f'    lần {i}: cửa sổ biến mất!')
            return base, drags
        cur = size_of(nxt)
        if cur != base:
            bad += 1
            print(f'    lần {i}: PHÌNH {base[0]}x{base[1]} -> {cur[0]}x{cur[1]}')
        elif verbose:
            print(f'    lần {i}: {cur[0]}x{cur[1]} ok')
        w = nxt
    print(f'  [{name}] kết thúc {w["w"]}x{w["h"]} — {bad} lần đổi cỡ')
    return base, bad


def main():
    ap = argparse.ArgumentParser(description='Kiểm tra kéo cửa sổ không làm nó phình to.')
    ap.add_argument('--window', default='timer', choices=['timer', 'orb'],
                    help='cửa sổ đem ra kéo thử (mặc định timer)')
    ap.add_argument('--pattern', default='all', choices=['all'] + list(PATTERNS))
    ap.add_argument('--drags', type=int, default=8, help='số lần kéo cho mỗi kiểu (mặc định 8)')
    ap.add_argument('--verbose', action='store_true', help='in cả những lần đạt')
    args = ap.parse_args()

    pid = app_pid()
    if not pid:
        print('Không tìm thấy app. Hãy chạy `npm start` trước.')
        return 2

    if args.window == 'timer' and not timer_window(pid):
        print('Chưa có phiên tập trung -> bắt đầu phiên (Ctrl+Alt+P)')
        hotkey(VK_P)
        time.sleep(2.5)

    t = target_window(pid, args.window)
    if not t:
        print(f'Không mở được cửa sổ "{args.window}". Kiểm tra app rồi thử lại.')
        return 2

    # Một lần kéo "khởi động" trước khi lấy mốc: Windows có thể chỉnh cửa sổ 1px ở lần đặt
    # vị trí đầu tiên (cỡ DIP làm tròn lên cho khớp lưới pixel vật lý). Việc cần canh là
    # cửa sổ có phình DẦN qua nhiều lần kéo hay không, nên lấy mốc sau lần kéo đầu.
    print('Kéo khởi động để cửa sổ ổn định cỡ...')
    steps, step_px, sleep, _ = PATTERNS['mix']
    drag(t, steps, step_px, sleep, sign=1)
    t = target_window(pid, args.window)
    if not t:
        print('Cửa sổ biến mất sau lần kéo khởi động.')
        return 2

    print(f'Cửa sổ {args.window}: {t["w"]}x{t["h"]} tại ({t["l"]},{t["t"]})  |  màn hình '
          f'{screen_size()[0]}x{screen_size()[1]}')
    print('Đang kéo bằng chuột thật — đừng cầm chuột trong lúc này.')

    names = list(PATTERNS) if args.pattern == 'all' else [args.pattern]
    total_bad = 0
    for name in names:
        _, bad = run(pid, name, args.drags, args.verbose, args.window)
        total_bad += bad or 0

    print()
    if total_bad:
        print(f'KẾT QUẢ: HỎNG — cửa sổ đổi kích thước {total_bad} lần khi kéo.')
        return 1
    print('KẾT QUẢ: ĐẠT — kéo bao nhiêu lần cửa sổ vẫn giữ nguyên kích thước.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
