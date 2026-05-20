$ErrorActionPreference = "Stop"
$AppDir = Join-Path $PSScriptRoot "frontend\jirahub.client"
Set-Location $AppDir

Write-Host "=========================================="
Write-Host "JIRA Hub Frontend Startup"
Write-Host "=========================================="
Write-Host "Current folder: $PWD"
Write-Host "This PowerShell window will stay open after failures."
Write-Host ""

try {
    Write-Host "Checking Node/npm..."
    node -v
    npm -v
    Write-Host ""

    Write-Host "Forcing npm to use the public npm registry..."
    npm config set registry https://registry.npmjs.org/
    npm config get registry
    Write-Host ""

    if (Test-Path "package-lock.json") {
        Write-Host "Patching package-lock registry URLs if needed..."
        $content = Get-Content "package-lock.json" -Raw
        $content = $content -replace "https://packages\.applied-caas-gateway1\.internal\.api\.openai\.org/artifactory/api/npm/npm-public/", "https://registry.npmjs.org/"
        Set-Content "package-lock.json" $content -Encoding UTF8
        Write-Host ""
    }

    Write-Host "Installing/updating frontend dependencies..."
    npm install --registry=https://registry.npmjs.org/
    Write-Host ""

    Write-Host "Starting frontend at http://localhost:5173"
    Write-Host "Leave this window open."
    npm run dev -- --host 127.0.0.1 --port 5173
}
catch {
    Write-Host ""
    Write-Host "Frontend startup failed:"
    Write-Host $_
}
finally {
    Write-Host ""
    Read-Host "Press Enter to close"
}
