@echo off
rem GONBA kit dispatcher. Usage: gonba.cmd [chat^|vpn^|restart^|off^|stop^|status^|logs^|shell^|doctor]
rem Без аргументов — интерактивное меню.
chcp 65001 >nul
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gonba.ps1" %*
set rc=%errorlevel%
if not "%rc%"=="0" pause
exit /b %rc%
