@echo off
rem Состояние бокса Гоньбы: uptime, load, RAM, диск, юниты, версия и health движка,
rem текущий egress ВПН, локальный туннель.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gonba.ps1" status %*
if errorlevel 1 pause
