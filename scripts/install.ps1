# Odoo Rust MCP Server Installer for Windows
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install.ps1

param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$Repo = "rachmataditiya/odoo-rust-mcp"
$BinaryName = "rust-mcp"
$InstallDir = "$env:ProgramFiles\odoo-rust-mcp"
$ConfigDir = "$env:ProgramData\odoo-rust-mcp"

function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

function Get-LatestVersion {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
    return $release.tag_name
}

function Install-OdooMcp {
    Write-Info "Detecting platform..."
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x86_64" } else { Write-Err "32-bit Windows not supported" }
    $platform = "$arch-pc-windows-msvc"
    Write-Info "Platform: $platform"

    Write-Info "Fetching latest release..."
    $version = Get-LatestVersion
    if (-not $version) { Write-Err "Could not determine latest version" }
    Write-Info "Version: $version"

    $downloadUrl = "https://github.com/$Repo/releases/download/$version/$BinaryName-$platform.zip"
    Write-Info "Download URL: $downloadUrl"

    $tmpDir = New-Item -ItemType Directory -Path "$env:TEMP\odoo-mcp-install-$(Get-Random)" -Force
    $zipPath = "$tmpDir\release.zip"

    try {
        Write-Info "Downloading..."
        Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing

        Write-Info "Extracting..."
        Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force

        Write-Info "Installing binary to $InstallDir..."
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        Copy-Item "$tmpDir\$BinaryName.exe" -Destination $InstallDir -Force

        Write-Info "Installing config files to $ConfigDir..."
        New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
        if (Test-Path "$tmpDir\config") {
            Copy-Item "$tmpDir\config\*" -Destination $ConfigDir -Recurse -Force
        }
        if (Test-Path "$tmpDir\.env.example") {
            Copy-Item "$tmpDir\.env.example" -Destination $ConfigDir -Force
        }

        # Add to PATH if not already there
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        if ($currentPath -notlike "*$InstallDir*") {
            Write-Info "Adding $InstallDir to system PATH..."
            [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", "Machine")
        }

        Write-Info "Installation complete!"
        Write-Host ""
        Write-Host "Binary installed to: $InstallDir\$BinaryName.exe"
        Write-Host "Config files installed to: $ConfigDir"
        Write-Host ""
        Write-Host "Quick start:"
        Write-Host "  1. Copy and edit the example environment file:"
        Write-Host "     Copy-Item '$ConfigDir\.env.example' '$env:USERPROFILE\.odoo-mcp.env'"
        Write-Host "     # Edit the file with your Odoo credentials"
        Write-Host ""
        Write-Host "  2. Run the server (open new terminal first for PATH update):"
        Write-Host "     $BinaryName --transport stdio"
        Write-Host ""
        Write-Host "  3. For Cursor, add to %APPDATA%\Cursor\User\globalStorage\cursor.mcp\mcp.json:"
        Write-Host '     {'
        Write-Host '       "mcpServers": {'
        Write-Host '         "odoo-rust-mcp": {'
        Write-Host '           "type": "stdio",'
        Write-Host "           `"command`": `"$InstallDir\$BinaryName.exe`","
        Write-Host '           "args": ["--transport", "stdio"],'
        Write-Host '           "env": {'
        Write-Host '             "ODOO_URL": "http://localhost:8069",'
        Write-Host '             "ODOO_DB": "mydb",'
        Write-Host '             "ODOO_API_KEY": "YOUR_API_KEY",'
        Write-Host "             `"MCP_TOOLS_JSON`": `"$ConfigDir\tools.json`","
        Write-Host "             `"MCP_PROMPTS_JSON`": `"$ConfigDir\prompts.json`","
        Write-Host "             `"MCP_SERVER_JSON`": `"$ConfigDir\server.json`""
        Write-Host '           }'
        Write-Host '         }'
        Write-Host '       }'
        Write-Host '     }'
    }
    finally {
        Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Uninstall-OdooMcp {
    Write-Info "Uninstalling odoo-rust-mcp..."

    if (Test-Path "$InstallDir\$BinaryName.exe") {
        Remove-Item "$InstallDir\$BinaryName.exe" -Force
        Write-Info "Removed $InstallDir\$BinaryName.exe"
    }

    # Remove from PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ($currentPath -like "*$InstallDir*") {
        $newPath = ($currentPath -split ';' | Where-Object { $_ -ne $InstallDir }) -join ';'
        [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
        Write-Info "Removed $InstallDir from system PATH"
    }

    if (Test-Path $InstallDir) {
        $items = Get-ChildItem $InstallDir
        if ($items.Count -eq 0) {
            Remove-Item $InstallDir -Force
            Write-Info "Removed empty directory $InstallDir"
        }
    }

    if (Test-Path $ConfigDir) {
        $response = Read-Host "Remove config directory $ConfigDir? [y/N]"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Remove-Item $ConfigDir -Recurse -Force
            Write-Info "Removed $ConfigDir"
        }
    }

    Write-Info "Uninstall complete!"
}

# Check for admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Err "This script requires Administrator privileges. Please run as Administrator."
}

if ($Uninstall) {
    Uninstall-OdooMcp
} else {
    Install-OdooMcp
}
