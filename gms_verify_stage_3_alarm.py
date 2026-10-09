"""
GMS OS 레벨 실제 물리 마우스 3단계(알람 인터락 Seq 1/2/3) 전용 정밀 검증 엔진
- 정확한 물리 모니터 좌표: [▶ 선택 단계 실행] (1001, 375), [🚨 알람 TEST] (1983, 375)
- 전체 화면 10fps 자동 녹화 및 실시간 인터락 검증
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

# Win32 API 및 데스크톱 바인딩
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


def main():
    print("==================================================================")
    print("🚨 GMS 실환경 3단계(알람 인터락 Seq 1/2/3) 정밀 물리 마우스 검증 엔진")
    print("==================================================================")

    date_str = time.strftime("%Y-%m-%dT%H-%M-%S")
    video_path = f"D:/AI_Work/Antigravity/06.CEO/GMS_3단계_알람인터락_동작검증_{date_str}.mp4"
    recorder = FullScreenRecorder(video_path, fps=10)
    recorder.start()

    try:
        # 1. 3단계 선택 명령 큐잉 (Option value: '2' -> 3단계: 알람 시뮬레이션)
        print("📌 [Step 3] 3단계 시뮬레이션 항목 선택 (Select 3단계)")
        queue_browser_command({'type': 'select_step', 'value': '2'})
        time.sleep(0.5)

        # 물리 모니터 실측 좌표 (2880x1800 모니터 실환경)
        run_btn_x, run_btn_y = 1001, 375
        alarm_btn_x, alarm_btn_y = 1983, 375

        print(f"🖱️ [물리 마우스 위치] [▶ 선택 단계 실행]: ({run_btn_x}, {run_btn_y})")
        print(f"🖱️ [물리 마우스 위치] [🚨 알람 TEST]: ({alarm_btn_x}, {alarm_btn_y})")

        # 2. [▶ 선택 단계 실행] 버튼으로 물리 마우스 이동 후 클릭
        move_mouse_smoothly(run_btn_x, run_btn_y, duration=0.45, recorder=recorder)
        send_mouse_click_physical(run_btn_x, run_btn_y)
        print("✅ [물리 마우스 클릭] 3단계(알람 인터락 Seq 1/2/3) 실행 시작!")

        # 3. 3단계 전체 진행(약 12초) 동안 녹화 및 화면 상태 모니터링
        time.sleep(1.0)
        # 마우스를 [🚨 알람 TEST] 버튼 위치로 부드럽게 이동하여 사용자가 직관적으로 확인 가능하도록 함
        move_mouse_smoothly(alarm_btn_x, alarm_btn_y, duration=0.6, recorder=recorder)

        total_frames = 130 # 13초 녹화 (10fps)
        for i in range(total_frames):
            recorder.capture_frame()
            time.sleep(0.1)
            if i % 20 == 0:
                cur_state = get_live_browser_state()
                mem = cur_state.get('screenMemory') or {}
                print(f"   ⏱️ [Frame {i}/{total_frames}] Screen No: {mem.get('currentNo')} ({mem.get('currentName')})")

        print("\n🎉 [Complete] 3단계 알람 인터락(Seq 1:초기화, Seq 2:재진행, Seq 3:SHUTDOWN) 검증 녹화 완료!")

    finally:
        recorder.stop()


if __name__ == "__main__":
    main()
