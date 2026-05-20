# JIRA Hub DEV changes

## Public main app

- Removed login requirement from the main app.
- Dashboard, search, detail view, and comment posting are public at `/`.
- Admin login is separated to `/admin`.

## Admin console

- Admin functions now live behind `/admin`.
- Admin login and first-password-change screens are only shown on `/admin`.
- User management, CSV imports, and import history remain ADMIN-only.
- Comment delete is ADMIN-only.

## Comments

- Public comments can be posted without selecting a user.
- Added optional username/email contact field.
- UI text includes: `Add email for follow up on comment`.
- Comment search now includes the optional contact value.

## Ticket detail copy

- Added `Copy ticket details` button to the ticket detail panel.
- Copies a clean text block with ticket key, title, platform, functionality, version found, build fixed, dates, summary, and imported internal comments.

## Database compatibility

- Added `CommentAuthorContact` to the comment model.
- Startup now attempts to add the column automatically to existing PostgreSQL databases.
