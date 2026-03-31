@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo Launching auto-resume full model training (v28 recipe)...
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -File source\auto_resume_supermix_training.ps1
echo Auto-resume launcher started. Training will attach to the latest checkpoint if available.
timeout /t 2 >nul
exit /b 0
