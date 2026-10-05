# Startup and availability

The observed outage on 5 October 2026 was a Render free-service cold start:
the static frontend returned 200, API calls returned 502, and the direct health
request took about 34 seconds before the API recovered. Clearing browser caches
or deleting database records does not address this cause.

Read requests now allow up to 90 seconds of bounded recovery with progressively
longer delays. The interface shows connection progress. Session-dependent login
is disabled until the session handshake succeeds, with a retry control when it
fails. Mutations are never automatically replayed. Mobile devices skip the
decorative water renderer and pointer effects; the main scene bundle is loaded
only on suitable desktop devices. The hero video pauses outside the viewport.

Unit coverage includes a simulated 50-second startup. Browser coverage checks
recovery, disabled sign-in during startup, admin account switching, reduced mobile
graphics, blocked storage and graphics/download failures. GitHub Actions runs
frontend unit tests/build and isolated backend tests on pushes and pull requests.
These checks do not by themselves gate the current hosting auto-deploy settings.

For consistent response times, use an always-on backend instance. Render free
services intentionally sleep after inactivity and may take about a minute to
wake. A retry can handle a temporary startup, but cannot guarantee availability
during provider outages, resource exhaustion or an extended database failure.
See https://render.com/docs/free and https://render.com/pricing.

Before sharing a major update, confirm that the frontend deployment is ready,
the Render deployment is live, `/health` succeeds, and both sign-in and a
water-body request succeed through the public website. In Render, enable
deployment after CI checks pass when using the GitHub check workflow.
