# Prototype cleanup

Sign in as a platform administrator and open `/admin/cleanup`, or use the
Prototype data cleanup tile in the organisation workspace.

1. Select uploads, reports with uploads, or citizen accounts with reports and uploads.
2. Preview the exact counts. Save any records you need before continuing.
3. Type `DELETE PROTOTYPE DATA` and press the permanent deletion button.
4. Wait for storage deletion jobs to finish. If any fail, use Retry failed file deletions.

Water-body registry, authority directory, imported monitoring datasets,
organisation members and administrator accounts remain. Report cleanup removes
all incident response history, including organisation actions. Account cleanup
removes only citizen accounts without organisation memberships. This is a
global prototype reset, not a per-user deletion tool. Browser drafts on other
devices are unaffected. Database deletion does not guarantee immediate cloud
quota reduction; provider accounting and retained backups may take time.

Previews expire after ten minutes, are bound to the administrator who created
them and can be used once. Changed records require a fresh preview. Existing
background work must finish before cleanup. File deletion uses the durable
outbox and never requires putting storage credentials in the browser.

If you have no administrator account, set these server environment variables
in Render and redeploy:

- `BOOTSTRAP_ADMIN_EMAIL`: a separate email that is not already registered
- `BOOTSTRAP_ADMIN_NAME`: your display name
- `BOOTSTRAP_ADMIN_PASSWORD`: a new password of at least 14 characters

After the administrator is created, remove the bootstrap variables. Sign in
with that account. Existing citizen accounts are deliberately not automatically
promoted. Never share the password or provider keys in chat.
