# JIRA Hub v2 - Complete Package

This folder contains:
- Full backend with authentication (JWT + password change on first login)
- Frontend (React)
- Docker support for easy deployment on Lightsail

## Quick Start (Local)
1. Copy your full original frontend into `frontend/jirahub.client/` if missing.
2. Create `.env` from `.env.example`
3. Run `docker compose up -d --build`

## Deployment on Lightsail
See scripts/deploy-lightsail.sh and the main conversation for steps.