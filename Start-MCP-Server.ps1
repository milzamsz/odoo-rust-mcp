# Odoo Rust MCP Server - Startup Script
# Double-click Start-MCP-Server.bat to rebuild when needed, restart the server, and open the Config UI.

Add-Type -AssemblyName System.Windows.Forms

$RepoRoot = $PSScriptRoot
$ServerExe = Join-Path $RepoRoot "rust-mcp\target\release\rust-mcp.exe"
$WorkingDir = Join-Path $RepoRoot "rust-mcp"
$CargoManifest = Join-Path $RepoRoot "rust-mcp\Cargo.toml"
$Transport = "http"
$ListenHost = "127.0.0.1"
$ListenPort = 8787
$ConfigUiPort = 3008
$ConfigUiUrl = "http://$ListenHost`:$ConfigUiPort"
$StartupTimeoutSeconds = 20
$LogDir = Join-Path $RepoRoot ".codex-run"
$BuildStdoutLog = Join-Path $LogDir "shortcut-build.out.log"
$BuildStderrLog = Join-Path $LogDir "shortcut-build.err.log"
$BuildInputs = @(
    (Join-Path $RepoRoot "rust-mcp\src"),
    (Join-Path $RepoRoot "rust-mcp\Cargo.toml"),
    (Join-Path $RepoRoot "rust-mcp\build.rs"),
    (Join-Path $RepoRoot "Cargo.lock"),
    (Join-Path $RepoRoot "config-ui\src"),
    (Join-Path $RepoRoot "config-ui\package.json"),
    (Join-Path $RepoRoot "config-ui\package-lock.json")
)

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
    $running = Get-Process rust-mcp -ErrorAction SilentlyContinue

    if ($running) {
        $running | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
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
        $portOpen = Test-NetConnection -ComputerName $ComputerName -Port $Port -WarningAction SilentlyContinue |
            Select-Object -ExpandProperty TcpTestSucceeded
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

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
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

function Ensure-ReleaseBinaryCurrent {
    param(
        [string]$ExecutablePath,
        [string]$ManifestPath,
        [string[]]$InputPaths
    )

    $cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue
    if (-not $cargoCommand) {
        Show-Dialog `
            -Title "MCP Server Build Error" `
            -Icon ([System.Windows.Forms.MessageBoxIcon]::Error) `
            -Message "Cargo was not found on PATH.`n`nInstall Rust/Cargo or build the release binary manually before launching the MCP server."
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
}

if (-not (Ensure-ReleaseBinaryCurrent -ExecutablePath $ServerExe -ManifestPath $CargoManifest -InputPaths $BuildInputs)) {
    exit 1
}

Stop-ExistingServer
[void](Wait-ForPortState -ComputerName $ListenHost -Port $ConfigUiPort -ShouldBeOpen $false -TimeoutSeconds 8)
[void](Wait-ForPortState -ComputerName $ListenHost -Port $ListenPort -ShouldBeOpen $false -TimeoutSeconds 8)

$proc = Start-Process -FilePath $ServerExe `
    -ArgumentList @(
        "--transport", $Transport,
        "--listen", "$ListenHost`:$ListenPort",
        "--config-server-port", "$ConfigUiPort"
    ) `
    -WorkingDirectory $WorkingDir `
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
    Start-Process $ConfigUiUrl
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
    -Message "MCP server started but the Config UI did not become ready within $StartupTimeoutSeconds seconds.`nURL:`n$ConfigUiUrl"
exit 1
