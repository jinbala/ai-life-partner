# MySQL 一键配置脚本
# 请以管理员身份运行此脚本

$MySQLPath = "C:\Program Files\MySQL\MySQL Server 8.4\bin"
$ServiceName = "MySQL84"
$DatabaseName = "ai_life_partner"
$RootPassword = "" # 空密码，生产环境请修改

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MySQL 一键配置脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "错误：请以管理员身份运行此脚本" -ForegroundColor Red
    Write-Host "右键点击脚本 -> 以管理员身份运行" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "[1/5] 检查 MySQL 安装..." -ForegroundColor Green
if (-not (Test-Path $MySQLPath)) {
    Write-Host "错误：未找到 MySQL 安装目录" -ForegroundColor Red
    Write-Host "请先安装 MySQL 8.0+" -ForegroundColor Yellow
    Write-Host "运行：winget install Oracle.MySQL" -ForegroundColor Gray
    pause
    exit 1
}
Write-Host "      MySQL 路径：$MySQLPath" -ForegroundColor Gray

Write-Host ""
Write-Host "[2/5] 初始化数据目录..." -ForegroundColor Green
&"$MySQLPath\mysqld" --initialize-insecure 2>&1 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Write-Host "警告：初始化可能已存在数据目录，继续..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/5] 安装 MySQL 服务..." -ForegroundColor Green
&"$MySQLPath\mysqld" --install $ServiceName 2>&1 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }

Write-Host ""
Write-Host "[4/5] 启动 MySQL 服务..." -ForegroundColor Green
Start-Service $ServiceName -ErrorAction SilentlyContinue
if ($?) {
    Write-Host "      服务已启动" -ForegroundColor Green
} else {
    Write-Host "      尝试手动启动..." -ForegroundColor Yellow
    net start $ServiceName 2>&1 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
}

Write-Host ""
Write-Host "[5/5] 创建数据库..." -ForegroundColor Green
Start-Sleep -Seconds 2 # 等待服务完全启动

# 设置空密码并创建数据库
&"$MySQLPath\mysql" -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$RootPassword';" 2>&1 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
&"$MySQLPath\mysql" -u root -e "CREATE DATABASE IF NOT EXISTS $DatabaseName;" 2>&1 | ForEach-Object { Write-Host $_ -ForegroundColor Gray }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  MySQL 配置完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "下一步：" -ForegroundColor Cyan
Write-Host "1. 修改项目 .env 文件，添加以下配置：" -ForegroundColor White
Write-Host ""
Write-Host "   DB_TYPE=mysql" -ForegroundColor Gray
Write-Host "   DB_HOST=localhost" -ForegroundColor Gray
Write-Host "   DB_PORT=3306" -ForegroundColor Gray
Write-Host "   DB_USER=root" -ForegroundColor Gray
Write-Host "   DB_PASSWORD=" -ForegroundColor Gray
Write-Host "   DB_NAME=$DatabaseName" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 重启服务器：npm start" -ForegroundColor White
Write-Host ""

pause
