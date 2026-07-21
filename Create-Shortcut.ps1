# Run this once to create a desktop shortcut
$RepoRoot = $PSScriptRoot
if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

function Get-LauncherExecutable {
    $pwsh = Get-Command pwsh.exe -ErrorAction SilentlyContinue
    if ($pwsh) {
        return $pwsh.Source
    }

    $powershell = Get-Command powershell.exe -ErrorAction SilentlyContinue
    if ($powershell) {
        return $powershell.Source
    }

    throw "Neither pwsh.exe nor powershell.exe was found on PATH."
}

function New-ShortcutArguments {
    param(
        [string]$ScriptPath
    )

    return "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
}

$WshShell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "Odoo MCP Server.lnk"
$shortcut = $WshShell.CreateShortcut($shortcutPath)
$launcherScript = Join-Path $RepoRoot "Start-MCP-Server.ps1"
$launcherExe = Get-LauncherExecutable

if (-not (Test-Path $launcherScript)) {
    throw "Missing launcher script: $launcherScript"
}

$shortcut.TargetPath = $launcherExe
$shortcut.Arguments = New-ShortcutArguments -ScriptPath $launcherScript

$shortcut.WorkingDirectory = $RepoRoot
$shortcut.Description = "Start Odoo Rust MCP Server and open the Config UI"

$iconPath = Join-Path $RepoRoot "assets\odoo-rust-mcp.ico"
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $RepoRoot "rust-mcp\target\release\odoo-rust-mcp.exe"
}
if (-not (Test-Path $iconPath)) {
    $iconPath = Join-Path $RepoRoot "odoo-rust-mcp.exe"
}
if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
} else {
    $shortcut.IconLocation = "shell32.dll,14"
}
$shortcut.WindowStyle = 7  # minimized / hidden

$shortcut.Save()

Write-Host "Shortcut created on Desktop: Odoo MCP Server.lnk" -ForegroundColor Green
Write-Host "Target: $($shortcut.TargetPath)" -ForegroundColor DarkGray
Write-Host "Double-click it to start the server and open the Config UI." -ForegroundColor Cyan
