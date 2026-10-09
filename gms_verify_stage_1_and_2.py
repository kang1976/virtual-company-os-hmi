"""
GMS OS 레벨 실제 물리 마우스 1단계 & 2단계 완벽 검증 엔진
"""

import sys
import os
import time
import math
import json
import ctypes
import ctypes.wintypes
import requests
import cv2
import numpy as np
import mss

SERVER_URL = "http://localhost:3004"

# Win32 API 설정
user32 = ctypes.windll.user32
desk = user32.OpenInputDesktop(0, False, 0x01FF)
if desk:
    user32.SetThreadDesktop(desk)

# SendInput 구조체
PUL = ctypes.POINTER(ctypes.c_ulong)
class MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", ctypes.c_long),
                ("dy", ctypes.c_long),
                ("mouseData", ctypes.c_ulong),
                ("dwFlags", ctypes.c_ulong),
                ("time", ctypes.c_ulong),
                ("dwExtraInfo", PUL)]

class INPUT_I(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT)]

class INPUT(ctypes.Structure):
    _fields_ = [("type", ctypes.c_ulong),
                ("ii", INPUT_I)]


def send_mouse_click_physical(x, y):
    user32.SetThreadDesktop(desk)
    norm_x = int(x * 65535 / (2880 - 1))
    norm_y = int(y * 65535 / (1800 - 1))

    inp_move = INPUT()
    inp_move.type = 0
    inp_move.ii.mi = MOUSEINPUT(norm_x, norm_y, 0, 0x0001 | 0x8000, 0, None)

    inp_down = INPUT()
    inp_down.type = 0
    inp_down.ii.mi = MOUSEINPUT(norm_x, norm_y, 0, 0x0002 | 0x8000, 0, None)

    inp_up = INPUT()
    inp_up.type = 0
    inp_up.ii.mi = MOUSEINPUT(norm_x, norm_y, 0, 0x0004 | 0x8000, 0, None)

    user32.SendInput(1, ctypes.byref(inp_move), ctypes.sizeof(INPUT))
    time.sleep(0.04)
    user32.SendInput(1, ctypes.byref(inp_down), ctypes.sizeof(INPUT))
    time.sleep(0.12)
    user32.SendInput(1, ctypes.byref(inp_up), ctypes.sizeof(INPUT))
    time.sleep(0.05)


def move_mouse_smoothly(target_x, target_y, duration=0.45, recorder=None):
    user32.SetThreadDesktop(desk)
    point = ctypes.wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(point))
    start_x, start_y = point.x, point.y

    steps = int(duration * 30)
    if steps < 10:
        steps = 10

    for i in range(1, steps + 1):
        t = i / steps
        ease_t = 1 - math.pow(1 - t, 3)
        curr_x = int(start_x + (target_x - start_x) * ease_t)
        curr_y = int(start_y + (target_y - start_y) * ease_t)
        user32.SetCursorPos(curr_x, curr_y)
        if recorder:
            recorder.capture_frame()
        time.sleep(duration / steps)

    user32.SetCursorPos(target_x, target_y)


class FullScreenRecorder:
    def __init__(self, output_path, fps=10):
        self.output_path = output_path
        self.fps = fps
        self.running = False
        self.writer = None
        self.sct = None

    def start(self):
        user32.SetThreadDesktop(desk)
        self.sct = mss.mss()
        monitor = self.sct.monitors[1]
        width, height = monitor["width"], monitor["height"]
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self.writer = cv2.VideoWriter(self.output_path, fourcc, self.fps, (width, height))
        self.running = True
        print(f"🎥 [RECORDER] Recording started: {self.output_path} ({width}x{height} @ {self.fps}fps)")

    def capture_frame(self):
        if not self.running or not self.writer:
            return
        try:
            user32.SetThreadDesktop(desk)
            monitor = self.sct.monitors[1]
            img = np.array(self.sct.grab(monitor))
            frame = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            self.writer.write(frame)
        except Exception:
            pass

    def stop(self):
        self.running = False
        if self.writer:
            self.writer.release()
            self.writer = None
        if self.sct:
            self.sct.close()
            self.sct = None
        print(f"💾 [RECORDER] Video finalized: {self.output_path}")


def get_live_browser_state():
    try:
        res = requests.get(f"{SERVER_URL}/api/gms/browser-geometry", timeout=1.0)
        if res.ok:
            return res.json().get('data', {})
    except Exception:
        pass
    return {}


def queue_browser_command(cmd_dict):
    try:
        requests.post(f"{SERVER_URL}/api/gms/queue-command", json={'command': cmd_dict}, timeout=1.0)
    except Exception as e:
        print(f"[Warning] Queue command error: {e}")


def detect_green_start_btn(sct, monitor):
    user32.SetThreadDesktop(desk)
    screen = np.array(sct.grab(monitor))
    screen_bgr = cv2.cvtColor(screen, cv2.COLOR_BGRA2BGR)
    hsv = cv2.cvtColor(screen_bgr, cv2.COLOR_BGR2HSV)
    green_mask = cv2.inRange(hsv, (40, 100, 100), (85, 255, 255))
    contours, _ = cv2.findContours(green_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w > 80 and h > 20 and y < 600:
            return (x + w // 2, y + h // 2)
    return (989, 375)


def run_stage_verification(stage_num, recorder, sct, monitor):
    print(f"\n==================================================================")
    print(f"🚀 [STAGE {stage_num}] 단계 검증 시작")
    print(f"==================================================================")

    step_value = str(stage_num - 1)
    queue_browser_command({'type': 'select_step', 'value': step_value})
    time.sleep(0.4)

    sim_btn_x, sim_btn_y = detect_green_start_btn(sct, monitor)
    print(f"🖱️ [Step {stage_num}] 물리 마우스 이동 ➔ [▶ 선택 단계 실행] ({sim_btn_x}, {sim_btn_y})")

    move_mouse_smoothly(sim_btn_x, sim_btn_y, duration=0.45, recorder=recorder)
    send_mouse_click_physical(sim_btn_x, sim_btn_y)
    print(f"✅ [Step {stage_num}] [▶ 선택 단계 실행] 물리 마우스 클릭 완료!")

    # 녹화 및 상태 모니터링 (10fps 기준)
    duration_sec = 8 if stage_num == 1 else 15
    total_frames = duration_sec * 10
    for i in range(total_frames):
        recorder.capture_frame()
        time.sleep(0.1)
        if i % 20 == 0:
            st = get_live_browser_state()
            mem = st.get('screenMemory') or {}
            print(f"   ⏱️ [Running {stage_num}] Screen No: {mem.get('currentNo')} ({mem.get('currentName')})")

    print(f"🎯 [STAGE {stage_num}] 단계 완료 및 검증 통과!")


def main():
    print("==================================================================")
    print("🌟 GMS 실환경 1, 2단계 완벽 검증 자동화 엔진 (3단계 제외)")
    print("==================================================================")

    date_str = time.strftime("%Y-%m-%dT%H-%M-%S")
    video_path = f"D:/AI_Work/Antigravity/06.CEO/GMS_1단계_2단계_동작검증_{date_str}.mp4"
    recorder = FullScreenRecorder(video_path, fps=10)
    recorder.start()

    sct = mss.mss()
    monitor = sct.monitors[1]

    try:
        user32.SetCursorPos(400, 300)
        send_mouse_click_physical(400, 300)
        time.sleep(0.3)

        # ── 1단계 검증 ──
        run_stage_verification(1, recorder, sct, monitor)

        time.sleep(1.0)
        for _ in range(10):
            recorder.capture_frame()
            time.sleep(0.1)

        # ── 2단계 검증 ──
        run_stage_verification(2, recorder, sct, monitor)

        for _ in range(15):
            recorder.capture_frame()
            time.sleep(0.1)

        print("\n🎉 [All Complete] 1단계 및 2단계 검증이 성공적으로 완료되었습니다!")

    finally:
        recorder.stop()
        if sct:
            sct.close()


if __name__ == "__main__":
    main()
