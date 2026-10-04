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

Production administration is reserved for `dibyendukoley50@gmail.com`.
Enter that address on the sign-in page, click **Send verification code** and
complete the email OTP verification. No password or separate registration is
required for the owner. Other users retain password sign-in and registration.
If another account is already signed in, open `/login?admin=1` to verify the
owner account. Successful administrator verification opens `/admin`, which
contains searchable, paginated saved records and a link to the cleanup tool.
Only successful verification grants the owner the administrator role. Other
accounts are denied by every platform administration endpoint, even if an older
database entry gives them an administrator role. Local demonstration mode keeps
its separate test administrators; keep `DEMO_MODE=false` on Render.

After deploying this policy, sign out and sign in again with the owner address
to verify ownership and receive the admin links. No bootstrap password is needed.
