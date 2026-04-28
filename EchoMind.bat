@echo off
title EchoMind Launcher
echo 🚀 正在啟動 EchoMind 智能語音助手...
echo ---------------------------------------
echo [1/2] 正在背景啟動本地伺服器 (Port: 8000)...
start /b python -m http.server 8000 > nul 2>&1
timeout /t 2 > nul
echo [2/2] 正在瀏覽器中開啟 EchoMind...
start http://localhost:8000
echo ---------------------------------------
echo ✅ 啟動完成！請保留此視窗以維持服務執行。
echo 💡 現在在瀏覽器點選一次「允許麥克風」後，系統將會記住權限。
echo ---------------------------------------
pause
