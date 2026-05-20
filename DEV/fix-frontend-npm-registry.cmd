@echo off
setlocal EnableExtensions

set "APPDIR=%~dp0frontend\jirahub.client"

if not exist "%APPDIR%\package.json" (
    echo ERROR: package.json was not found.
    echo Expected folder: %APPDIR%
    pause
    exit /b 1
)

cd /d "%APPDIR%"

echo ==========================================
echo JIRA Hub Frontend npm Registry Fix
echo ==========================================
echo Current folder: %CD%
echo.
echo This fixes package-lock files that were generated with an inaccessible internal registry.
echo.

echo Setting npm registry to public npm registry...
call npm config set registry https://registry.npmjs.org/
call npm config get registry

echo.
echo Patching package-lock.json if it exists...
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path package-lock.json) { $p = 'package-lock.json'; $s = Get-Content $p -Raw; $s = $s -replace 'https://packages\.applied-caas-gateway1\.internal\.api\.openai\.org/artifactory/api/npm/npm-public/', 'https://registry.npmjs.org/'; Set-Content $p $s -Encoding UTF8; Write-Host 'package-lock.json patched.' } else { Write-Host 'No package-lock.json found.' }"

echo.
echo Optional cleanup: removing node_modules can fix EPERM/stale dependency issues.
set /p CLEAN="Remove node_modules and reinstall dependencies now? (Y/N): "
if /I "%CLEAN%"=="Y" (
    echo.
    echo Removing node_modules...
    if exist node_modules rmdir /s /q node_modules
    echo.
    echo Running npm install...
    call npm install --registry=https://registry.npmjs.org/
)

echo.
echo Done. Now run run-frontend.cmd from the JIRAHub root folder.
pause
