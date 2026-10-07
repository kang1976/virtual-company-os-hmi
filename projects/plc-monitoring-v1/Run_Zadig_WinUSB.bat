@echo off
title OMRON PLC WinUSB Driver Setup (Zadig)
echo ========================================================
echo   OMRON CJ2H PLC WinUSB Driver Setup
echo ========================================================
echo.
echo [1] Zadig 실행 중...
echo [2] 상단 드롭다운에서 "OMRON SYSMAC PLC Device" 선택
echo [3] [Replace Driver] 또는 [Install Driver] 버튼 클릭!
echo.
cd /d "D:\AI_Work\Antigravity\plc-monitoring\pc-app\installer\driver"
start "" zadig.exe
