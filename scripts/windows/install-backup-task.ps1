[CmdletBinding()]
param(
    [string]$TaskName = "Evgenbond-Site-Backup",
    [datetime]$DailyAt = [datetime]::Today.AddHours(3)
)

$ErrorActionPreference = "Stop"

$backupScript = (Resolve-Path (Join-Path $PSScriptRoot "backup-repository.ps1")).Path
$powerShell = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`""

$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory (Split-Path -Parent $backupScript)
$trigger = New-ScheduledTaskTrigger -Daily -At $DailyAt
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Daily verified Git bundle backup of evgenbond-site to Yandex Disk and OneDrive." `
    -Force | Out-Null

Write-Output "Scheduled task '$TaskName' installed. Next run: $((Get-ScheduledTaskInfo -TaskName $TaskName).NextRunTime)"
