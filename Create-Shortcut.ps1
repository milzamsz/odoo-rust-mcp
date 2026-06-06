# Run this once to create a desktop shortcut
$RepoRoot = $PSScriptRoot
if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

$WshShell  = New-Object -ComObject WScript.Shell
$desktop   = [Environment]::GetFolderPath('Desktop')
$Shortcut  = $WshShell.CreateShortcut("$desktop\Odoo MCP Server.lnk")

# Point TargetPath to local powershell.exe if on UNC/WSL path to bypass security warnings,
# or directly to Start-MCP-Server.bat if on a local drive.
if ($RepoRoot.StartsWith("\\")) {
    $Shortcut.TargetPath       = "powershell.exe"
    $Shortcut.Arguments        = "-ExecutionPolicy Bypass -WindowStyle Hidden -Command `"`$RepoRoot = '$RepoRoot'; Get-Content `"`$RepoRoot\Start-MCP-Server.ps1`" -Raw | Invoke-Expression`""
} else {
    $Shortcut.TargetPath       = Join-Path $RepoRoot "Start-MCP-Server.bat"
}
$Shortcut.WorkingDirectory = $RepoRoot
$Shortcut.Description      = "Start Odoo Rust MCP Server"

# Resolve Icon location
$IconPath = Join-Path $RepoRoot "rust-mcp\target\release\rust-mcp.exe"
if (-not (Test-Path $IconPath)) {
    $IconPath = Join-Path $RepoRoot "rust-mcp.exe"
}
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
} else {
    $Shortcut.IconLocation = "shell32.dll,14"
}
$Shortcut.WindowStyle      = 7  # minimized / hidden

$Shortcut.Save()

Write-Host "Shortcut created on Desktop: Odoo MCP Server.lnk" -ForegroundColor Green
Write-Host "Double-click it to start the server and open the config UI." -ForegroundColor Cyan
