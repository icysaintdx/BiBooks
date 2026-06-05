@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   BiBooks 自动标书生成系统 - 一键启动
echo ========================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 16+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 显示 Node.js 版本
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [信息] Node.js 版本: %NODE_VERSION%

:: 检查 npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 npm
    pause
    exit /b 1
)

:: 进入项目目录
cd /d "%~dp0"
echo [信息] 项目目录: %cd%
echo.

:: 检查依赖是否安装
if not exist "client\node_modules" (
    echo [提示] 首次运行，正在安装依赖...
    echo [信息] 这可能需要几分钟，请耐心等待
    echo.
    cd client
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
    cd ..
    echo.
    echo [完成] 依赖安装成功
    echo.
)

:: 启动应用
echo [启动] 正在启动 BiBooks...
echo.
cd client
call npm run dev

:: 如果 npm run dev 失败，尝试其他启动方式
if %errorlevel% neq 0 (
    echo.
    echo [提示] 尝试使用 electron 直接启动...
    call npx electron .
)

pause
