@echo off
chcp 65001 > nul
title [PLC 통합 모니터링 관제 시스템] 1-Click 통합 기동기

cd /d "%~dp0"

echo ======================================================================
echo    [PLC 통합 모니터링 관제 시스템] 전사 서버 기동
echo ======================================================================
echo.
echo  [1/2] PC 관제 웹 서버 (:3004) 기동 중...
start "PLC_PC_APP_3004" cmd /k "cd /d %~dp0pc-app && node src/server.js"

echo  [2/2] PWA 브릿지 서버 (:3000) 기동 중...
start "PLC_PWA_BRIDGE_3000" cmd /k "cd /d %~dp0pwa-bridge && node server.js"

echo.
echo  [3/3] 잠시 후 기본 웹 브라우저에서 관제 화면이 열립니다.
timeout /t 3 > nul
start http://localhost:3004

echo ======================================================================
echo  PLC 관제 시스템이 정상 기동되었습니다!
echo  - PC 웹 모니터링: http://localhost:3004
echo  - PWA 브릿지:      http://localhost:3000
echo ======================================================================
pause
