# run.py
"""
AI Virtual Company OS v4.0 - 통합 원클릭 실행기
FastAPI 백엔드(포트 8000) 및 React Vite 프론트엔드(포트 5173) 동시 구동 및 안전 종료 스크립트
"""

import os
import subprocess
import sys
import time

# Windows 콘솔에서 유니코드(이모지 및 한글) 인코딩 오류 방지
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def stop_process(proc: subprocess.Popen, name: str = "프로세스"):
    """자식 프로세스 및 관련 하위 트리 프로세스를 안전하게 강제 종료"""
    if proc is None or proc.poll() is not None:
        return
    print(f"  🛑 {name} 종료 중... (PID: {proc.pid})")
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        else:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def get_local_ip():
    """현재 PC의 내부 로컬 네트워크 IP(Wi-Fi/이더넷)를 감지"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root_dir)
    local_ip = get_local_ip()

    print("=" * 80)
    print("  🏢 AI VIRTUAL COMPANY OS V4.0 — 통합 운영 런처")
    print("  초지능 자율운영 가상기업 (CEO: KANG SEUNG HEON)")
    print("=" * 80)

    # 1. FastAPI 백엔드 기동
    print("\n  [1/2] 🚀 FastAPI 백엔드 서버 시작 중...")
    print("        - API 서버 주소 : http://127.0.0.1:8000")
    print("        - Swagger 문서   : http://127.0.0.1:8000/docs")
    print("        - 실시간 웹소켓 : ws://127.0.0.1:8000/ws")
    backend = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=root_dir,
    )

    # 포트 바인딩 대기
    time.sleep(2)

    # 2. React Vite 프론트엔드 기동
    print("\n  [2/2] 🌐 React Vite 프론트엔드 대시보드 시작 중...")
    print("        - 로컬 PC 접속   : http://localhost:5173")
    if local_ip != "127.0.0.1":
        print(f"        - 📱 모바일 접속 : http://{local_ip}:5173 (스마트폰 동일 Wi-Fi 접속)")
    frontend = subprocess.Popen(
        ["npm", "run", "dev", "--prefix", "frontend"],
        cwd=root_dir,
        shell=True,
    )

    print("-" * 80)
    print("  ✨ 모든 시스템이 정상 가동 중입니다. (종료하려면 Ctrl + C를 누르세요)")
    print("=" * 80 + "\n")

    try:
        while True:
            if backend.poll() is not None:
                print("\n  ⚠️ FastAPI 백엔드 프로세스가 종료되었습니다.")
                break
            if frontend.poll() is not None:
                print("\n  ⚠️ React 프론트엔드 프로세스가 종료되었습니다.")
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n\n" + "=" * 80)
        print("  ⚠️  사용자 중단 신호 감지 (Ctrl + C)")
        print("  🏢 AI 가상회사 운영 시스템을 안전하게 종료합니다...")
        print("=" * 80)
    finally:
        stop_process(backend, "FastAPI 백엔드")
        stop_process(frontend, "React 프론트엔드")
        print("\n  ✅ 모든 서비스가 안전하게 종료되었습니다. 안녕히 가십시오.\n")


if __name__ == "__main__":
    main()
