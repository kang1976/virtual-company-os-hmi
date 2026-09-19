@echo off
chcp 65001 > nul
title [가상 기업 OS] 전사 서버 1-Click 통합 기동기

echo ======================================================================
echo    [가상 기업 자율 운영 OS - CEO 관제실] 전사 서버 통합 기동
echo ======================================================================
echo.
echo  [1/3] 백엔드 FastAPI 서버(:8000) 기동 중...
start "CEO_OS_BACKEND_8000" cmd /k "chcp 65001 > nul && title [백엔드 API 서버 :8000] && cd /d %~dp0 && python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload"

echo  [2/3] 프론트엔드 React/Vite 서버(:5173) 기동 중...
start "CEO_OS_FRONTEND_5173" cmd /k "chcp 65001 > nul && title [프론트엔드 콘솔 :5173] && cd /d %~dp0 && npm --prefix frontend run dev"

echo.
echo  [3/3] 잠시 후(약 3초 뒤) 기본 웹 브라우저에서 관제 화면이 자동으로 열립니다.
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
