# AquaRelay workflow UI verification

Checked on 2 October 2026. This report covers the workflow features owned by the workflow implementer; root verification reports the complete application, database and deployment checks separately.

## Connected product flows

- `/report` is an authenticated, four-step observation wizard: registered water body and adjustable position, timezone-aware observation time, original description and language, count or range, actual image/MP4 uploads, explicit related-case choice and final review. The success view uses report and case IDs acknowledged by the server. Synthetic places propagate their label into reports and exports.
- Related-case assistance uses the server's same-water-body/type, seven-day and one-kilometre rules. Each candidate displays its actual reasons. An explicitly selected case remains labelled as that choice. No candidate is automatically merged, and a closed case requires organisation review to reopen.
- IndexedDB stores account-scoped text and media drafts with stable client IDs. Pending and failed submissions can be retried explicitly. `OfflineDraftSync`, mounted once under the session provider, retries after reconnect on every route. The signed-in server account is checked before evidence and report mutations. Synced state requires a real server response. The service worker excludes API and media responses from its app-shell cache.
- `/incidents/:id` separates individual report review, case work, delivery and acknowledgement. Organisation members can record reasoned transitions, actions, public/private notes, evidence requests, individual report decisions and reviewed duplicate links/corrections. Closing requires the canonical outcome category, explanation, completion time and an actual evidence or action reference. Public sources, original report/case IDs and decision histories remain visible. Citizens can submit a reopening request or moderation report without changing case state themselves.
- `/workspace` presents assigned cases and organisation-scoped private notes. Public case pages display public notes only.
- `/integrations` and `/integrations/:id` expose real connector health, source/sync dates, attempted runs, retry history, mapping approval and polling configuration. Controlled source failure/recovery is available only for the labelled synthetic demo adapter.
- `/integrations/import` previews CSV/XLSX/JSON, preserves original rows, suggests editable field mappings and requires explicit units, timezone and identity decisions. Ambiguity is held with reasons. Approval is disabled with no admissible rows and requires a review checkbox. Existing approved connector mappings, units, timezone, parameter meanings and explicit water-body choice are reused for review; persisted runs restore their recorded settings and results.
- Standards downloads are actual server-generated JSON. Handoff capabilities are organisation-scoped; only available configured recipients can send. Institutional delivery uses the configured recipient directory and supported FHIR subset. Receipt status, explicit acknowledgement, retries, payload and scoped validation can be inspected separately. A local demo receiver is labelled as a demonstration service.
- Sharing generates real 1080 × 1080 and 1080 × 1920 PNGs from a mounted canvas, with canonical report review labels, source attribution, record date and snapshot date. Synthetic imagery and captions retain watermarks. Local links do not generate a public QR. Clipboard and native share errors are visible; opening a share sheet does not claim publication.

## Verification evidence

Fresh commands on 2 October 2026:

- `npm test`: 12 tests passed in three files. The offline tests exercise account isolation, stable replay identity, pending/failed/synced state, network failure, stopping on a changed server account and retaining uploaded evidence IDs plus media across an interrupted upload. Canonical share-label tests cover accepted review, mixed review and unavailable data.
- `npm run build`: TypeScript and Vite production build passed after institutional capability controls and the final PNG encoding fix were added.

The independent connected browser script, `scripts/verify-workflow-ui.mjs`, uses real sessions and the running API. Its completed baseline run verified responsive report pages at 390/768/1440 px, real report IDs and a preserved `5–10` estimate, actual evidence upload and served derivative, downloaded square/story PNG dimensions, mobile share dialog, blocked missing-unit import followed by successful corrected approval, individual report review, duplicate merge/correction and a citizen reopening request that preserves closed state.

The final frozen-source normal-database run used the real event stream and completed with exit code 0: **all 14 verification groups passed with no page errors**. It additionally verified candidate reasons using all location/time/type rules, the exact reused `temperature` field map with `degC`, pH `1` and `Asia/Kolkata`, an accepted individual-review label in the actual generated PNG, and the handoff capability guard plus persisted payload. Final case ID: `case-1d83d4adeba34d709ccc326a8bbf66d5`; report ID: `report-5c49b1c6c06c4cd7b8999d1670807bf2`. Import result: 3 imported, 0 rejected, 0 duplicate, 0 unresolved.

Earlier repeated runs exposed the server request limit during replay of accumulated public events. The root implementation now coalesces refreshes, retains a per-tab public cursor and schedules a trailing refresh for an overlapping query. Two complete normal-database runs passed after those repairs; the final run above includes the trailing-refresh change. The interrupted diagnostic runs are not counted as complete passes.

`scripts/verify-handoff-ui.mjs` passed against the real API with the documented polling fallback deliberately exercised by making the event stream unavailable. It verified the unavailable institutional option and server reason, explicit `local_demo` recipient, the persisted FHIR Bundle payload, delivery and the distinct `acknowledged: false` result. It also waited for the UI's polling update and inspected the latest delivered payload before capturing the screenshot. Final receipt ID: `rec-handoff-b5d7e5234aaa877a0c907011920ee0fe`. No data or mutation responses were mocked.

Screenshot and generated PNG evidence is stored under `docs/qa-workflow/`, including `share-reviewed.png`, `reused-mapping-390.png`, `related-candidates-390.png` and `handoff-capabilities-1440.png`. The screenshots use synthetic records and demonstration evidence, not ecological before/after claims. The canvas callback ref fixes Radix portal mount timing. Diagnostic traces also reproduced an Edge native `toBlob` callback that never completed; fixed-size cards now use native PNG `toDataURL` encoding converted to a real Blob, and primitive dependencies prevent unnecessary redraws. Real square/story downloads passed after that change.

## Practical limits

- Public MP4 derivatives are silent and strip metadata. The original file remains protected. Image derivatives strip EXIF.
- Local draft persistence depends on browser storage availability and quota. Synced local copies can be removed by their account owner.
- Native sharing depends on browser support and user interaction; posting to an external platform is outside the application's confirmation boundary.
- Institutional delivery remains unavailable until the server has a valid organisation recipient configuration. HTTP acceptance alone never establishes organisation acknowledgement. Standards exports claim only the documented structural subset checks.
- Root verification owns Docker/PostGIS startup and restart results. This workflow report does not claim Docker runtime verification.
