#Requires -Version 5.1
<#
.SYNOPSIS
  Install the local Sitesinc Website Factory backup+sync job on Tony's Windows PC.

.DESCRIPTION
  Creates C:\Users\Vero2\factory-backups, registers a 15-minute Task Scheduler job,
  writes desktop shortcuts, and backs up the previous Start Sitesinc Factory.bat.
  Does not push, deploy, hard-reset, or contact Netlify with a token.

  Run from an elevated-or-user PowerShell after this PR is on the machine:

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\factory-sync\windows\install.ps1
#>
param(
  [string]$RepoRoot = "C:\Users\Vero2\Sitesinc-Factory",
  [string]$BackupDir = "C:\Users\Vero2\factory-backups",
  [string]$DesktopDir = "",
  [string]$TaskName = "SitesincFactorySync",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[factory-sync] $msg" }

if (-not (Test-Path -LiteralPath $RepoRoot)) {
  throw "Repo not found: $RepoRoot"
}
$syncJs = Join-Path $RepoRoot "scripts\factory-sync\sync.mjs"
if (-not (Test-Path -LiteralPath $syncJs)) {
  throw "Missing $syncJs - check out the Factory sync PR in this repo first."
}
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw "Node.js is not on PATH. Need Node 22." }

if (-not $DesktopDir) {
  $DesktopDir = [Environment]::GetFolderPath("Desktop")
}

$secretsDir = Join-Path $BackupDir "secrets"
$codeDir = Join-Path $BackupDir "code"
$dataDir = Join-Path $BackupDir "data"
$logsDir = Join-Path $BackupDir "logs"
$launcherBackupDir = Join-Path $BackupDir "launcher-previous"

Write-Step "Repo $RepoRoot"
Write-Step "Backups $BackupDir"
Write-Step "Desktop $DesktopDir"

if ($DryRun) {
  Write-Step "Dry run only. No task, folders, or shortcuts will be written."
  exit 0
}

New-Item -ItemType Directory -Force -Path $BackupDir, $secretsDir, $codeDir, $dataDir, $logsDir, $launcherBackupDir | Out-Null

$icacls = Get-Command icacls -ErrorAction SilentlyContinue
if ($icacls) {
  & icacls $secretsDir /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" /grant:r "SYSTEM:(OI)(CI)F" | Out-Null
}

$config = @{
  repoRoot = $RepoRoot
  backupDir = $BackupDir
  desktopDir = $DesktopDir
}
$configPath = Join-Path $RepoRoot "scripts\factory-sync\windows\local-config.json"
($config | ConvertTo-Json) | Set-Content -LiteralPath $configPath -Encoding UTF8

$runPs1 = Join-Path $RepoRoot "scripts\factory-sync\windows\run-scheduled.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runPs1`"" -WorkingDirectory $RepoRoot
$once = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 3650)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($once, $logon) -Settings $settings -Principal $principal -Description "Backup+fast-forward Sitesinc Factory to the published sitesinc.co commit. Never pushes or deploys." -Force | Out-Null
Write-Step "Scheduled task '$TaskName' every 15 minutes (IgnoreNew if already running)."

$startSrc = Join-Path $RepoRoot "scripts\factory-sync\windows\Start-Sitesinc-Factory.bat"
$syncSrc = Join-Path $RepoRoot "scripts\factory-sync\windows\Sync-Factory-Now.bat"
$statusSrc = Join-Path $RepoRoot "scripts\factory-sync\windows\Factory-Sync-Status.bat"
$startDest = Join-Path $DesktopDir "Start Sitesinc Factory.bat"
$syncDest = Join-Path $DesktopDir "Sync Factory Now.bat"
$statusDest = Join-Path $DesktopDir "Factory Sync Status.bat"

if (Test-Path -LiteralPath $startDest) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item -LiteralPath $startDest -Destination (Join-Path $launcherBackupDir "Start Sitesinc Factory.$stamp.bat") -Force
  Write-Step "Backed up existing Start Sitesinc Factory.bat"
}

Copy-Item -LiteralPath $startSrc -Destination $startDest -Force
Copy-Item -LiteralPath $syncSrc -Destination $syncDest -Force
Copy-Item -LiteralPath $statusSrc -Destination $statusDest -Force
Write-Step "Desktop shortcuts written (Start, Sync Now, Status)."

Write-Host ""
Write-Host "Install complete. This job never uploads backups or .env.local to GitHub."
Write-Host "Pause:   powershell -File scripts\factory-sync\windows\pause.ps1"
Write-Host "Resume:  powershell -File scripts\factory-sync\windows\resume.ps1"
Write-Host "Remove:  powershell -File scripts\factory-sync\windows\uninstall.ps1"
Write-Host "Status:  node scripts\factory-sync\sync.mjs --status"
Write-Host ""
Write-Host "codeInSync is git-only. Production env secrets are not the same as local .env.local."
