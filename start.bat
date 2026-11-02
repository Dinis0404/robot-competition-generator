@echo off
chcp 65001 >nul
title 機器人競賽抽籤生成器 - 本地伺服器
cd /d "%~dp0"
set PORT=8000
echo.
echo  ============================================
echo   機器人競賽抽籤生成器 - 本地預覽伺服器
echo   網址： http://localhost:%PORT%
echo   關閉此視窗即可停止伺服器
echo  ============================================
echo.
where py >nul 2>nul
if %errorlevel%==0 (
    start "" http://localhost:%PORT%/
    py -m http.server %PORT%
    goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
    start "" http://localhost:%PORT%/
    python -m http.server %PORT%
    goto :eof
)
echo  [!] 找不到 Python，請安裝 Python 或改用 VS Code 的 Live Server 外掛。
pause
