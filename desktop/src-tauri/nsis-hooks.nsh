; Custom NSIS pre-install hook for Odoo Rust MCP
; Kills any running instances of the app and sidecar before files are written,
; so the installer never hits "Error opening file for writing".

!macro NSIS_HOOK_PREINSTALL
  ; Kill the main desktop launcher if running
  nsExec::ExecToStack 'taskkill /F /IM "odoo-rust-mcp-desktop.exe" /T'
  Pop $0
  Pop $1

  ; Kill the odoo-rust-mcp sidecar if running
  nsExec::ExecToStack 'taskkill /F /IM "odoo-rust-mcp.exe" /T'
  Pop $0
  Pop $1

  ; Short pause to let the OS release any remaining file handles
  Sleep 1000
!macroend
