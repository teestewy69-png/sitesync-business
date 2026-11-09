#Requires -Version 5.1
param([string]$TaskName = "SitesincFactorySync")
$ErrorActionPreference = "Stop"
Disable-ScheduledTask -TaskName $TaskName | Out-Null
Write-Host "Paused scheduled Factory sync ($TaskName). Desktop Start / Sync Now still work."
Write-Host "Resume: powershell -File scripts\factory-sync\windows\resume.ps1"
