# JIRA Hub multi-stage Docker build
# Frontend dependencies are installed before copying source so Docker can cache npm downloads between builds.

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
ENV npm_config_registry=https://registry.npmjs.org/ \
    npm_config_audit=false \
    npm_config_fund=false
COPY frontend/jirahub.client/package.json frontend/jirahub.client/package-lock.json ./
RUN npm ci --prefer-offline --no-audit --fund=false
COPY frontend/jirahub.client/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /app/backend
COPY backend/JiraHub.Api/*.csproj ./
RUN dotnet restore
COPY backend/JiraHub.Api/ ./
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/frontend/dist ./wwwroot
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENTRYPOINT ["dotnet", "JiraHub.Api.dll"]
