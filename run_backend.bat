@echo off
chcp 65001 > nul
title [가상 기업 OS] 백엔드 FastAPI 서버 (:8000)
cd /d "%~dp0"

echo ======================================================================
echo    [가상 기업 OS] 백엔드 FastAPI 서버 (:8000) 시작
echo ======================================================================
echo.
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
pause
