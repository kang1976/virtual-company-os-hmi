@echo off
chcp 65001 > nul
title [가상 기업 OS] 전사 서버 통합 기동기

cd /d "%~dp0"

echo ======================================================================
echo    [가상 기업 자율 운영 OS - CEO 관제실] 전사 서버 통합 기동
echo ======================================================================
echo.
echo  [1/3] 백엔드 FastAPI 서버 (:8000) 기동 중...
start "CEO_BACKEND_8000" cmd /c "%~dp0run_backend.bat"

echo  [2/3] 프론트엔드 Vite 서버 (:5173) 기동 중...
start "CEO_FRONTEND_5173" cmd /c "%~dp0run_frontend.bat"

echo.
echo  [3/3] 브라우저 관제 화면 자동 연결 중...
timeout /t 3 > nul
start http://localhost:5173

echo.
echo ======================================================================
echo  모든 서버가 정상적으로 기동되었습니다!
echo  - 프론트엔드 관제실: http://localhost:5173
echo  - 백엔드 REST API:  http://localhost:8000
echo  - API 문서(Swagger): http://localhost:8000/docs
echo.
echo  ※ 서버를 종료하시려면 각각 열린 터미널 창을 닫아주시면 됩니다.
echo ======================================================================
pause
