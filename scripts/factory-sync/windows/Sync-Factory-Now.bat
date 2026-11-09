@echo off
setlocal
title Sitesinc Factory sync now
cd /d "C:\Users\Vero2\Sitesinc-Factory"
if errorlevel 1 (
  echo Could not open C:\Users\Vero2\Sitesinc-Factory
  pause
  exit /b 1
)
echo Syncing local Factory code to published production...
node scripts\factory-sync\sync.mjs --reason=manual
echo.
echo Status file: C:\Users\Vero2\factory-backups\status.json
pause
exit /b %ERRORLEVEL%
