# JIRA Hub v1.1.7 - Login Security + Keyboard UX

## Changes

- Removed default admin username/password hint from the login page.
- Converted login and first-login password reset screens to real HTML forms.
- Enter now submits login and password change reliably.
- Added autocomplete metadata for username/current-password/new-password fields.
- Added autofocus to login and password reset forms.
- Search field now uses a form submit, so Enter forces an immediate search refresh.
- Escape clears the search field.
- Admin create-user area now submits on Enter.
- Comment composer now supports Ctrl+Enter / Cmd+Enter to post.
- Escape clears the new comment composer.
- Comment edit box now supports Ctrl+Enter / Cmd+Enter to save and Escape to cancel.
- Multi-filter search boxes support Escape to clear filter text.

## Notes

- Backend API/database code was not changed in this patch.
- Existing Docker/PostgreSQL deployment structure is preserved.
