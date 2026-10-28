@echo off
rem Интерактивная SSH-консоль бокса (алиас GONBA). exit — выход.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gonba.ps1" shell %*
if errorlevel 1 pause
