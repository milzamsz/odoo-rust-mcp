# Desktop Dev Helper
# Runs the Tauri app in development mode with the sidecar server.
#
# Prerequisites:
#   - rust-mcp release binary must exist (will be copied to sidecar location)
#   - desktop npm deps must be installed (npm ci)
#
# This runs `tauri dev` which:
#   1. Starts the Config UI server on port 3008
#   2. Spawns the sidecar (odoo-rust-mcp.exe) with MCP HTTP on 8787
#   3. Opens the Tauri webview pointing to http://127.0.0.1:3008

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$DesktopDir = "$Root\desktop"
$TauriDir = "$DesktopDir\src-tauri"
$RustRelease = "$Root\rust-mcp\target\release\odoo-rust-mcp.exe"
$SidecarTarget = "$TauriDir\binaries\odoo-rust-mcp-x86_64-pc-windows-msvc.exe"

# Ensure sidecar binary exists
if (-not (Test-Path $SidecarTarget)) {
    if (Test-Path $RustRelease) {
        Write-Host "[desktop-dev] Copying sidecar binary..."
        Copy-Item $RustRelease $SidecarTarget -Force
    } else {
        Write-Host "[desktop-dev] Building rust-mcp release first..."
        cargo build --release --manifest-path "$Root\rust-mcp\Cargo.toml"
        Copy-Item $RustRelease $SidecarTarget -Force
    }
}

# Copy static UI and docs resources to src-tauri so they are bundled
Write-Host "[desktop-dev] Copying frontend static files and docs..."
$StaticSrc = "$Root\rust-mcp\static\dist"
$StaticDest = "$TauriDir\static\dist"
if (Test-Path $StaticDest) {
    Remove-Item $StaticDest -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $StaticDest | Out-Null
if (Test-Path $StaticSrc) {
    Copy-Item "$StaticSrc\*" $StaticDest -Recurse -Force
}

$DocsSrc = "$Root\docs\book"
$DocsDest = "$TauriDir\docs\book"
if (Test-Path $DocsDest) {
    Remove-Item $DocsDest -Recurse -Force
}
if (Test-Path $DocsSrc) {
    New-Item -ItemType Directory -Force -Path $DocsDest | Out-Null
    Copy-Item "$DocsSrc\*" $DocsDest -Recurse -Force
}

Write-Host "[desktop-dev] Starting Tauri dev server..."
Push-Location $DesktopDir
cargo tauri dev
Pop-Location
