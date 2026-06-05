@echo off
cd /d "%~dp0\client"

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
)

echo [INFO] Starting BiBooks...
call npm run dev
pause
