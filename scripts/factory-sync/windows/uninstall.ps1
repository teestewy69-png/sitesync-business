#Requires -Version 5.1
<#
.SYNOPSIS
  Remove the scheduled Factory sync task. Does not delete backups, repo, or .env.local.
#>
param(
  [string]$TaskName = "SitesincFactorySync",
  [string]$DesktopDir = "",
  [switch]$RemoveDesktopShortcuts
)

$ErrorActionPreference = "Stop"

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed scheduled task $TaskName."
} else {
  Write-Host "No scheduled task named $TaskName."
}

Write-Host "Backups in C:\Users\Vero2\factory-backups were kept (including secrets\)."
Write-Host "The repo and local .env.local / data\factory / data\store were not touched."

if ($RemoveDesktopShortcuts) {
  if (-not $DesktopDir) { $DesktopDir = [Environment]::GetFolderPath("Desktop") }
  foreach ($name in @("Sync Factory Now.bat", "Factory Sync Status.bat")) {
    $p = Join-Path $DesktopDir $name
    if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force }
  }
  Write-Host "Removed Sync Now / Status shortcuts. Start Sitesinc Factory.bat was left in place."
} else {
  Write-Host "Desktop Start Sitesinc Factory.bat was left in place (it still launches 127.0.0.1:3000)."
}
