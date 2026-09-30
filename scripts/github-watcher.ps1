param(
    [int]$Interval = 10,
    [string]$Branch = "",
    [string]$RepoPath = (Join-Path $PSScriptRoot "..")
)

function Show-Toast {
    param([string]$Title, [string]$Message)
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$Title</text><text>$Message</text></binding></visual></toast>")
        $toast = New-Object Windows.UI.Notifications.ToastNotification($xml)
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("GitHub Watcher")
        $notifier.Show($toast)
    } catch { }
}

function Write-Log {
    param([string]$Msg, [string]$Color = "Cyan")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts] $Msg" -ForegroundColor $Color
}

function Get-RemoteCommit {
    param([string]$Br)
    $r = git ls-remote origin "refs/heads/$Br" 2>&1
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($r -split "\s+")[0]
}

function Get-LocalCommit {
    return (git rev-parse HEAD 2>&1).Trim()
}

Push-Location $RepoPath

if ($Branch -eq "") {
    $Branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()
    if ($Branch -eq "HEAD" -or $Branch -eq "") { $Branch = "main" }
}

Write-Host ""
Write-Host "  +------------------------------------------+" -ForegroundColor Magenta
Write-Host "  |      GitHub Auto-Sync Watcher            |" -ForegroundColor Magenta
Write-Host "  +------------------------------------------+" -ForegroundColor Magenta
Write-Host "  |  Repo  : Twolink-V2                      |" -ForegroundColor White
Write-Host "  |  Branch: $Branch" -ForegroundColor White
Write-Host "  |  Poll  : every $Interval seconds" -ForegroundColor White
Write-Host "  |  Press Ctrl+C to stop                    |" -ForegroundColor DarkGray
Write-Host "  +------------------------------------------+" -ForegroundColor Magenta
Write-Host ""

$firstRun = $true

while ($true) {
    try {
        git fetch origin $Branch --quiet 2>&1 | Out-Null

        $remoteCommit = Get-RemoteCommit -Br $Branch
        $localCommit  = Get-LocalCommit

        if ($null -eq $remoteCommit) {
            Write-Log "Could not reach GitHub. Retrying in $Interval s ..." "DarkYellow"
        }
        elseif ($firstRun) {
            Write-Log "Watching '$Branch' | HEAD: $($localCommit.Substring(0,8))" "Green"
            $firstRun = $false
        }
        elseif ($remoteCommit -ne $localCommit) {
            $short = $remoteCommit.Substring(0, 8)
            Write-Log "New commit: $short -- pulling ..." "Magenta"

            $prevLocal = $localCommit
            $out = git pull origin $Branch 2>&1
            $exitCode = $LASTEXITCODE

            if ($exitCode -eq 0) {
                $newLocal = Get-LocalCommit
                Write-Log "Sync done! HEAD is now $($newLocal.Substring(0,8))" "Green"
                Show-Toast -Title "Twolink-V2 synced" -Message "Pulled $short from $Branch"

                $changed = git diff --name-only $prevLocal HEAD 2>&1
                if ($changed -match "package\.json") {
                    Write-Log "package.json changed - run: npm install" "Yellow"
                    Show-Toast -Title "Dependencies changed" -Message "package.json modified. Run npm install."
                }
            }
            else {
                Write-Log "Pull failed!" "Red"
                $out | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
                Show-Toast -Title "Sync failed" -Message "git pull error. Check watcher console."
            }
        }
        else {
            Write-Log "No changes. HEAD: $($localCommit.Substring(0,8))" "DarkGray"
        }
    }
    catch {
        $errMsg = $_.ToString()
        Write-Log "Error: $errMsg" "Red"
    }

    Start-Sleep -Seconds $Interval
}
