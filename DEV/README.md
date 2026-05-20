# JIRA Hub DEV Build

This DEV package is the Linux/Docker/PostgreSQL version of JIRA Hub with the prior UI/theme system integrated.

## Current behavior

- `/` is the public main app.
- Dashboard, search, ticket detail, and adding comments are available without logging in.
- `/admin` is the admin console and requires an ADMIN login.
- Admin users can upload/import CSV files, manage users, view import history, and delete comments.
- Public comments support an optional username/email field labeled for follow-up.
- Ticket detail includes a Copy ticket details button that copies a clean text block for Notepad, Salesforce cases, or support notes.
- Public search includes ticket fields, imported internal comments, app comments, comment contact text, and mentions.

## Deploy

Create or update your `.env` from `.env.example`, then run:

```bash
docker compose down
docker compose up -d --build
```

Open the main app:

```text
http://<server-ip>:5152/
```

Open the admin console:

```text
http://<server-ip>:5152/admin
```

## Notes

- Use a strong `DB_PASSWORD` and `JWT_KEY` in `.env` before deploying beyond testing.
- The backend adds the new `CommentAuthorContact` column automatically for existing PostgreSQL containers.
- The frontend build uses the public npm registry and `npm ci` for repeatable Docker builds.


## Admin Access

The public app does not display an admin link. Browse directly to `/admin` to access the admin console.

## PostgreSQL Data Persistence

The Docker Compose file uses the explicit named Docker volume `jirahubdev_postgres_data`. Normal rebuilds with `docker compose up -d --build` keep the database. Avoid `docker compose down -v` unless you intentionally want to delete the database volume.
