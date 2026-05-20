# JIRA Hub v1.1.6 changes

- Dashboard In Process card now opens Search filtered to in-process tickets and sorted by latest updated first.
- Dashboard With Comments card now opens Search filtered to tickets with comments and sorted by latest updated first.
- Comments can now be edited or deleted by the posting user. ADMIN users can edit/delete any comment for testing/admin cleanup.
- Search filters now support multiple selected platforms, functionalities, build fixed values, and version found values.
- Added result sorting options: relevance/newest, updated date, imported date, build natural sort, ticket key, comment count, platform, and functionality.
- Build fixed values in search results and filters now normalize version builds like `25.1.9.1000` to `25.1.9`.
- Full ticket detail still displays the original full build value from the import.
- Build sorting now handles numeric segments naturally, so `25.1.10` sorts after `25.1.9`.
- Build/version filter lists place values older than major build 21 at the end.
- Preserved the SQL Express connection string: `Server=localhost\\SQLEXPRESS03;Database=JiraHubDb;...`.


## v2 Linux UI Integration Patch

- Restored the full prior JIRA Hub UI instead of the placeholder React shell.
- Restored all theme tokens and visual styling from the previous test app.
- Added login, first-login password change, and logout into the prior UI shell.
- Preserved Docker/PostgreSQL deployment structure.
- Re-added full metadata, search, ticket detail, comment, user, and import API endpoints to the Linux backend.
- Added authenticated same-origin `/api` requests from the frontend.
- Added PostgreSQL-friendly case-insensitive search using `ILIKE`.
- Preserved build normalization and numeric build sorting behavior from v1.1.6.
