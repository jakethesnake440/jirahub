@echo off
setlocal EnableExtensions

set "APPDIR=%~dp0frontend\jirahub.client"

if not exist "%APPDIR%\package.json" (
    echo ERROR: package.json was not found.
    echo Expected folder: %APPDIR%
    echo.
    pause
    exit /b 1
)

pushd "%APPDIR%"

echo ==========================================
echo JIRA Hub Frontend Startup
echo ==========================================
echo Current folder: %CD%
echo.
echo This window should stay open. If the frontend stops, the command prompt will remain open for review.
echo.

echo Opening persistent frontend command window...
echo.

cmd /k "echo JIRA Hub Frontend && echo. && echo Current folder: %CD% && echo. && echo Checking Node/npm... && where node && node -v && where npm && npm -v && echo. && echo Forcing npm to use the public npm registry... && npm config set registry https://registry.npmjs.org/ && npm config get registry && echo. && echo Patching package-lock registry URLs if needed... && powershell -NoProfile -ExecutionPolicy Bypass -Command \"if (Test-Path package-lock.json) { $p = 'package-lock.json'; $s = Get-Content $p -Raw; $s = $s -replace 'https://packages\.applied-caas-gateway1\.internal\.api\.openai\.org/artifactory/api/npm/npm-public/', 'https://registry.npmjs.org/'; Set-Content $p $s -Encoding UTF8 }\" && echo. && echo Installing/updating frontend dependencies... && npm install --registry=https://registry.npmjs.org/ && echo. && echo Starting frontend at http://localhost:5173 && echo Leave this window open. && echo. && npm run dev -- --host 127.0.0.1 --port 5173"

popd
