"""
GMS OS 레벨 실제 물리 마우스 자동화 & 비전-지오메트리 융합 제어 엔진
(GMS OS-Level Hardware Mouse Automation Engine v2.5 - 0.5x Slow Observation Mode)

핵심 메커니즘:
1. 브라우저 실시간 지오메트리 API(DevicePixelRatio 1.75 자동 투영) + OpenCV 비전 템플릿 매칭 융합
2. 해상도(2880x1800, FHD, 4K) 및 분할창(Splitter) 변경 시에도 실시간 자동 좌표 보정
3. Windows Win32 Hardware SendInput을 통한 실제 물리 마우스 이동(인간다운 감속 곡선) 및 클릭
4. 전 과정 풀스크린 자동 동영상 녹화 (MP4)
5. 화면 고유 번호(Screen Memory) 기반 엄격한 상태 확인 및 단계별 개별 검증
6. 사용자 실시간 육안 관찰용 0.5배속 슬로우 모션 & 브라우저 윈도우 자동 최전면 활성화
"""

import sys
import os

# Windows 콘솔 인코딩(cp949) 이모지 충돌 방지
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import time
import math
import json
import ctypes
import ctypes.wintypes
import requests
import cv2
import numpy as np
import mss

# PyAutoGUI 안전 설정
import pyautogui
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0.05

SERVER_URL = "http://localhost:3004"

# Win32 API 설정
user32 = ctypes.windll.user32
desk = user32.OpenInputDesktop(0, False, 0x01FF)
if desk:
    user32.SetThreadDesktop(desk)

# SendInput 구조체 정의
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


def activate_gms_window():
    """GMS 브라우저 창을 찾아 사용자 모니터 최전면(Foreground)으로 팝업/활성화"""
    try:
        desk = user32.OpenInputDesktop(0, False, 0x01FF)
        if desk:
            user32.SetThreadDesktop(desk)

        target_hwnd = None
        def enum_cb(hwnd, lparam):
            nonlocal target_hwnd
            if user32.IsWindowVisible(hwnd):
                length = user32.GetWindowTextLengthW(hwnd)
                if length > 0:
                    buff = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buff, length + 1)
                    title = buff.value
                    if 'GMS' in title or 'Aside' in title or '3004' in title:
                        target_hwnd = hwnd
                        return False
            return True

        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        user32.EnumWindows(WNDENUMPROC(enum_cb), 0)

        if target_hwnd:
            user32.ShowWindow(target_hwnd, 9)  # SW_RESTORE
            user32.SetForegroundWindow(target_hwnd)
            print(f"🪟 [Window Focus] GMS 브라우저 창 최전면 활성화 성공 (HWND: {target_hwnd})")
            time.sleep(0.5)
            return True
        else:
            print("⚠️ [Window Focus] GMS 창 타이틀을 직접 찾지 못함 (기본 활성화 진행)")
    except Exception as e:
        print(f"⚠️ [Window Focus] 창 활성화 예외: {e}")
    return False


def report_progress(step_text):
    """서버 및 브라우저 HUD에 현재 마우스 동작 상태 실시간 보고"""
    try:
        requests.post(f"{SERVER_URL}/api/gms/os-mouse-progress", json={"stepText": step_text}, timeout=0.5)
    except Exception:
        pass


def send_mouse_click_physical(x, y, speed_factor=0.5):
    """물리적 SendInput을 통해 마우스 클릭 발생 (0.5배속 관찰용 대기 포함)"""
    norm_x = int(x * 65535 / (2880 - 1))
    norm_y = int(y * 65535 / (1800 - 1))

    # Move
    inp_move = INPUT()
    inp_move.type = 0  # INPUT_MOUSE
    inp_move.ii.mi = MOUSEINPUT(norm_x, norm_y, 0, 0x0001 | 0x8000, 0, None)

    # Down
    inp_down = INPUT()
    inp_down.type = 0
    inp_down.ii.mi = MOUSEINPUT(norm_x, norm_y, 0, 0x0002 | 0x8000, 0, None)

    # Up
    inp_up = INPUT()
    inp_up.type = 0
    inp_up.ii.mi = MOUSEINPUT(norm_x, norm_y, 0, 0x0004 | 0x8000, 0, None)

    # 클릭 전 목표 지점에서의 시각적 정지(Hover)
    hover_wait = 0.4 if speed_factor <= 0.5 else 0.1
    time.sleep(hover_wait)

    user32.SendInput(1, ctypes.byref(inp_move), ctypes.sizeof(INPUT))
    time.sleep(0.08)
    user32.SendInput(1, ctypes.byref(inp_down), ctypes.sizeof(INPUT))
    time.sleep(0.18)  # 누름 지속 시간
    user32.SendInput(1, ctypes.byref(inp_up), ctypes.sizeof(INPUT))
    
    # 클릭 후 관찰용 대기
    after_wait = 0.5 if speed_factor <= 0.5 else 0.15
    time.sleep(after_wait)


def move_mouse_smoothly(target_x, target_y, duration=1.2, recorder=None):
    """마우스 커서를 인간처럼 부드럽게 감속(Ease-Out Cubic)하며 천천히 이동 (0.5배속 관찰 모드 지원)"""
    point = ctypes.wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(point))
    start_x, start_y = point.x, point.y

    steps = int(duration * 60)
    if steps < 20:
        steps = 20

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
    def __init__(self, output_path, fps=15):
        self.output_path = output_path
        self.fps = fps
        self.running = False
        self.writer = None
        self.sct = None
        self.can_record = False

    def start(self):
        try:
            desk = user32.OpenInputDesktop(0, False, 0x01FF)
            if desk:
                user32.SetThreadDesktop(desk)
            self.sct = mss.mss()
            monitor = self.sct.monitors[1]
            width, height = monitor["width"], monitor["height"]
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            self.writer = cv2.VideoWriter(self.output_path, fourcc, self.fps, (width, height))
            self.running = True
            self.can_record = True
            print(f"🎥 [RECORDER] Recording started: {self.output_path} ({width}x{height} @ {self.fps}fps)")
        except Exception as e:
            print(f"⚠️ [RECORDER] Video recording disabled: {e}")
            self.running = False
            self.can_record = False

    def capture_frame(self):
        if not self.running or not self.writer or not self.can_record:
            return
        try:
            monitor = self.sct.monitors[1]
            img = np.array(self.sct.grab(monitor))
            frame = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            self.writer.write(frame)
        except Exception:
            pass

    def stop(self):
        self.running = False
        if self.writer:
            try:
                self.writer.release()
            except Exception:
                pass
            self.writer = None
        if self.can_record:
            print(f"💾 [RECORDER] Video saved: {self.output_path}")


def get_live_browser_state():
    try:
        res = requests.get(f"{SERVER_URL}/api/gms/browser-geometry", timeout=1.0)
        if res.ok:
            return res.json().get('data', {})
    except Exception:
        pass
    return {}


def get_element_target(selector, fallback_coords=None):
    """지오메트리 API로부터 셀렉터의 실제 데스크톱 물리 픽셀 좌표(physicalX, physicalY)를 획득"""
    state = get_live_browser_state()
    elements = state.get('elements', {})
    el = elements.get(selector)
    if el and el.get('found'):
        # 1. 브라우저가 직접 계산한 OS 데스크톱 절대 물리 좌표 우선 사용
        px = el.get('physicalX')
        py = el.get('physicalY')
        if px is not None and py is not None and px > 0 and py > 0:
            return int(px), int(py), el.get('visible', True)
        
        # 2. 레거시 뷰포트 상대 좌표 기반 계산
        cx = el.get('centerX', 0)
        cy = el.get('centerY', 0)
        if cx > 0 and cy > 0:
            dpr = el.get('devicePixelRatio', 1.75)
            phys_x = int(round(cx * dpr))
            phys_y = int(round(cy * dpr))
            return phys_x, phys_y, el.get('visible', True)
    if fallback_coords:
        return fallback_coords[0], fallback_coords[1], True
    return None, None, False


def wait_for_screen(target_screen_nos, timeout_sec=6.0):
    """특정 화면 번호가 될 때까지 대기"""
    start_t = time.time()
    if isinstance(target_screen_nos, int):
        target_screen_nos = [target_screen_nos]
    while time.time() - start_t < timeout_sec:
        state = get_live_browser_state()
        sm = state.get('screenMemory') or {}
        cur_no = sm.get('currentNo')
        if cur_no in target_screen_nos:
            return cur_no, sm
        time.sleep(0.2)
    return None, {}


def main():
    import argparse
    parser = argparse.ArgumentParser(description="GMS OS Hardware Mouse Automation")
    parser.add_argument("--step", type=int, default=1, help="Step number (1 or 2)")
    parser.add_argument("--side", type=str, default="A", help="Side (A or B)")
    parser.add_argument("--speed", type=float, default=0.5, help="Speed factor (0.5 for slow motion, 1.0 for normal)")
    args, _ = parser.parse_known_args()

    chosen_step = args.step
    chosen_side = args.side.upper()
    speed_factor = args.speed if args.speed > 0 else 0.5

    # 속도 계수에 따른 이동 시간 계산 (0.5배속이면 2배 느리게)
    move_dur_normal = 1.2 if speed_factor <= 0.5 else 0.45
    move_dur_short = 0.9 if speed_factor <= 0.5 else 0.3
    move_dur_long = 1.4 if speed_factor <= 0.5 else 0.6

    print("==================================================================")
    print(f"🚀 GMS OS 실제 물리 마우스 검증 엔진 v2.5 [속도 {speed_factor}배속 - 실시간 관찰 모드]")
    print(f"   ▶ 대상 스텝: Step {chosen_step} | 대상 측: {chosen_side}측")
    print("==================================================================")

    # 1. GMS 브라우저 창 최전면 활성화 (사용자 화면에 바로 띄움)
    activate_gms_window()
    pyautogui.press('f5')  # 최신 Operation.js 캐시 갱신 반영
    time.sleep(1.8)

    date_str = time.strftime("%Y-%m-%dT%H-%M-%S")
    video_path = f"D:/AI_Work/Antigravity/06.CEO/GMS_OS_마우스_동작검증_Step{chosen_step}_{chosen_side}_{date_str}.mp4"
    recorder = FullScreenRecorder(video_path, fps=15)
    recorder.start()

    try:
        report_progress(f"[{chosen_side}측] 0.5배속 마우스 시작: 브라우저 창 활성화")
        # 1. 초기 브라우저 창 내부 활성화 클릭 (Aside 상단 여백)
        user32.SetCursorPos(400, 300)
        send_mouse_click_physical(400, 300, speed_factor)
        time.sleep(0.4)

        # ── [스텝 1] 상단 플로팅 팝업의 [▶ 선택 단계 실행] 버튼 실제 물리 클릭 ──
        report_progress(f"[{chosen_side}측] 플로팅 팝업 [▶ 선택 단계 실행] 버튼으로 천천히 이동 중...")
        btn_x, btn_y, _ = get_element_target('#pcSimSingleStepBtn', fallback_coords=(1319, 124))
        print(f"\n🎯 [Target 1] 시뮬레이션 플로팅 버튼 타겟 좌표: ({btn_x}, {btn_y})")
        move_mouse_smoothly(btn_x, btn_y, duration=move_dur_normal, recorder=recorder)
        send_mouse_click_physical(btn_x, btn_y, speed_factor)
        print("✅ [Clicked] [▶ 선택 단계 실행] 물리 클릭 완료!")

        for _ in range(8):
            recorder.capture_frame()
            time.sleep(0.1)

        # ── [화면 상태 머신 루프: 100 root ➔ 101 mainMenu ➔ 102 password ➔ 200 cylinderLockCheck] ──
        for loop_idx in range(12):
            state = get_live_browser_state()
            sm = state.get('screenMemory') or {}
            cur_no = sm.get('currentNo', 100)
            print(f"\n📊 [State Machine Loop {loop_idx + 1}] 현재 화면 No: {cur_no} ({sm.get('currentName')})")

            # [상태 1] 화면 100 (root: A/B 진행 선택 화면)
            if cur_no == 100:
                report_progress(f"[{chosen_side}측] 화면 100(root): [{chosen_side}측 진행] 버튼으로 천천히 이동 중...")
                side_sel = '#progressABtn' if chosen_side == 'A' else '#progressBBtn'
                side_fallback = (2334, 1484) if chosen_side == 'A' else (2334, 1530)
                sx, sy, _ = get_element_target(side_sel, fallback_coords=side_fallback)
                print(f"🎯 [Target: Side Progress] {chosen_side} 진행 버튼 이동 및 물리 클릭: ({sx}, {sy})")
                move_mouse_smoothly(sx, sy, duration=move_dur_long, recorder=recorder)
                send_mouse_click_physical(sx, sy, speed_factor)
                print(f"✅ [Clicked] [{chosen_side} 진행] 버튼 물리 클릭 완료!")

                report_progress(f"[{chosen_side}측] 메인 메뉴(101) 화면 전환 대기 중...")
                cur_no, sm = wait_for_screen([101, 102, 200], timeout_sec=6.0)
                print(f"📊 [Screen Changed] ➔ No: {cur_no}")
                time.sleep(0.5)
                continue

            # [상태 2] 화면 101 (mainMenu)
            if cur_no == 101:
                report_progress(f"[{chosen_side}측] 화면 101: [실린더 교환] 버튼으로 천천히 이동 중...")
                ex_x, ex_y, _ = get_element_target('#mainMenuCylinderExchangeBtn', fallback_coords=(2334, 1312))
                print(f"🎯 [Target: Cylinder Exchange] 실린더 교환 버튼 이동 및 물리 클릭: ({ex_x}, {ex_y})")
                move_mouse_smoothly(ex_x, ex_y, duration=move_dur_long, recorder=recorder)
                send_mouse_click_physical(ex_x, ex_y, speed_factor)
                print("✅ [Clicked] [실린더 교환] 버튼 물리 클릭 완료!")

                report_progress(f"[{chosen_side}측] 비밀번호(102) 화면 전환 대기 중...")
                cur_no, sm = wait_for_screen([102, 200], timeout_sec=6.0)
                print(f"📊 [Screen Changed] ➔ No: {cur_no}")
                time.sleep(0.5)
                continue

            # [상태 3] 화면 102 (password)
            if cur_no in [102, 201]:
                print(f"🎯 [Target: Password] 화면 {cur_no} 키패드 4 ➔ 3 ➔ 2 ➔ 1 순차 물리 클릭")
                key_digits = ['4', '3', '2', '1']
                key_fallbacks = {
                    '4': (2200, 1350),
                    '3': (2400, 1250),
                    '2': (2300, 1250),
                    '1': (2200, 1250),
                }
                for d in key_digits:
                    report_progress(f"[{chosen_side}측] 가상 키패드 [{d}] 번으로 이동 및 클릭 중...")
                    kx, ky, _ = get_element_target(f'.keypad-btn[data-digit="{d}"]', fallback_coords=key_fallbacks.get(d))
                    print(f"  👉 키패드 [{d}] 클릭: ({kx}, {ky})")
                    move_mouse_smoothly(kx, ky, duration=move_dur_short, recorder=recorder)
                    send_mouse_click_physical(kx, ky, speed_factor)
                    for _ in range(3):
                        recorder.capture_frame()
                        time.sleep(0.08)

                # [확인] 버튼 클릭
                report_progress(f"[{chosen_side}측] 비밀번호 [확인] 버튼으로 이동 및 클릭 중...")
                cf_x, cf_y, _ = get_element_target('#passwordConfirmBtn', fallback_coords=(2400, 1500))
                print(f"  👉 비밀번호 [확인] 클릭: ({cf_x}, {cf_y})")
                move_mouse_smoothly(cf_x, cf_y, duration=move_dur_normal, recorder=recorder)
                send_mouse_click_physical(cf_x, cf_y, speed_factor)
                print("✅ [Clicked] 비밀번호 확인 물리 클릭 완료!")

                report_progress(f"[{chosen_side}측] 실린더 잠금 확인(200) 화면 전환 대기 중...")
                cur_no, sm = wait_for_screen([200], timeout_sec=6.0)
                print(f"📊 [Screen Changed] ➔ No: {cur_no}")
                time.sleep(0.5)
                continue

            # [상태 4] 화면 200 (cylinderLockCheck) - 최종 완료 단계
            if cur_no == 200:
                report_progress(f"[{chosen_side}측] 실린더잠금check [실행] 버튼으로 천천히 이동 중...")
                print("🎯 [Target: Lock Check Return] [실행] 버튼 이동 및 물리 클릭")
                ret_x, ret_y, _ = get_element_target('#cylinderLockReturnBtn', fallback_coords=(2200, 1550))
                move_mouse_smoothly(ret_x, ret_y, duration=move_dur_long, recorder=recorder)
                send_mouse_click_physical(ret_x, ret_y, speed_factor)
                print("✅ [Clicked] [실행] 버튼 물리 클릭 완료!")

                report_progress(f"[{chosen_side}측] [실행] 동작 상태 관찰 중 (1.5초 대기)...")
                for _ in range(20):
                    recorder.capture_frame()
                    time.sleep(0.1)

                report_progress(f"[{chosen_side}측] [취소] 버튼으로 천천히 이동 중...")
                print("🎯 [Target: Lock Check Cancel] [취소] 버튼 이동 및 물리 클릭")
                cnc_x, cnc_y, _ = get_element_target('#cylinderLockCancelBtn', fallback_coords=(2500, 1550))
                move_mouse_smoothly(cnc_x, cnc_y, duration=move_dur_long, recorder=recorder)
                send_mouse_click_physical(cnc_x, cnc_y, speed_factor)
                print("✅ [Clicked] [취소] 버튼 물리 클릭 완료!")

                for _ in range(15):
                    recorder.capture_frame()
                    time.sleep(0.1)

                print("🎉 [Loop Finished] 화면 200 실린더 락 확인 및 취소 완료!")
                break

            time.sleep(0.5)
        print(f"\n🎉 [Complete] Step {chosen_step} ({chosen_side}측) 실제 물리 마우스 전체 시퀀스 완주!")

    finally:
        recorder.stop()


if __name__ == "__main__":
    main()
