[CmdletBinding()]
param(
    [string]$RepositoryPath,
    [string[]]$DestinationPaths,
    [int]$RetentionCount = 30,
    [string]$LogPath
)

$ErrorActionPreference = "Stop"

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$userProfile = [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
$localApplicationData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)

if ([string]::IsNullOrWhiteSpace($RepositoryPath)) {
    $RepositoryPath = (Resolve-Path (Join-Path $scriptDirectory "..\..")).Path
}

if (-not $DestinationPaths -or $DestinationPaths.Count -eq 0) {
    $DestinationPaths = @(
        (Join-Path $userProfile "YandexDisk\Backups\evgenbond-site"),
        (Join-Path $userProfile "OneDrive\Backups\evgenbond-site")
    )
}

if ([string]::IsNullOrWhiteSpace($LogPath)) {
    $LogPath = Join-Path $localApplicationData "EvgenbondSiteBackup\backup.log"
}

function Write-BackupLog {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR")]
        [string]$Level = "INFO"
    )

    $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Write-Output $line
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Invoke-Git {
    param([string[]]$Arguments)

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & git -C $RepositoryPath @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        throw "git $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
    }

    return $output
}

$logDirectory = Split-Path -Parent $LogPath
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("evgenbond-backup-" + [guid]::NewGuid())
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bundleName = "evgenbond-site-$timestamp.bundle"
$checksumName = "$bundleName.sha256"
$bundlePath = Join-Path $stagingDirectory $bundleName
$checksumPath = Join-Path $stagingDirectory $checksumName

try {
    Write-BackupLog "Starting repository backup from $RepositoryPath"

    if (-not (Test-Path -LiteralPath (Join-Path $RepositoryPath ".git"))) {
        throw "Repository path does not contain a .git directory: $RepositoryPath"
    }

    $null = Invoke-Git @("rev-parse", "--is-inside-work-tree")

    try {
        $null = Invoke-Git @("fetch", "--all", "--prune")
        Write-BackupLog "Remote references updated"
    }
    catch {
        Write-BackupLog "Remote update failed; creating a backup from locally available Git references. $($_.Exception.Message)" "WARN"
    }

    $workingTreeStatus = Invoke-Git @("status", "--short")
    if ($workingTreeStatus) {
        Write-BackupLog "The working tree has uncommitted changes. They are intentionally excluded from the Git bundle." "WARN"
    }

    New-Item -ItemType Directory -Force -Path $stagingDirectory | Out-Null
    $null = Invoke-Git @("bundle", "create", $bundlePath, "--all")

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $verifyOutput = & git bundle verify $bundlePath 2>&1
        $verifyExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($verifyExitCode -ne 0) {
        throw "git bundle verify failed: $($verifyOutput -join [Environment]::NewLine)"
    }

    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundlePath).Hash.ToLowerInvariant()
    "$hash *$bundleName" | Set-Content -LiteralPath $checksumPath -Encoding ASCII
    Write-BackupLog "Bundle created and verified: $bundleName"

    foreach ($destination in $DestinationPaths) {
        New-Item -ItemType Directory -Force -Path $destination | Out-Null

        $destinationBundle = Join-Path $destination $bundleName
        $destinationChecksum = Join-Path $destination $checksumName
        Copy-Item -LiteralPath $bundlePath -Destination $destinationBundle -Force
        Copy-Item -LiteralPath $checksumPath -Destination $destinationChecksum -Force

        $copiedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $destinationBundle).Hash.ToLowerInvariant()
        if ($copiedHash -ne $hash) {
            throw "Checksum mismatch after copying backup to $destination"
        }

        $expiredBundles = Get-ChildItem -LiteralPath $destination -Filter "evgenbond-site-*.bundle" -File |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip $RetentionCount

        foreach ($expiredBundle in $expiredBundles) {
            $expiredChecksum = "$($expiredBundle.FullName).sha256"
            Remove-Item -LiteralPath $expiredBundle.FullName -Force
            if (Test-Path -LiteralPath $expiredChecksum) {
                Remove-Item -LiteralPath $expiredChecksum -Force
            }
        }

        Write-BackupLog "Backup copied and verified in $destination"
    }

    Write-BackupLog "Repository backup completed successfully"
}
catch {
    Write-BackupLog $_.Exception.Message "ERROR"
    exit 1
}
finally {
    if (Test-Path -LiteralPath $stagingDirectory) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }
}
