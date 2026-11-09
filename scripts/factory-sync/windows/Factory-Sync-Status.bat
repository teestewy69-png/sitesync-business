@echo off
setlocal
title Sitesinc Factory sync status
cd /d "C:\Users\Vero2\Sitesinc-Factory"
if errorlevel 1 (
  echo Could not open C:\Users\Vero2\Sitesinc-Factory
  pause
  exit /b 1
)
echo codeInSync is git HEAD vs published production only.
echo Local .env.local and data\factory + data\store are local-only and are not production secrets.
echo.
node scripts\factory-sync\sync.mjs --status
if exist "C:\Users\Vero2\factory-backups\PENDING-SYNC.txt" (
  echo.
  echo PENDING SYNC:
  type "C:\Users\Vero2\factory-backups\PENDING-SYNC.txt"
)
echo.
echo Log: C:\Users\Vero2\factory-backups\logs\factory-sync.log
pause
exit /b 0
