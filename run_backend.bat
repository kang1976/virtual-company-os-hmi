@echo off
chcp 65001 > nul
title [가상 기업 OS] 백엔드 서버 (:8000)
cd /d %~dp0

echo ======================================================================
echo    [가상 기업 OS] 백엔드 FastAPI 서버 (:8000) 시작
echo ======================================================================
echo.
echo Python 가상환경 및 Uvicorn 서버를 실행합니다...
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

pause
