@echo off
setlocal

echo Testing JIRA Hub backend health endpoint...
echo URL: http://localhost:5152/api/health
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:5152/api/health' -TimeoutSec 10; $r | ConvertTo-Json -Depth 5 } catch { Write-Host 'ERROR: Backend health check failed.'; Write-Host $_.Exception.Message; exit 1 }"

if errorlevel 1 (
    echo.
    echo Backend is not reachable. Make sure run-backend.cmd is open and running successfully.
    pause
    exit /b 1
)

echo.
echo Backend is reachable.
pause
