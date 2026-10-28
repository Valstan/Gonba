@echo off
rem Чат OpenCode на боксе Гоньбы: туннель 14974 → 49374 + одноразовая ссылка входа.
rem Если служба выключена — поднимает её вместе с ВПН.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gonba.ps1" chat %*
if errorlevel 1 pause
