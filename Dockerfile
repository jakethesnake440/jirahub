FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/jirahub.client/package*.json ./
RUN npm ci
COPY frontend/jirahub.client/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /app/backend
COPY backend/JiraHub.Api/*.csproj ./
RUN dotnet restore
COPY backend/JiraHub.Api/ ./
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/frontend/dist ./wwwroot
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENTRYPOINT ["dotnet", "JiraHub.Api.dll"]