@echo off
rem Журнал движка opencode-web на боксе (40 строк).
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gonba.ps1" logs %*
if errorlevel 1 pause
