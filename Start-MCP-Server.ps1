# Odoo Rust MCP Server - Startup Script
# Double-click Start-MCP-Server.bat to run this hidden

$ServerExe  = "$PSScriptRoot\rust-mcp\target\release\rust-mcp.exe"
$WorkingDir = "$PSScriptRoot\rust-mcp"
$Transport  = "http"
$Listen     = "127.0.0.1:8787"
$ConfigUI   = "http://127.0.0.1:3008"

# Kill any existing instance
Get-Process | Where-Object { $_.Path -eq $ServerExe } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# Start server
$proc = Start-Process -FilePath $ServerExe `
    -ArgumentList "--transport $Transport --listen $Listen" `
    -WorkingDirectory $WorkingDir `
    -WindowStyle Hidden `
    -PassThru

# Wait briefly then open browser
Start-Sleep -Seconds 2

if ($proc -and -not $proc.HasExited) {
    Start-Process $ConfigUI
} else {
    [System.Windows.Forms.MessageBox]::Show(
        "Failed to start MCP server. Check that the binary exists at:`n$ServerExe",
        "MCP Server Error",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    )
}
