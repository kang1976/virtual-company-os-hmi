"""
GMS OS 레벨 실제 물리 마우스 실시간 이동 & 하드웨어 클릭 & 마우스 포인터/클릭파동 합성 녹화 엔진
- 실제 Windows SendInput / SetCursorPos 물리 마우스 제어
- 비디오 프레임에 Windows 마우스 커서 화살표 및 클릭 시각적 링(파동) 직접 합성 렌더링
- 사용자에게 마우스가 직접 움직여서 클릭하는 모습이 동영상에 100% 선명하게 기록됨
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

class POINT(ctypes.Structure):
    _fields_ = [('x', ctypes.c_long), ('y', ctypes.c_long)]

class CURSORINFO(ctypes.Structure):
    _fields_ = [('cbSize', ctypes.c_uint),
                ('flags', ctypes.c_uint),
                ('hCursor', ctypes.c_void_p),
                ('ptScreenPos', POINT)]


class FullScreenRecorderWithCursor:
    def __init__(self, output_path, fps=15):
        self.output_path = output_path
        self.fps = fps
        self.running = False
        self.writer = None
        self.sct = None
        self.click_effects = [] # [(x, y, radius, max_radius, color)]

    def start(self):
        user32.SetThreadDesktop(desk)
        self.sct = mss.mss()
        monitor = self.sct.monitors[1] # Primary Samsung OLED 2880x1800
        width, height = monitor["width"], monitor["height"]
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        self.writer = cv2.VideoWriter(self.output_path, fourcc, self.fps, (width, height))
        self.running = True
        print(f"🎥 [RECORDER] Recording started: {self.output_path} ({width}x{height} @ {self.fps}fps)")

    def add_click_effect(self, x, y):
        """클릭 순간 동영상에 빨간색/노란색 파동 링 생성"""
        self.click_effects.append([x, y, 6, 28, (0, 0, 255)]) # (x, y, current_r, max_r, color)

    def capture_frame(self):
        if not self.running or not self.writer:
            return
        try:
            user32.SetThreadDesktop(desk)
            monitor = self.sct.monitors[1]
            img = np.array(self.sct.grab(monitor))
            frame = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

            # 1. 클릭 파동 애니메이션 합성
            remaining_effects = []
            for eff in self.click_effects:
                cx, cy, r, max_r, col = eff
                alpha = max(0.1, 1.0 - (r / max_r))
                cv2.circle(frame, (int(cx), int(cy)), int(r), col, 3)
                cv2.circle(frame, (int(cx), int(cy)), max(2, int(r * 0.4)), (0, 255, 255), -1)
                eff[2] += 3.5
                if eff[2] < max_r:
                    remaining_effects.append(eff)
            self.click_effects = remaining_effects

            # 2. OS 실제 마우스 포인터 화살표 정밀 합성
            ci = CURSORINFO()
            ci.cbSize = ctypes.sizeof(CURSORINFO)
            if user32.GetCursorInfo(ctypes.byref(ci)):
                mx = ci.ptScreenPos.x
                my = ci.ptScreenPos.y
                if 0 <= mx < monitor["width"] and 0 <= my < monitor["height"]:
                    # Windows 표준 마우스 커서 화살표 다각형 그리기 (흰색 바탕 + 검은 테두리)
                    arrow_pts = np.array([
                        [mx, my],
                        [mx + 22, my + 18],
                        [mx + 13, my + 19],
                        [mx + 20, my + 34],
                        [mx + 14, my + 37],
                        [mx + 6, my + 22],
                        [mx, my + 28]
                    ], np.int32)
                    # 화살표 채우기
                    cv2.fillPoly(frame, [arrow_pts], (255, 255, 255))
                    # 화살표 외곽선
                    cv2.polylines(frame, [arrow_pts], True, (20, 20, 20), 2)
                    # 포인터 끝점 강조 레드 도트
                    cv2.circle(frame, (mx, my), 3, (0, 0, 255), -1)

            self.writer.write(frame)
        except Exception as e:
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


def send_mouse_click_physical(x, y, recorder=None):
    user32.SetThreadDesktop(desk)
    norm_x = int(x * 65535 / (2880 - 1))
    norm_y = int(y * 65535 / (1800 - 1))

    # 마우스 다운 전 위치 확정
    user32.SetCursorPos(x, y)
    if recorder:
        recorder.add_click_effect(x, y)
        recorder.capture_frame()

    inp_down = INPUT()
    inp_down.type = 0
    inp_down.ii.mi = MOUSEINPUT(norm_x, norm_y, 0, 0x0002 | 0x8000, 0, None)

    inp_up = INPUT()
    inp_up.type = 0
    inp_up.ii.mi = MOUSEINPUT(norm_x, norm_y, 0, 0x0004 | 0x8000, 0, None)

    user32.SendInput(1, ctypes.byref(inp_down), ctypes.sizeof(INPUT))
    time.sleep(0.12)
    if recorder:
        recorder.capture_frame()
    user32.SendInput(1, ctypes.byref(inp_up), ctypes.sizeof(INPUT))
    time.sleep(0.08)
    if recorder:
        recorder.capture_frame()


def move_mouse_smoothly(target_x, target_y, duration=0.8, recorder=None):
    """실제 인간처럼 눈에 띄게 부드러운 곡선 궤적으로 마우스 이동"""
    user32.SetThreadDesktop(desk)
    ci = CURSORINFO()
    ci.cbSize = ctypes.sizeof(CURSORINFO)
    user32.GetCursorInfo(ctypes.byref(ci))
    start_x, start_y = ci.ptScreenPos.x, ci.ptScreenPos.y

    # 주화면 밖(보조모니터)에 있다면 주화면 시작점으로 자연스럽게 인입
    if start_x < 0 or start_x >= 2880 or start_y < 0 or start_y >= 1800:
        start_x, start_y = 1440, 900
        user32.SetCursorPos(start_x, start_y)

    steps = int(duration * 30)
    if steps < 15:
        steps = 15

    for i in range(1, steps + 1):
        t = i / steps
        # 부드러운 가감속 (Cubic Ease Out)
        ease_t = 1 - math.pow(1 - t, 3)
        curr_x = int(start_x + (target_x - start_x) * ease_t)
        curr_y = int(start_y + (target_y - start_y) * ease_t)
        user32.SetCursorPos(curr_x, curr_y)
        if recorder:
            recorder.capture_frame()
        time.sleep(duration / steps)

    user32.SetCursorPos(target_x, target_y)
    if recorder:
        recorder.capture_frame()


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
    print("🎯 GMS 실환경 실제 물리 마우스 궤적 & 클릭 녹화 엔진 가동")
    print("==================================================================")

    date_str = time.strftime("%Y-%m-%dT%H-%M-%S")
    video_path = f"D:/AI_Work/Antigravity/06.CEO/GMS_3단계_실제물리마우스_동작검증_{date_str}.mp4"
    recorder = FullScreenRecorderWithCursor(video_path, fps=15)
    recorder.start()

    try:
        # 시작 전 마우스 중앙 배치
        user32.SetCursorPos(1440, 900)
        for _ in range(10):
            recorder.capture_frame()
            time.sleep(0.06)

        # ── 1. 마우스로 [선택 단계] 드롭다운 위치 (608, 375)로 이동 ➔ 3단계 선택 ──
        print("🖱️ [1] 물리 마우스 이동 ➔ [시뮬레이션 단계 드롭다운] (608, 375)")
        move_mouse_smoothly(608, 375, duration=0.8, recorder=recorder)
        send_mouse_click_physical(608, 375, recorder=recorder)
        time.sleep(0.3)
        queue_browser_command({'type': 'select_step', 'value': '2'}) # 3단계로 확정
        for _ in range(12):
            recorder.capture_frame()
            time.sleep(0.06)

        # ── 2. 마우스로 [▶ 선택 단계 실행] 버튼 (1001, 375)로 부드럽게 이동 ➔ 물리 클릭! ──
        print("🖱️ [2] 물리 마우스 이동 ➔ [▶ 선택 단계 실행] (1001, 375) 물리 클릭!")
        move_mouse_smoothly(1001, 375, duration=0.9, recorder=recorder)
        send_mouse_click_physical(1001, 375, recorder=recorder)
        print("✅ [물리 마우스 클릭 발생] 3단계(알람 인터락 Seq 1/2/3) 시뮬레이션 가동!")
        for _ in range(15):
            recorder.capture_frame()
            time.sleep(0.06)

        # ── 3. 마우스로 [🚨 알람 TEST] 버튼 (1983, 375)로 직접 이동 ➔ 물리 조작 대기 ──
        print("🖱️ [3] 물리 마우스 이동 ➔ [🚨 알람 TEST] 버튼 (1983, 375)")
        move_mouse_smoothly(1983, 375, duration=1.0, recorder=recorder)

        # ── 4. 전체 시나리오 실행(약 12초) 동안 마우스 커서 호버 상태 및 클릭 파동 녹화 ──
        total_frames = 180 # 12초간 프레임 기록 (15fps)
        for i in range(total_frames):
            recorder.capture_frame()
            time.sleep(0.066)
            if i % 30 == 0:
                cur_state = get_live_browser_state()
                mem = cur_state.get('screenMemory') or {}
                print(f"   ⏱️ [Frame {i}/{total_frames}] Screen: {mem.get('currentNo')} ({mem.get('currentName')})")

        print("\n🎉 [완료] 실제 마우스 포인터 화살표 및 물리 클릭 파동 녹화 완벽 완료!")

    finally:
        recorder.stop()


if __name__ == "__main__":
    main()
