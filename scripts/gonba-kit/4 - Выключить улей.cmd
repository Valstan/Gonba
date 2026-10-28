@echo off
rem Выключить улей: служба opencode-web и ВПН-клиент на боксе + локальный туннель.
rem Бокс перестаёт тратить память (сайт не затрагивается).
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gonba.ps1" off %*
if errorlevel 1 pause
