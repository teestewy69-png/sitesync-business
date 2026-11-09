#Requires -Version 5.1
param([string]$TaskName = "SitesincFactorySync")
$ErrorActionPreference = "Stop"
Enable-ScheduledTask -TaskName $TaskName | Out-Null
Write-Host "Resumed scheduled Factory sync ($TaskName) every 15 minutes."
