Set-Location "$PSScriptRoot\backend\JiraHub.Api"
dotnet restore
dotnet run --launch-profile http
