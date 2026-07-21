# Odoo Rust MCP Server - Startup Script
# Double-click Start-MCP-Server.bat to rebuild when needed, restart the server, and open the Config UI.

Add-Type -AssemblyName System.Windows.Forms

$RepoRoot = $PSScriptRoot
$RepoReleaseExe = Join-Path $RepoRoot "rust-mcp\target\release\odoo-rust-mcp.exe"
$InstalledExe = Join-Path $RepoRoot "odoo-rust-mcp.exe"
$HasSourceLayout = Test-Path (Join-Path $RepoRoot "rust-mcp\Cargo.toml")
$ServerExe = if ($HasSourceLayout) { $RepoReleaseExe } else { $InstalledExe }

# If a repo checkout has a root binary but no target/release build yet, copy it into the repo release path.
if ($HasSourceLayout -and -not (Test-Path $ServerExe)) {
    if (Test-Path $InstalledExe) {
        $TargetDir = Split-Path -Parent $RepoReleaseExe
        New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
        Copy-Item $InstalledExe -Destination $RepoReleaseExe -Force
    }
}

$WorkingDir = if ($HasSourceLayout) { Join-Path $RepoRoot "rust-mcp" } else { $RepoRoot }
$CargoManifest = if ($HasSourceLayout) { Join-Path $RepoRoot "rust-mcp\Cargo.toml" } else { $null }
$Transport = "http"
$ListenHost = "127.0.0.1"
$ListenPort = 8787
$ConfigUiPort = 3008
$ConfigUiUrl = "http://$ListenHost`:$ConfigUiPort"
$StartupTimeoutSeconds = 60
$LogDir = Join-Path $RepoRoot ".codex-run"
$BuildStdoutLog = Join-Path $LogDir "shortcut-build.out.log"
$BuildStderrLog = Join-Path $LogDir "shortcut-build.err.log"
$ServerStdoutLog = Join-Path $LogDir "shortcut-server.out.log"
$ServerStderrLog = Join-Path $LogDir "shortcut-server.err.log"
$BuildLockPath = Join-Path $LogDir "shortcut-build.lock"
$BuildInputs = if ($HasSourceLayout) {
    @(
        (Join-Path $RepoRoot "rust-mcp\src"),
        (Join-Path $RepoRoot "rust-mcp\Cargo.toml"),
        (Join-Path $RepoRoot "rust-mcp\build.rs"),
        (Join-Path $RepoRoot "Cargo.lock"),
        (Join-Path $RepoRoot "config-ui\src"),
        (Join-Path $RepoRoot "config-ui\package.json"),
        (Join-Path $RepoRoot "config-ui\package-lock.json")
    )
} else {
    @()
}

function Show-Dialog {
    param(
        [string]$Message,
        [string]$Title,
        [System.Windows.Forms.MessageBoxIcon]$Icon
    )

    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        $Title,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        $Icon
    ) | Out-Null
}

function Stop-ExistingServer {
    $running = Get-Process odoo-rust-mcp -ErrorAction SilentlyContinue

    if ($running) {
        $running | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

function Test-PortOpen {
    param(
        [string]$ComputerName,
        [int]$Port
    )

    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($ComputerName, $Port, $null, $null)
        $connected = $iar.AsyncWaitHandle.WaitOne(1500, $false)
        if (-not $connected) {
            $client.Close()
            return $false
        }

        $client.EndConnect($iar)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-ForPortState {
    param(
        [string]$ComputerName,
        [int]$Port,
        [bool]$ShouldBeOpen,
        [int]$TimeoutSeconds = 10
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $portOpen = Test-PortOpen -ComputerName $ComputerName -Port $Port
        if ($portOpen -eq $ShouldBeOpen) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Wait-ForHttpReady {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 20
    )

    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            if ($curl) {
                & $curl.Source --silent --show-error --max-time 5 --head $Url | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    return $true
                }
            } else {
                $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
                if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                    return $true
                }
            }
        } catch {
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Get-LatestWriteTimeUtc {
    param(
        [string[]]$Paths
    )

    $latest = [datetime]::MinValue

    foreach ($path in $Paths) {
        if (-not (Test-Path $path)) {
            continue
        }

        $item = Get-Item $path -ErrorAction SilentlyContinue
        if (-not $item) {
            continue
        }

        if ($item.PSIsContainer) {
            $newestChild = Get-ChildItem $path -File -Recurse -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTimeUtc -Descending |
                Select-Object -First 1
            if ($newestChild -and $newestChild.LastWriteTimeUtc -gt $latest) {
                $latest = $newestChild.LastWriteTimeUtc
            }
        } elseif ($item.LastWriteTimeUtc -gt $latest) {
            $latest = $item.LastWriteTimeUtc
        }
    }

    return $latest
}

function Wait-ForHealthyUi {
    param(
        [int]$TimeoutSeconds = 6
    )

    return (Wait-ForPortState -ComputerName $ListenHost -Port $ConfigUiPort -ShouldBeOpen $true -TimeoutSeconds ([Math]::Max(1, [Math]::Min($TimeoutSeconds, 10)))) -and
        (Wait-ForHttpReady -Url $ConfigUiUrl -TimeoutSeconds $TimeoutSeconds)
}

function Invoke-WithBuildLock {
    param(
        [scriptblock]$Action,
        [int]$TimeoutSeconds = 600
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

        try {
            $lockHandle = [System.IO.File]::Open($BuildLockPath, 'OpenOrCreate', 'ReadWrite', 'None')
            try {
                return & $Action
            } finally {
                $lockHandle.Close()
                Remove-Item $BuildLockPath -Force -ErrorAction SilentlyContinue
            }
        } catch [System.IO.IOException] {
            if (Wait-ForHealthyUi -TimeoutSeconds 3) {
                return $true
            }
            Start-Sleep -Milliseconds 750
        }
    }

    Show-Dialog `
        -Title "MCP Server Build Timeout" `
        -Icon ([System.Windows.Forms.MessageBoxIcon]::Warning) `
        -Message "Another launcher is already rebuilding the MCP server and did not finish within $TimeoutSeconds seconds.`n`nBuild stdout: $BuildStdoutLog`nBuild stderr: $BuildStderrLog"
    return $false
}

function Ensure-ReleaseBinaryCurrent {
    param(
        [string]$ExecutablePath,
        [string]$ManifestPath,
        [string[]]$InputPaths
    )

    if (-not $ManifestPath) {
        if (Test-Path $ExecutablePath) {
            return $true
        }

        Show-Dialog `
            -Title "MCP Server Launch Error" `
            -Icon ([System.Windows.Forms.MessageBoxIcon]::Error) `
            -Message "The installed MCP launcher could not find odoo-rust-mcp.exe.`n`nExpected path:`n$ExecutablePath"
        return $false
    }

    $needsBuild = -not (Test-Path $ExecutablePath)

    if (-not $needsBuild) {
        $exeTime = (Get-Item $ExecutablePath).LastWriteTimeUtc
        $latestInputTime = Get-LatestWriteTimeUtc -Paths $InputPaths
        $needsBuild = $latestInputTime -gt $exeTime
    }

    if (-not $needsBuild) {
        return $true
    }

    $cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue
    if (-not $cargoCommand) {
        if (Test-Path $ExecutablePath) {
            Write-Host "Cargo not found on PATH, using existing compiled binary." -ForegroundColor Yellow
            return $true
        }
        Show-Dialog `
            -Title "MCP Server Build Error" `
            -Icon ([System.Windows.Forms.MessageBoxIcon]::Error) `
            -Message "Cargo was not found on PATH and no pre-compiled binary exists.`n`nInstall Rust/Cargo or build the release binary manually before launching the MCP server."
        return $false
    }

    if (-not $needsBuild) {
        return $true
    }

    return (Invoke-WithBuildLock -Action {
        if (Wait-ForHealthyUi -TimeoutSeconds 3) {
            return $true
        }

        $localNeedsBuild = -not (Test-Path $ExecutablePath)
        if (-not $localNeedsBuild) {
            $localExeTime = (Get-Item $ExecutablePath).LastWriteTimeUtc
            $localLatestInputTime = Get-LatestWriteTimeUtc -Paths $InputPaths
            $localNeedsBuild = $localLatestInputTime -gt $localExeTime
        }

        if (-not $localNeedsBuild) {
            return $true
        }

        Stop-ExistingServer

        New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
        if (Test-Path $BuildStdoutLog) {
            Remove-Item $BuildStdoutLog -Force
        }
        if (Test-Path $BuildStderrLog) {
            Remove-Item $BuildStderrLog -Force
        }

        $buildProcess = Start-Process `
            -FilePath $cargoCommand.Source `
            -ArgumentList @("build", "--release", "--manifest-path", $ManifestPath) `
            -WorkingDirectory $RepoRoot `
            -RedirectStandardOutput $BuildStdoutLog `
            -RedirectStandardError $BuildStderrLog `
            -WindowStyle Hidden `
            -Wait `
            -PassThru

        if ($buildProcess.ExitCode -ne 0 -or -not (Test-Path $ExecutablePath)) {
            Show-Dialog `
                -Title "MCP Server Build Error" `
                -Icon ([System.Windows.Forms.MessageBoxIcon]::Error) `
                -Message "Failed to build the release MCP server.`n`nStdout: $BuildStdoutLog`nStderr: $BuildStderrLog"
            return $false
        }

        return $true
    })
}

if (Wait-ForHealthyUi -TimeoutSeconds 4) {
    if (-not $env:MCP_NO_BROWSER) {
        Start-Process $ConfigUiUrl
    }
    exit 0
}

if (-not (Ensure-ReleaseBinaryCurrent -ExecutablePath $ServerExe -ManifestPath $CargoManifest -InputPaths $BuildInputs)) {
    exit 1
}

if (Wait-ForHealthyUi -TimeoutSeconds 4) {
    if (-not $env:MCP_NO_BROWSER) {
        Start-Process $ConfigUiUrl
    }
    exit 0
}

Stop-ExistingServer
[void](Wait-ForPortState -ComputerName $ListenHost -Port $ConfigUiPort -ShouldBeOpen $false -TimeoutSeconds 8)
[void](Wait-ForPortState -ComputerName $ListenHost -Port $ListenPort -ShouldBeOpen $false -TimeoutSeconds 8)

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
if (Test-Path $ServerStdoutLog) {
    Remove-Item $ServerStdoutLog -Force
}
if (Test-Path $ServerStderrLog) {
    Remove-Item $ServerStderrLog -Force
}

$proc = Start-Process -FilePath $ServerExe `
    -ArgumentList @(
        "--transport", $Transport,
        "--listen", "$ListenHost`:$ListenPort",
        "--config-server-port", "$ConfigUiPort"
    ) `
    -WorkingDirectory $WorkingDir `
    -RedirectStandardOutput $ServerStdoutLog `
    -RedirectStandardError $ServerStderrLog `
    -WindowStyle Hidden `
    -PassThru

if (-not $proc -or $proc.HasExited) {
    Show-Dialog `
        -Title "MCP Server Error" `
        -Icon ([System.Windows.Forms.MessageBoxIcon]::Error) `
        -Message "Failed to start MCP server process.`nExecutable:`n$ServerExe"
    exit 1
}

$ready = Wait-ForHttpReady -Url $ConfigUiUrl -TimeoutSeconds $StartupTimeoutSeconds
if ($ready) {
    if (-not $env:MCP_NO_BROWSER) {
        Start-Process $ConfigUiUrl
    }
    exit 0
}

try {
    if (-not $proc.HasExited) {
        $proc | Stop-Process -Force -ErrorAction SilentlyContinue
    }
} catch {
}

Show-Dialog `
    -Title "MCP Server Timeout" `
    -Icon ([System.Windows.Forms.MessageBoxIcon]::Warning) `
    -Message "MCP server started but the Config UI did not become ready within $StartupTimeoutSeconds seconds.`nURL:`n$ConfigUiUrl`n`nServer stdout: $ServerStdoutLog`nServer stderr: $ServerStderrLog"
exit 1
