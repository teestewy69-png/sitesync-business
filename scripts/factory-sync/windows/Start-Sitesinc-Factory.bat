@echo off
setlocal
title Sitesinc Website Factory
cd /d "C:\Users\Vero2\Sitesinc-Factory"
if errorlevel 1 (
  echo Could not open C:\Users\Vero2\Sitesinc-Factory
  pause
  exit /b 1
)

echo Checking published production ^(sitesinc.co/release.json^) before start...
node scripts\factory-sync\sync.mjs --reason=launch
set SYNC_EXIT=%ERRORLEVEL%

if %SYNC_EXIT% EQU 10 (
  echo.
  echo Factory already appears to be running on 127.0.0.1:3000.
  echo Not starting a second copy. Unsaved work was not interrupted.
  echo See C:\Users\Vero2\factory-backups\status.json
  pause
  exit /b 0
)

if not %SYNC_EXIT% EQU 0 (
  echo.
  echo Sync did not fast-forward. Local env/data were not modified.
  echo See C:\Users\Vero2\factory-backups\status.json
  echo Starting Factory on the current local commit so you can keep working.
  echo.
)

echo Starting next dev on 127.0.0.1:3000
call npm run dev -- --hostname 127.0.0.1 --port 3000
echo Factory stopped.
pause
exit /b %ERRORLEVEL%
