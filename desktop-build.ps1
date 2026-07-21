# Desktop Build Helper
# Copies the release binary to the Tauri sidecar location, then builds the desktop app.
#
# Usage:
#   .\desktop-build.ps1          # full production build (release)
#   .\desktop-build.ps1 -Dev     # quick compile check only (no Tauri bundle)

param(
    [switch]$Dev
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$DesktopDir = "$Root\desktop"
$TauriDir = "$DesktopDir\src-tauri"
$RustRelease = "$Root\rust-mcp\target\release\odoo-rust-mcp.exe"
$SidecarTarget = "$TauriDir\binaries\odoo-rust-mcp-desktop-server-x86_64-pc-windows-msvc.exe"

# Step 1: Ensure the release binary is built and copied to the sidecar location
Write-Host "[desktop-build] Building rust-mcp release binary (incremental)..."
cargo build --release --manifest-path "$Root\rust-mcp\Cargo.toml"
if (-not (Test-Path $RustRelease)) {
    Write-Error "Failed to build rust-mcp release binary."
    exit 1
}
Write-Host "[desktop-build] Copying sidecar binary..."
Copy-Item $RustRelease $SidecarTarget -Force
Write-Host "[desktop-build] Sidecar binary ready at $SidecarTarget"

# Step 2: Install npm dependencies for the desktop frontend
Write-Host "[desktop-build] Installing desktop dependencies..."
Push-Location $DesktopDir
npm install
Pop-Location

# Step 2.5: Copy static UI and docs resources to src-tauri so they are bundled
Write-Host "[desktop-build] Copying frontend static files and docs..."
$StaticSrc = "$Root\rust-mcp\static\dist"
$StaticDest = "$TauriDir\static\dist"
if (Test-Path $StaticDest) {
    Remove-Item $StaticDest -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $StaticDest | Out-Null
if (Test-Path $StaticSrc) {
    Copy-Item "$StaticSrc\*" $StaticDest -Recurse -Force
} else {
    Write-Warning "Static source $StaticSrc does not exist. Please run npm run build inside config-ui first."
}

Write-Host "[desktop-build] Checking/building mdBook documentation..."
$DocsSrc = "$Root\docs\book"
$DocsDest = "$TauriDir\docs\book"

try {
    Push-Location $Root
    if (Get-Command mdbook -ErrorAction SilentlyContinue) {
        Write-Host "[desktop-build] Running 'mdbook build docs'..."
        mdbook build docs
    } else {
        Write-Warning "mdBook is not installed. Using existing docs if present."
    }
    Pop-Location
} catch {
    Write-Warning "Failed to run mdbook build. Using existing docs if present."
    Pop-Location
}

if (Test-Path $DocsDest) {
    Remove-Item $DocsDest -Recurse -Force
}
if (Test-Path $DocsSrc) {
    New-Item -ItemType Directory -Force -Path $DocsDest | Out-Null
    Copy-Item "$DocsSrc\*" $DocsDest -Recurse -Force
    Write-Host "[desktop-build] Documentation copied successfully."
} else {
    Write-Warning "No built documentation found at $DocsSrc. App docs will be unavailable."
}

# Step 3: Build or check the desktop crate
if ($Dev) {
    Write-Host "[desktop-build] Running cargo check on desktop crate..."
    Push-Location $TauriDir
    cargo check
    Pop-Location
} else {
    Write-Host "[desktop-build] Building desktop Tauri app..."
    Push-Location $DesktopDir
    cargo tauri build
    Pop-Location
}

Write-Host "[desktop-build] Done."
