#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = (Resolve-Path (Join-Path $here "..\..\..")).Path
Set-Location $repo
$node = Get-Command node -ErrorAction Stop
& $node.Source "scripts\factory-sync\sync.mjs" "--reason=scheduled"
exit $LASTEXITCODE
