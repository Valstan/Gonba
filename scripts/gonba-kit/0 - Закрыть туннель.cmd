@echo off
rem Закрыть локальный туннель чата (движок на боксе продолжает работать).
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gonba.ps1" stop %*
if errorlevel 1 pause
