@echo off
pushd "%~dp0"
powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "Start-WSL-MCP-Server.ps1"
popd
