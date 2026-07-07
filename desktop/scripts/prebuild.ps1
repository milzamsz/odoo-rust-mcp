# Pre-build cleanup + UI sync script for Odoo Rust MCP Tauri installer

$ErrorActionPreference = 'SilentlyContinue'

# Kill running app processes
taskkill /F /IM "odoo-rust-mcp-desktop.exe" /T 2>&1 | Out-Null
taskkill /F /IM "rust-mcp.exe" /T 2>&1 | Out-Null

# PSScriptRoot = desktop/scripts  =>  ../.. = repo root
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")  -ErrorAction SilentlyContinue).Path
$uiSrc    = Join-Path $repoRoot "rust-mcp\static\dist"
$uiDst    = Join-Path $repoRoot "desktop\src-tauri\static\dist"

if (Test-Path $uiSrc) {
    Remove-Item -Recurse -Force $uiDst -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force $uiDst | Out-Null
    Copy-Item -Recurse -Force "$uiSrc\*" $uiDst
    $count = (Get-ChildItem "$uiDst\assets" -ErrorAction SilentlyContinue).Count
    Write-Host "UI assets synced: $count files from $uiSrc"
} else {
    Write-Host "UI source not found at $uiSrc - skipping sync"
}

# Remove stale installer outputs so Windows Defender won't hold them open
Remove-Item -Force -Path (Join-Path $PSScriptRoot "..\target\release\bundle\nsis\Odoo Rust MCP_*_x64-setup.exe") -ErrorAction SilentlyContinue
Remove-Item -Force -Path (Join-Path $PSScriptRoot "..\target\release\bundle\msi\Odoo Rust MCP_*_x64_en-US.msi") -ErrorAction SilentlyContinue

Start-Sleep -Milliseconds 800
Write-Host "Pre-build cleanup done."
