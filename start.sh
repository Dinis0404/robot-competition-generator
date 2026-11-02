#!/usr/bin/env bash
# 機器人競賽抽籤生成器 - 本地預覽伺服器
cd "$(dirname "$0")"
PORT=8000
echo "============================================"
echo " 機器人競賽抽籤生成器 - 本地預覽伺服器"
echo " 網址： http://localhost:$PORT"
echo " 按 Ctrl+C 停止伺服器"
echo "============================================"
( sleep 1 && ( open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || true ) ) &
if command -v python3 >/dev/null 2>&1; then
    python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
    python -m http.server "$PORT"
else
    echo "[!] 找不到 Python，請安裝 Python 或改用 VS Code 的 Live Server 外掛。"
    exit 1
fi
