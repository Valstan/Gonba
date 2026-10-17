@echo off
rem OpenCode web UI (GONBA prod): raise the SSH tunnel and open the browser.
rem Double-click me. Settings of this computer live in opencode-web.conf next to this file.
rem Flags are passed through: -Setup, -Check, -NoOpen, -NoWait.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0opencode-web.ps1" %*
if errorlevel 1 pause
