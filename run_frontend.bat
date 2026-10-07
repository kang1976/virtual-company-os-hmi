@echo off
chcp 65001 > nul
title [가상 기업 OS] 프론트엔드 React/Vite 서버 (:5173)
cd /d "%~dp0"

echo ======================================================================
echo    [가상 기업 OS] 프론트엔드 React/Vite 서버 (:5173) 시작
echo ======================================================================
echo.
npm --prefix frontend run dev
pause
