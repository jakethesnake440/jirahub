@echo off
setlocal
cd /d "%~dp0backend\JiraHub.Api"

echo ==========================================
echo JIRA Hub Backend Startup
echo ==========================================
echo Current folder: %CD%
echo.

echo Verifying SQL connection string being used from appsettings.json...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$j=Get-Content '.\appsettings.json' -Raw | ConvertFrom-Json; Write-Host $j.ConnectionStrings.DefaultConnection"
echo.

where dotnet >nul 2>nul
if errorlevel 1 (
    echo ERROR: dotnet was not found in PATH.
    echo Install the .NET 8 SDK, then open a new Command Prompt and try again.
    pause
    exit /b 1
)

echo .NET runtimes:
dotnet --list-runtimes
echo.

echo Restoring backend dependencies...
dotnet restore
if errorlevel 1 (
    echo ERROR: dotnet restore failed.
    pause
    exit /b 1
)

echo.
echo Starting JIRA Hub backend on http://localhost:5152
echo Leave this window open.
echo.
dotnet run --launch-profile http

echo.
echo Backend stopped or failed.
pause
