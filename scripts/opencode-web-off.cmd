@echo off
rem OpenCode web UI (GONBA prod): turn it OFF completely.
rem Stops the service on the box (returns ~180 MB there) AND closes this
rem computer's SSH tunnel. Access is off until the next launch.
rem Russian text on screen comes from the launcher itself.
rem Flags pass through: -Stop (tunnel only), -Check, -Config.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0opencode-web.ps1" -Off %*
set rc=%errorlevel%
if not "%rc%"=="0" (
  echo.
  echo [!] Did not finish cleanly ^(exit code %rc%^). Window closes in 30 s.
  timeout /t 30 /nobreak >nul
  exit /b %rc%
)
rem Let the numbers be readable, then close by itself - no keypress needed.
timeout /t 8 /nobreak >nul
rem `timeout` itself may fail without a console; the launcher's code stays the exit code.
exit /b %rc%
