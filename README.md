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

## UI/theme integration build

This package merges the prior JIRA Hub v1.1.6 UI/theme/search/comment experience into the Linux/Docker deployment version.

Included:

- Full DataBank-inspired light and dark themes plus enterprise light and midnight dark.
- Dashboard, searchable ticket list, ticket detail panel, comments, edit/delete comment controls, and admin import/user management UI.
- JWT login with default first admin: `admin` / `Password@123`.
- New users created in Admin start with `Password@123` and must change the password on first login.
- PostgreSQL backend for Docker deployment.
- Same-origin `/api` frontend calls for Docker/Nginx deployment.

Deploy with:

```bash
docker compose up -d --build
```

Then open:

```text
http://<server-ip>:5152
```

Use a strong `DB_PASSWORD` and `JWT_KEY` in `.env` before deploying beyond local testing.


## Docker build notes

The frontend build uses the public npm registry and `npm ci` so dependency installs are repeatable. The first build can still take several minutes on a small AWS instance or slow network, but later builds should be faster because Docker caches the dependency layers.

Useful commands:

```bash
docker compose build --progress=plain jirahub
docker compose up -d
```

If the build ever appears stuck on npm dependency installation, confirm the lock file is using the public npm registry:

```bash
grep -R "applied-caas\|internal.api.openai" frontend/jirahub.client/package-lock.json
```

That command should return no results.
