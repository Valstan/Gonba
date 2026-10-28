@echo off
rem Смена сервера ВПН (egress движка): следующий сервер подписки до рабочего выхода.
rem Движок не перезапускается; печатает «было → стало» и фактический выход.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gonba.ps1" vpn %*
if errorlevel 1 pause
