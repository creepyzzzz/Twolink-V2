@echo off
:: ============================================================
::  start-watcher.bat
::  Double-click this file to start the GitHub auto-sync watcher
::  in a dedicated PowerShell window.
:: ============================================================

title GitHub Auto-Sync Watcher - Twolink-V2

:: Change to the repo root so git commands work
cd /d "%~dp0.."

:: Launch watcher in the SAME window (Ctrl+C to stop)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0github-watcher.ps1"

pause
