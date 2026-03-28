# Run this once to create a desktop shortcut
$WshShell  = New-Object -ComObject WScript.Shell
$desktop   = [Environment]::GetFolderPath('Desktop')
$Shortcut  = $WshShell.CreateShortcut("$desktop\Odoo MCP Server.lnk")

$Shortcut.TargetPath       = "C:\Projects\MCP\odoo-rust-mcp\Start-MCP-Server.bat"
$Shortcut.WorkingDirectory = "C:\Projects\MCP\odoo-rust-mcp"
$Shortcut.Description      = "Start Odoo Rust MCP Server"
$Shortcut.IconLocation     = "C:\Projects\MCP\odoo-rust-mcp\rust-mcp\target\release\rust-mcp.exe,0"
$Shortcut.WindowStyle      = 7  # minimized / hidden

$Shortcut.Save()

Write-Host "Shortcut created on Desktop: Odoo MCP Server.lnk" -ForegroundColor Green
Write-Host "Double-click it to start the server and open the config UI." -ForegroundColor Cyan
