@echo off
rem Перезапуск движка opencode-web на боксе (ремонт зависшего; ВПН не трогает).
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gonba.ps1" restart %*
if errorlevel 1 pause
