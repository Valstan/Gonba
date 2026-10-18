@echo off
rem OpenCode web UI (GONBA prod): raise the SSH tunnel and open the browser.
rem Double-click me. Settings of this computer live in opencode-web.conf next to this file.
rem Flags are passed through: -Setup, -Check, -NoOpen, -NoWait, -Stop, -Off.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0opencode-web.ps1" %*
set rc=%errorlevel%
if not "%rc%"=="0" (
  echo.
  echo [!] Did not finish cleanly ^(exit code %rc%^). Press any key to close.
  pause >nul
)
rem Exit code stays the launcher's - `timeout`/`pause` must not mask it.
exit /b %rc%
