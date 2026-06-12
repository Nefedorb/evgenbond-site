[CmdletBinding()]
param(
    [string]$RepositoryPath,
    [string]$DestinationPath,
    [string]$ShareXConfigPath,
    [int]$RetentionCount = 30,
    [long]$TelegramMaximumBytes = 50MB,
    [string]$LogPath
)

$ErrorActionPreference = "Stop"

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$userProfile = [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
$localApplicationData = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)

if ([string]::IsNullOrWhiteSpace($RepositoryPath)) {
    $RepositoryPath = (Resolve-Path (Join-Path $scriptDirectory "..\..")).Path
}

if ([string]::IsNullOrWhiteSpace($DestinationPath)) {
    $DestinationPath = Join-Path $localApplicationData "EvgenbondSiteBackup\archives"
}

if ([string]::IsNullOrWhiteSpace($ShareXConfigPath)) {
    $documents = [Environment]::GetFolderPath([Environment+SpecialFolder]::MyDocuments)
    $ShareXConfigPath = Join-Path $documents "ShareX\UploadersConfig.json"
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

function Get-TelegramUploader {
    if (-not (Test-Path -LiteralPath $ShareXConfigPath)) {
        throw "ShareX uploader configuration was not found: $ShareXConfigPath"
    }

    try {
        $config = Get-Content -LiteralPath $ShareXConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "ShareX uploader configuration is not valid JSON."
    }

    $selectedIndex = [int]$config.CustomFileUploaderSelected
    $uploaders = @($config.CustomUploadersList)
    if ($selectedIndex -lt 0 -or $selectedIndex -ge $uploaders.Count) {
        throw "ShareX custom file uploader selection is invalid."
    }

    $uploader = $uploaders[$selectedIndex]
    if ($uploader.Name -ne "TelegramDOC") {
        throw "ShareX selected file uploader must be TelegramDOC, but '$($uploader.Name)' is selected."
    }

    if ($uploader.RequestMethod -ne "POST" -or $uploader.FileFormName -ne "document") {
        throw "ShareX TelegramDOC request settings have changed."
    }

    $requestUrl = [string]$uploader.RequestURL
    $urlMatch = [regex]::Match(
        $requestUrl,
        "^https://api\.telegram\.org/bot(?<token>[^/]+)/sendDocument$",
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    if (-not $urlMatch.Success) {
        throw "ShareX TelegramDOC URL is not a supported Telegram Bot API sendDocument endpoint."
    }

    $chatId = [string]$uploader.Arguments.chat_id
    if ([string]::IsNullOrWhiteSpace($chatId)) {
        throw "ShareX TelegramDOC chat_id is missing."
    }

    return @{
        RequestUrl = $requestUrl
        Token = $urlMatch.Groups["token"].Value
        ChatId = $chatId
    }
}

function Send-TelegramDocument {
    param(
        [string]$FilePath,
        [string]$Caption,
        [hashtable]$Uploader
    )

    Add-Type -AssemblyName System.Net.Http

    $client = New-Object System.Net.Http.HttpClient
    $form = New-Object System.Net.Http.MultipartFormDataContent
    $stream = $null
    $fileContent = $null

    try {
        $form.Add((New-Object System.Net.Http.StringContent($Uploader.ChatId)), "chat_id")
        $form.Add((New-Object System.Net.Http.StringContent($Caption, [System.Text.Encoding]::UTF8)), "caption")

        $stream = [System.IO.File]::OpenRead($FilePath)
        $fileContent = New-Object System.Net.Http.StreamContent($stream)
        $fileContent.Headers.ContentType = New-Object System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream")
        $form.Add($fileContent, "document", [System.IO.Path]::GetFileName($FilePath))

        $response = $client.PostAsync($Uploader.RequestUrl, $form).GetAwaiter().GetResult()
        $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()

        if (-not $response.IsSuccessStatusCode) {
            throw "Telegram Bot API returned HTTP $([int]$response.StatusCode)."
        }

        try {
            $result = $responseBody | ConvertFrom-Json
        }
        catch {
            throw "Telegram Bot API returned invalid JSON."
        }

        if (-not $result.ok) {
            throw "Telegram Bot API rejected the document."
        }

        $expectedFileName = [System.IO.Path]::GetFileName($FilePath)
        if ($result.result.document.file_name -ne $expectedFileName) {
            throw "Telegram Bot API returned an unexpected document name."
        }

        if ($result.result.from.username -ne "bondfilebot") {
            throw "Telegram response came from an unexpected bot account."
        }

        return [long]$result.result.message_id
    }
    finally {
        if ($fileContent) {
            $fileContent.Dispose()
        }
        elseif ($stream) {
            $stream.Dispose()
        }
        $form.Dispose()
        $client.Dispose()
    }
}

function Remove-ExpiredBackups {
    $expiredBundles = Get-ChildItem -LiteralPath $DestinationPath -Filter "evgenbond-site-*.bundle" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -Skip $RetentionCount

    foreach ($expiredBundle in $expiredBundles) {
        $expiredChecksum = "$($expiredBundle.FullName).sha256"
        Remove-Item -LiteralPath $expiredBundle.FullName -Force
        if (Test-Path -LiteralPath $expiredChecksum) {
            Remove-Item -LiteralPath $expiredChecksum -Force
        }
    }
}

function Protect-LogMessage {
    param(
        [string]$Message,
        [hashtable]$Uploader
    )

    if (-not $Uploader) {
        return $Message
    }

    return $Message.Replace($Uploader.Token, "[redacted]").Replace($Uploader.ChatId, "[redacted]")
}

$logDirectory = Split-Path -Parent $LogPath
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("evgenbond-backup-" + [guid]::NewGuid())
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bundleName = "evgenbond-site-$timestamp.bundle"
$checksumName = "$bundleName.sha256"
$bundlePath = Join-Path $stagingDirectory $bundleName
$checksumPath = Join-Path $stagingDirectory $checksumName
$telegramUploader = $null

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

    New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null
    $destinationBundle = Join-Path $DestinationPath $bundleName
    $destinationChecksum = Join-Path $DestinationPath $checksumName
    Copy-Item -LiteralPath $bundlePath -Destination $destinationBundle -Force
    Copy-Item -LiteralPath $checksumPath -Destination $destinationChecksum -Force

    $copiedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $destinationBundle).Hash.ToLowerInvariant()
    if ($copiedHash -ne $hash) {
        throw "Checksum mismatch after copying backup to local storage."
    }

    Remove-ExpiredBackups
    Write-BackupLog "Backup copied and verified in $DestinationPath"

    $bundleSize = (Get-Item -LiteralPath $destinationBundle).Length
    if ($bundleSize -gt $TelegramMaximumBytes) {
        throw "Bundle size $bundleSize bytes exceeds the configured Telegram limit of $TelegramMaximumBytes bytes."
    }
    if ($bundleSize -ge [math]::Floor($TelegramMaximumBytes * 0.9)) {
        Write-BackupLog "Bundle size is above 90% of the configured Telegram limit." "WARN"
    }

    $telegramUploader = Get-TelegramUploader
    $commitSha = (Invoke-Git @("rev-parse", "HEAD") | Select-Object -First 1).Trim()
    $caption = @(
        "evgenbond-site backup"
        "commit: $commitSha"
        "sha256: $hash"
    ) -join "`n"
    $messageId = Send-TelegramDocument -FilePath $destinationBundle -Caption $caption -Uploader $telegramUploader
    Write-BackupLog "Telegram backup uploaded successfully by bondfilebot. Message ID: $messageId"

    Write-BackupLog "Repository backup completed successfully"
}
catch {
    Write-BackupLog (Protect-LogMessage -Message $_.Exception.Message -Uploader $telegramUploader) "ERROR"
    exit 1
}
finally {
    if (Test-Path -LiteralPath $stagingDirectory) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }
}
