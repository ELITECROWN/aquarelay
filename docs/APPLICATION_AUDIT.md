# Application audit — 10 October 2026

The production frontend returned 200. The public API initially returned 502;
the direct Render health request recovered after 45 seconds. Subsequent public
configuration, session, registry and organisation-directory requests returned
200. Anonymous access to the administrator summary returned 401 as expected.
No production accounts, reports, uploads or browser drafts were deleted.

## Fixed

Explore registry, map and selected passport queries did not consume the query
cancellation signal. An obsolete search could continue its 90-second recovery
after a user changed the search or left the screen. These queries and the
shared workflow record hook now forward the signal into the API client, which
cancels both the request and its retry wait. A browser regression reproduced
the stuck connection banner before the fix and passed afterward.

Report-search QA now asserts automatic recovery rather than expecting a retry
button within five seconds of a transient 502. Account-isolation QA uses a
non-transient server error to exercise the final failure path without waiting
for the cold-start budget. Browser QA is now included in GitHub Actions using
an isolated local database and storage directory.

## Verification

- Production build and 28 frontend unit tests passed.
- Backend: 140 passed, two skipped. The skips remain unverified coverage.
- All 35 browser scenarios passed across the main run and targeted reruns.
  The first main run had five failures: the two outdated assertions above,
  one end-to-end journey and two graphics checks. The latter three passed on
  fresh reruns; the run also recorded a browser-launch timeout. This is not
  evidence that every browser/environment will work without failures.
- Coverage includes map location and search, passports, imports, reports and
  evidence, scoped incident actions, notifications, sharing, offline drafts,
  owner OTP/admin records, cleanup confirmation, mobile layouts and failed
  graphics/storage/download recovery.

## Remaining operational limitation

Render Free still sleeps after inactivity. Client retries cannot remove that
hosting policy or guarantee delivery of background emails while the process is
asleep. An always-on backend is required for consistent startup and continuous
background processing. Live OTP/email/push delivery to real people was not
triggered during this audit; its local flows use test responses. Institutional
connectors need valid, authorised upstream credentials to work in production.
