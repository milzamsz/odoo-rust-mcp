# Get the absolute path to this script's directory (works whether run locally or UNC)
$RepoRoot = $PSScriptRoot
if (-not $RepoRoot) {
    $RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

$WshShell  = New-Object -ComObject WScript.Shell
$desktop   = [Environment]::GetFolderPath('Desktop')
$Shortcut  = $WshShell.CreateShortcut("$desktop\Odoo WSL MCP Server.lnk")

# Point TargetPath to local powershell.exe to bypass UNC security warning prompts.
# We pass the pre-defined $RepoRoot variable so the script knows its location when invoked via Invoke-Expression.
$Shortcut.TargetPath       = "powershell.exe"
$Shortcut.Arguments        = "-ExecutionPolicy Bypass -WindowStyle Hidden -Command `"`$RepoRoot = '$RepoRoot'; Get-Content `"`$RepoRoot\Start-WSL-MCP-Server.ps1`" -Raw | Invoke-Expression`""
$Shortcut.WorkingDirectory = $RepoRoot
$Shortcut.Description      = "Start Odoo Rust MCP Server in WSL"
$Shortcut.IconLocation     = "shell32.dll,14"
$Shortcut.WindowStyle      = 7  # minimized / hidden

$Shortcut.Save()

Write-Host "Shortcut created on Desktop: Odoo WSL MCP Server.lnk" -ForegroundColor Green
Write-Host "Double-click the shortcut to start the server in WSL and open the Config Web UI." -ForegroundColor Cyan
