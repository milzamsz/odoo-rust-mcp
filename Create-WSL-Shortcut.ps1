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

$launcherScript = Join-Path $RepoRoot "Start-WSL-MCP-Server.ps1"
if (-not (Test-Path $launcherScript)) {
    throw "Missing launcher script: $launcherScript"
}

$WshShell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "Odoo WSL MCP Server.lnk"
$shortcut = $WshShell.CreateShortcut($shortcutPath)

$shortcut.TargetPath = Get-LauncherExecutable
$shortcut.Arguments = New-ShortcutArguments -ScriptPath $launcherScript
$shortcut.WorkingDirectory = $RepoRoot
$shortcut.Description = "Start Odoo Rust MCP Server in WSL and open the Config UI"
$iconPath = Join-Path $RepoRoot "assets\odoo-rust-mcp.ico"
if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
} else {
    $shortcut.IconLocation = "shell32.dll,14"
}
$shortcut.WindowStyle = 7  # minimized / hidden

$shortcut.Save()

Write-Host "Shortcut created on Desktop: Odoo WSL MCP Server.lnk" -ForegroundColor Green
Write-Host "Target: $($shortcut.TargetPath)" -ForegroundColor DarkGray
Write-Host "Double-click it to start the server in WSL and open the Config UI." -ForegroundColor Cyan
