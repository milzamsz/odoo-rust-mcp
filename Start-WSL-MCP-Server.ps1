# Start Odoo Rust MCP Server in WSL in background, and open Web UI
$ListenHost = "127.0.0.1"
$ListenPort = 8787
$ConfigUiPort = 3008
$ConfigUiUrl = "http://$ListenHost`:$ConfigUiPort"

# Determine the repository root path dynamically (either passed in $RepoRoot or from script location)
if (-not $RepoRoot) {
    $RepoRoot = $PSScriptRoot
}
if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

# Copy release binary from root to target/release if target/release is missing but root binary exists
$TargetReleaseDir = Join-Path $RepoRoot "rust-mcp\target\release"
$TargetExePath = Join-Path $TargetReleaseDir "rust-mcp.exe"
if (-not (Test-Path $TargetExePath)) {
    $RootExePath = Join-Path $RepoRoot "rust-mcp.exe"
    if (Test-Path $RootExePath) {
        New-Item -ItemType Directory -Force -Path $TargetReleaseDir | Out-Null
        Copy-Item $RootExePath -Destination $TargetExePath -Force
    }
}

# Resolve WSL distribution and Linux path dynamically from $RepoRoot
$Distro = "Ubuntu"
$LinuxPath = "/home/milzam/workspace/tools/mcp/odoo-rust-mcp" # Fallback

if ($RepoRoot -match '^\\\\wsl(?:\.localhost)?\\([^\\]+)\\(.*)$') {
    $Distro = $Matches[1]
    $LinuxPath = "/" + $Matches[2].Replace('\', '/')
}

# Resolve Windows User profile to construct correct /mnt path for instances.json
$WinHome = [System.Environment]::GetFolderPath('UserProfile')
$WslConfigJson = "/mnt/" + $WinHome.Substring(0, 1).ToLower() + $WinHome.Substring(2).Replace('\', '/') + "/.config/odoo-rust-mcp/instances.json"

Write-Host "Stopping any running Odoo Rust MCP servers..." -ForegroundColor Yellow
# Stop any local Windows processes first
Stop-Process -Name "rust-mcp" -Force -ErrorAction SilentlyContinue
# Stop any running processes within WSL
if ($null -ne (Get-Command wsl -ErrorAction SilentlyContinue)) {
    wsl -d $Distro pkill -f rust-mcp.exe 2>$null
}
Start-Sleep -Seconds 1

Write-Host "Starting Odoo Rust MCP Server inside WSL ($Distro)..." -ForegroundColor Green

# Ensure start.sh is executable inside WSL
wsl -d $Distro chmod +x "$LinuxPath/start.sh" 2>$null

# Start the WSL process in the background using Win32_Process.Create via CIM/WMI.
# This prevents wsl.exe from exiting immediately due to background shell session closing.
$commandLine = "wsl -d $Distro $LinuxPath/start.sh $WslConfigJson"
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine } | Out-Null

Write-Host "Waiting for Config Web UI to become ready on port $ConfigUiPort..." -ForegroundColor Cyan
$portActive = $false
for ($i = 0; $i -lt 30; $i++) {
    $connection = Test-NetConnection -ComputerName "127.0.0.1" -Port $ConfigUiPort -WarningAction SilentlyContinue
    if ($connection.TcpTestSucceeded) {
        $portActive = $true
        break
    }
    Start-Sleep -Milliseconds 500
}

if ($portActive) {
    Write-Host "Config Web UI is ready! Opening browser..." -ForegroundColor Green
    Start-Process $ConfigUiUrl
} else {
    Write-Error "Timeout waiting for Odoo Rust MCP Server to start on port $ConfigUiPort."
}
