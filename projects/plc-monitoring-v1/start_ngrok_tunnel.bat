@echo off
chcp 65001 > nul
echo ===================================================
echo [PLC 관제] ngrok 가상 시뮬레이션 원격 터널링 시작 (Port: 3000)
echo ===================================================
echo.
cd /d "%~dp0pc-app"
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo [안내] ngrok이 PATH에 설치되어 있지 않습니다.
    echo npx를 통해 직접 실행합니다...
    npx -y ngrok http 3000
) else (
    ngrok http 3000
)
pause
