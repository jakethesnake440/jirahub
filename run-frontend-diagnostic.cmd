@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "APPDIR=%ROOT%frontend\jirahub.client"
set "LOGDIR=%ROOT%logs"
set "LOGFILE=%LOGDIR%\frontend-startup.log"

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

if not exist "%APPDIR%\package.json" (
    echo ERROR: package.json was not found. > "%LOGFILE%"
    echo Expected folder: %APPDIR% >> "%LOGFILE%"
    type "%LOGFILE%"
    pause
    exit /b 1
)

cd /d "%APPDIR%"

echo ==========================================
echo JIRA Hub Frontend Diagnostic Startup
echo ==========================================
echo Writing log to:
echo %LOGFILE%
echo.
echo If this starts successfully, open http://localhost:5173
echo Leave this window open.
echo.

(
    echo ==========================================
    echo JIRA Hub Frontend Diagnostic Startup
    echo ==========================================
    echo Date/time: %DATE% %TIME%
    echo Root: %ROOT%
    echo AppDir: %APPDIR%
    echo Current folder: %CD%
    echo.
    echo Checking Node.js...
    where node
    node -v
    echo.
    echo Checking npm...
    where npm
    npm -v
    echo.
    echo Forcing npm to use the public npm registry...
    call npm config set registry https://registry.npmjs.org/
    call npm config get registry
    echo.
    echo Patching package-lock registry URLs if needed...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path package-lock.json) { $p = 'package-lock.json'; $s = Get-Content $p -Raw; $s = $s -replace 'https://packages\.applied-caas-gateway1\.internal\.api\.openai\.org/artifactory/api/npm/npm-public/', 'https://registry.npmjs.org/'; Set-Content $p $s -Encoding UTF8 }"
    echo.
    echo package.json contents:
    type package.json
    echo.
    echo Installing/updating dependencies...
    call npm install --registry=https://registry.npmjs.org/
    echo.
    echo Starting Vite frontend on http://localhost:5173 ...
    call npm run dev -- --host 127.0.0.1 --port 5173
    echo.
    echo npm run dev exited with errorlevel %ERRORLEVEL%.
) >> "%LOGFILE%" 2>&1

echo.
echo Frontend stopped or failed. Log contents:
echo ------------------------------------------
type "%LOGFILE%"
echo ------------------------------------------
pause
