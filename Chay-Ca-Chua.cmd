@echo off
rem Start Ca Chua Tap Trung. Clears ELECTRON_RUN_AS_NODE so Electron boots as an app.
set "ELECTRON_RUN_AS_NODE="
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
