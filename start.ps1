# BiBooks 自动标书生成系统 - 一键启动脚本
# 使用方法: 右键 -> 使用 PowerShell 运行，或在终端执行: .\start.ps1

# 设置控制台编码为 UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    Write-ColorOutput "" "White"
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "  BiBooks 自动标书生成系统 - 一键启动" "Cyan"
    Write-ColorOutput "========================================" "Cyan"
    Write-ColorOutput "" "White"
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "[信息] $Message" "White"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[完成] $Message" "Green"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[提示] $Message" "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[错误] $Message" "Red"
}

# 主函数
function Main {
    Write-Header

    # 检查 Node.js
    try {
        $nodeVersion = node -v 2>&1
        Write-Info "Node.js 版本: $nodeVersion"
    } catch {
        Write-Error "未检测到 Node.js，请先安装 Node.js 16+"
        Write-Info "下载地址: https://nodejs.org/"
        Read-Host "按 Enter 键退出"
        exit 1
    }

    # 检查 npm
    try {
        $npmVersion = npm -v 2>&1
        Write-Info "npm 版本: $npmVersion"
    } catch {
        Write-Error "未检测到 npm"
        Read-Host "按 Enter 键退出"
        exit 1
    }

    # 进入项目目录
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    Set-Location $scriptPath
    Write-Info "项目目录: $(Get-Location)"
    Write-ColorOutput "" "White"

    # 检查依赖是否安装
    if (-not (Test-Path "client\node_modules")) {
        Write-Warning "首次运行，正在安装依赖..."
        Write-Info "这可能需要几分钟，请耐心等待"
        Write-ColorOutput "" "White"

        Set-Location client

        try {
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "npm install 失败"
            }
            Write-Success "依赖安装成功"
        } catch {
            Write-Error "依赖安装失败，请检查网络连接"
            Write-Info "错误信息: $_"
            Read-Host "按 Enter 键退出"
            exit 1
        }

        Set-Location ..
        Write-ColorOutput "" "White"
    }

    # 启动应用
    Write-Info "正在启动 BiBooks..."
    Write-ColorOutput "" "White"

    Set-Location client

    try {
        # 尝试使用 npm run dev 启动
        npm run dev

        # 如果 npm run dev 失败
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "尝试使用 electron 直接启动..."
            npx electron .
        }
    } catch {
        Write-Error "启动失败: $_"
        Write-Info "请检查是否有其他程序占用了端口"
    }

    Read-Host "按 Enter 键退出"
}

# 运行主函数
Main
