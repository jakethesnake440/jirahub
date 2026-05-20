@echo off
setlocal
cd /d "%~dp0backend\JiraHub.Api"
echo ==========================================
echo JIRA Hub AppSettings Verification
echo ==========================================
echo File: %CD%\appsettings.json
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$j=Get-Content '.\appsettings.json' -Raw | ConvertFrom-Json; Write-Host 'appsettings.json DefaultConnection:'; Write-Host $j.ConnectionStrings.DefaultConnection; Write-Host ''; $d=Get-Content '.\appsettings.Development.json' -Raw | ConvertFrom-Json; Write-Host 'appsettings.Development.json DefaultConnection:'; Write-Host $d.ConnectionStrings.DefaultConnection"
echo.
pause
