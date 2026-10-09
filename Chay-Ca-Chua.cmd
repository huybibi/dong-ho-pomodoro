@echo off
rem Start Dong ho Pomodoro. Clears ELECTRON_RUN_AS_NODE so Electron boots as an app.
rem Duong dan app phai ket thuc bang \. : "%APP%\" lam dau " bi hieu la ky tu escape
rem (Electron nhan "D:\...\pomodoro-clock"" va bao "Unable to find Electron app").
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
