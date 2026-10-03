import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

// These journeys share one local server/IP, including multiple simultaneous
// sessions. Pace independent journeys within the real 240-request/minute limit.
let previousJourneyStarted = 0;
const interceptTiles=(context:BrowserContext)=>context.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')}));
test.beforeEach(async ({page}, info) => {
  // Automated QA must not request community-funded OSM tiles.
  await interceptTiles(page.context());
  const delay = Math.max(0, previousJourneyStarted + 33000 - Date.now());
  if (delay) {
    // Pacing is fixture setup; retain the full journey timeout after it.
    info.setTimeout(info.timeout + delay);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  previousJourneyStarted = Date.now();
});

test('real street-map configuration and device-location permission flow',async({page,context})=>{
 await context.grantPermissions(['geolocation']);await context.setGeolocation({latitude:12.9716,longitude:77.5946});
 await page.goto('/explore');await expect(page.locator('.maplibregl-canvas')).toBeVisible();
 await page.getByRole('button',{name:'Use my location',exact:true}).click();
 await expect(page.getByText(/Device location shown · accuracy approximately/)).toBeVisible();
 await expect(page.locator('[aria-label="Your approximate device location"]')).toBeVisible();
 await expect(page.locator('.maplibregl-ctrl-attrib').getByRole('link',{name:'OpenStreetMap contributors'})).toBeVisible();
});
async function login(page: Page, role = "citizen") {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${role}@demo.aquarelay.local`);
  await page.getByLabel("Password", { exact: true }).fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/explore/);
}
async function mutation(page: Page, url: string, body: any) {
  const session = await (await page.request.get("/api/v1/auth/session")).json();
  return page.request.post(`/api/v1${url}`, {
    headers: { "X-CSRF-Token": session.csrf_token },
    data: body,
  });
}

test("historical live-event bursts refresh once and resume after reload", async ({
  page,
}) => {
  let registryRequests = 0;
  const cursors: string[] = [];
  let releaseSnapshot!: () => void;
  const snapshotStarted = new Promise<void>((resolve) => {
    releaseSnapshot = resolve;
  });
  await page.route("**/api/v1/waterbodies?*", async (route) => {
    const initialSnapshot = registryRequests === 1;
    const snapshot = await route.fetch();
    const body = await snapshot.json();
    releaseSnapshot();
    if (initialSnapshot) {
      // Return a snapshot from before the event, after the invalidation timer.
      await new Promise((resolve) => setTimeout(resolve, 650));
      body.items = body.items.map((item: any) =>
        item.id === "wb-reedwater" ? { ...item, case_count: 99 } : item,
      );
    }
    await route.fulfill({ response: snapshot, json: body });
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/waterbodies")
      registryRequests++;
  });
  await page.route("**/api/v1/events/stream*", async (route) => {
    await snapshotStarted;
    const cursor =
      new URL(route.request().url()).searchParams.get("after") || "0";
    cursors.push(cursor);
    await route.fulfill({
      contentType: "text/event-stream",
      body:
        cursor === "0"
          ? Array.from(
              { length: 1000 },
              (_, i) =>
                `id: ${i + 1}\nevent: update\ndata: {"kind":"report"}\n\n`,
            ).join("")
          : ": heartbeat\n\n",
    });
  });
  await page.goto("/explore");
  await expect(page.getByText("7 registered water bodies")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        sessionStorage.getItem("aquarelay-public-event-cursor"),
      ),
    )
    .toBe("1000");
  await page.waitForTimeout(700);
  await expect(
    page
      .locator(".water-results")
      .getByRole("button", { name: /Demo Reedwater Lake.*99 open cases/ }),
  ).toHaveCount(0);
  expect(registryRequests).toBeGreaterThanOrEqual(2);
  expect(registryRequests).toBeLessThanOrEqual(3);
  await page.reload();
  await expect(page.getByText("7 registered water bodies")).toBeVisible();
  await expect.poll(() => cursors).toContain("1000");
});

test("an unavailable map chunk preserves the public records and navigation", async ({
  page,
}) => {
  await page.route("**/src/MapView.tsx*", (route) => route.abort("failed"));
  await page.goto("/explore");
  await expect(
    page.getByText("Map could not be loaded.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("7 registered water bodies")).toBeVisible();
  await page
    .locator(".water-results")
    .getByRole("button", { name: /Demo Reedwater Lake/ })
    .click();
  await expect(
    page.getByRole("link", { name: "Open water-body passport" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open water-body passport" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo Reedwater Lake", level:1 }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  await expect(
    page.getByText("Demo field observation notebook", { exact: true }),
  ).toBeVisible();
});

test("public map/list selection, history, sources and responsive navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/explore");
  await expect(page.getByText("7 registered water bodies")).toBeVisible();
  await expect(page.getByTestId("interactive-map")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  const canvas = page.locator(".maplibregl-canvas");
  const initial = await canvas.screenshot();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.waitForTimeout(550);
  expect(await canvas.screenshot()).not.toEqual(initial);
  await page
    .locator(".water-results")
    .getByRole("button", { name: /Demo Reedwater Lake/ })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Selected water body" }).getByRole("heading", { name: "Demo Reedwater Lake" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open water-body passport" }).click();
  await page.getByRole("tab", { name: "Incidents", exact: true }).click();
  await page
    .getByRole("link", { name: /Demo shoreline waste observation/ })
    .click();
  await expect(
    page.getByText("Demo shoreline cleanup documented", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Demo follow-up visit recorded", { exact: true }),
  ).toBeVisible();
  await page.goto("/waterbodies/wb-reedwater");
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  await expect(
    page.getByText("Demo field observation notebook", { exact: true }),
  ).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/explore");
    await expect(page.getByText("7 registered water bodies")).toBeVisible();
    await expect(
      page.locator(".map-place-label,.map-cluster-label").first(),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/explore-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTitle("Click to open menu").click();
  await page.getByRole("complementary", {name:"AquaRelay Navigation"}).getByRole("link",{name:"Following",exact:true}).click();
  await expect(
    page.getByRole("heading", { name: "Keep your waters close." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("golden journey: approved import, report/evidence, live flag, scoped response, notification, share and handoff", async ({
  browser,
  page,
}) => {
  test.setTimeout(120000); // Multiple accounts, uploads, workflow transitions and connector replay.
  await login(page, "manager");
  await page.goto("/integrations/import");
  await page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("fixtures/demo-ngo-missing-unit.xlsx"));
  await page.getByLabel("Dataset identity").fill(`browser-ngo-${Date.now()}`);
  await page.getByLabel('This file contains synthetic demonstration data').check();
  await page.getByRole("button", { name: "Preview source" }).click();
  await expect(
    page.getByRole("heading", { name: "Review field mappings" }),
  ).toBeVisible();
  await page.getByLabel("Source timezone").fill("Asia/Kolkata");
  await page.getByLabel(/^pH unit/).selectOption("1");
  await page
    .getByRole("button", { name: "Preview transformed records" })
    .click();
  await expect(
    page.getByText(/missing.*unit|unit.*missing/i).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit mapping" }).click();
  await page.getByLabel(/^Temperature unit/).selectOption("degC");
  await page
    .getByRole("button", { name: "Preview transformed records" })
    .click();
  await page
    .getByRole("checkbox", { name: /I reviewed the water-body/ })
    .check();
  await page.getByRole("button", { name: "Approve & import" }).click();
  await expect(
    page.getByRole("heading", { name: "Import processed" }),
  ).toBeVisible();
  await page.goto("/waterbodies/wb-reedwater");
  await page.getByRole("tab", { name: "Monitoring", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "24.5 Cel", exact: true }).first(),
  ).toBeVisible();
  const citizen = await browser.newContext();
  await interceptTiles(citizen);
  const contributor = await citizen.newPage();
  await login(contributor);
  await mutation(contributor, "/following/wb-reedwater", {});
  const watcher = await browser.newContext();
  await interceptTiles(watcher);
  const observer = await watcher.newPage();
  await observer.goto("/explore");
  const before = await (
    await observer.request.get("/api/v1/waterbodies?q=Reedwater")
  ).json();
  const count = before.items[0].case_count;
  await contributor.goto("/report?waterbody=wb-reedwater");
  await contributor
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await contributor
    .getByText("Dead or distressed fish", { exact: true })
    .click();
  await contributor
    .getByLabel("Describe what you saw")
    .fill(
      "Synthetic demo browser report: approximately 3–5 fish observed at the bank. Cause unknown.",
    );
  await contributor
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  const png = await contributor.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 160;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#DCE8ED";
    ctx.fillRect(0, 0, 320, 160);
    ctx.fillStyle = "#183B30";
    ctx.font = "20px sans-serif";
    ctx.fillText("SYNTHETIC DEMO EVIDENCE", 12, 80);
    return c.toDataURL("image/png").split(",")[1];
  });
  await contributor.locator("input[type=file]").setInputFiles({
    name: "synthetic-demo.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await contributor
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await contributor.getByRole("button", { name: "Submit observation" }).click();
  await expect(
    contributor.getByRole("heading", {
      name: "Your observation is on record.",
    }),
  ).toBeVisible();
  const caseId = (await contributor
    .locator(".wf-record-details dd")
    .nth(1)
    .textContent())!.trim();
  await expect(
    observer.locator(".water-results").getByRole("button", {
      name: new RegExp(`Demo Reedwater Lake.*${count + 1} open cases`),
    }),
  ).toBeVisible({ timeout: 10000 });
  await contributor.getByRole("link", { name: "View incident" }).click();
  await expect(contributor.locator(".wf-evidence-grid img")).toBeVisible();
  const evidenceUrl = await contributor
    .locator(".wf-evidence-grid img")
    .getAttribute("src");
  expect((await contributor.request.get(evidenceUrl!)).status()).toBe(200);
  const evidenceSession = await (
    await contributor.request.get("/api/v1/auth/session")
  ).json();
  const extraEvidence = await contributor.request.post("/api/v1/evidence", {
    headers: { "X-CSRF-Token": evidenceSession.csrf_token },
    multipart: {
      file: {
        name: "synthetic-related.png",
        mimeType: "image/png",
        buffer: Buffer.from(png, "base64"),
      },
      synthetic: "true",
      caption: "Synthetic additional shoreline evidence illustration",
    },
  });
  expect(extraEvidence.ok(), await extraEvidence.text()).toBe(true);
  const extraEvidenceId = (await extraEvidence.json()).id;
  const related = await mutation(contributor, "/reports", {
    client_id: `related-browser-${Date.now()}`,
    waterbody_id: "wb-reedwater",
    related_case_id: caseId,
    observation_type: "fish_mortality",
    observed_at: new Date().toISOString(),
    description:
      "Synthetic related observation: additional shoreline evidence; cause remains unknown.",
    evidence_ids: [extraEvidenceId],
    synthetic: true,
  });
  expect(related.ok(), await related.text()).toBe(true);
  expect((await related.json()).case_id).toBe(caseId);
  expect(
    (
      await (
        await contributor.request.get("/api/v1/waterbodies?q=Reedwater")
      ).json()
    ).items[0].case_count,
  ).toBe(count + 1);
  const denied = await mutation(contributor, `/cases/${caseId}/transition`, {
    state: "acknowledged",
    reason: "Citizen cannot impersonate an organisation",
  });
  expect(denied.status()).toBe(403);
  await page.goto(`/incidents/${caseId}`);
  await page.getByLabel("Next case state").selectOption("acknowledged");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Demo organisation acknowledges this recorded observation.");
  await page.getByRole("button", { name: "Record update" }).click();
  await expect(
    page.locator(".wf-status-strip").getByText("Acknowledged", { exact: true }),
  ).toBeVisible();
  for (const state of ["investigating", "action_in_progress"]) {
    await page.getByLabel("Next case state").selectOption(state);
    await page
      .getByLabel("Reason", { exact: true })
      .fill(
        "Demo scenario: documented review and field activity, without a causal conclusion.",
      );
    await page.getByRole("button", { name: "Record update" }).click();
    await expect(
      page
        .locator(".wf-status-strip")
        .getByText(
          state === "investigating" ? "Investigating" : "Action In Progress",
          { exact: true },
        ),
    ).toBeVisible();
  }
  const invalidClosure = await mutation(page, `/cases/${caseId}/transition`, {
    state: "closed",
    reason: "Cannot close without documented outcome",
  });
  expect(invalidClosure.status()).toBe(422);
  const action = await mutation(page, `/cases/${caseId}/actions`, {
    title: "Demo follow-up documentation",
    description:
      "Demo scenario: follow-up documentation recorded; environmental condition not assessed.",
    completed_at: new Date().toISOString(),
  });
  expect(action.ok()).toBe(true);
  const actionBody = await action.json();
  const closed = await mutation(page, `/cases/${caseId}/transition`, {
    state: "closed",
    reason:
      "Response and follow-up have been documented in this demo scenario.",
    outcome_category: "closed_without_confirmed_cause",
    outcome:
      "Closed without a confirmed cause; documentation is retained for follow-up.",
    completed_at: new Date().toISOString(),
    supporting_record: actionBody.id,
  });
  expect(closed.ok()).toBe(true);
  await contributor.goto("/notifications");
  await expect(contributor.getByText(/closed recorded/i).first()).toBeVisible({
    timeout: 10000,
  });
  await page.goto(`/incidents/${caseId}`);
  await page.getByRole("button", { name: "Share update" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download.*PNG/ }).click();
  const download = await downloadPromise;
  const file = await download.path();
  const bytes = await fs.readFile(file!);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  await page.screenshot({
    path: "docs/screenshots/share-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/integrations");
  await page
    .getByRole("combobox", { name: "Water body", exact: true })
    .selectOption("wb-reedwater");
  const handoffResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/handoffs/wb-reedwater") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send to demo receiver" }).click();
  const handoff = await (await handoffResponse).json();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`/api/v1/receipts/${handoff.id}`)
          ).json()
        ).status,
      { timeout: 15000 },
    )
    .toBe("delivered");
  await expect(
    page.getByText("Delivered", { exact: true }).first(),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: "Supported standards & local receiver" }),
  ).toBeVisible();
  const sourceTest = await mutation(
    page,
    "/connectors/con-demo-source/test",
    {},
  );
  const sourceRun = (await sourceTest.json()).run_id;
  expect(sourceRun).toBeTruthy();
  expect(
    (
      await mutation(page, `/imports/${sourceRun}/transform`, {
        mapping: {
          external_id: "external_id",
          site_name: "site_name",
          observed_at: "observed_at",
          parameter: "parameter",
          value: "value",
          unit: "unit",
        },
      })
    ).ok(),
  ).toBe(true);
  expect((await mutation(page, `/imports/${sourceRun}/approve`, {})).ok()).toBe(
    true,
  );
  await page.goto("/integrations/con-demo-source");
  await page
    .getByRole("button", { name: "Demo scenario: fail source" })
    .click();
  await page
    .getByRole("button", { name: "Sync / safe retry", exact: true })
    .click();
  await expect(
    page
      .getByText(
        "Demo scenario: synthetic source is deliberately unavailable",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Demo scenario: recover source" })
    .click();
  const recoveredResponse=page.waitForResponse(response=>response.url().includes('/connectors/con-demo-source/sync')&&response.request().method()==='POST');
  await page
    .getByRole("button", { name: "Sync / safe retry", exact: true })
    .click();
  const recovered=(await (await recoveredResponse).json()).connector;
  expect(recovered.error).toBeNull();expect(recovered.last_success_at).toBeTruthy();
  expect(['healthy','stale']).toContain(recovered.state); // Transport recovery does not make old observations fresh.
  await expect(
    page.locator(".wf-section-head").getByText(recovered.state==='stale'?'Stale':'Healthy', { exact: true }),
  ).toBeVisible();
  expect(
    (
      await (
        await page.request.get("/api/v1/connectors/con-demo-source")
      ).json()
    ).connector.state,
  ).toBe(recovered.state);
  await citizen.close();
  await watcher.close();
});

test("offline pending draft retries once with the same client identity", async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto("/report?waterbody=wb-willow");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("Unsure", { exact: true }).click();
  await page
    .getByLabel("Describe what you saw")
    .fill(
      "Synthetic offline demo observation with unknown cause and preserved original statement.",
    );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save pending report" }).click();
  await expect(
    page.getByText(
      "Saved as pending on this device. The server has not received this report.",
    ),
  ).toBeVisible();
  await page.getByTitle("Click to open menu").click();
  await page.getByRole("complementary", {name:"AquaRelay Navigation"}).getByRole("link",{name:"Explore Waters",exact:true}).click();
  await expect(page).toHaveURL(/explore/);
  await context.setOffline(false);
  await expect
    .poll(
      async () =>
        page.evaluate(
          async () =>
            new Promise<string>((resolve) => {
              const r = indexedDB.open("aquarelay-account-drafts-v1");
              r.onsuccess = () => {
                const q = r.result
                  .transaction("drafts")
                  .objectStore("drafts")
                  .getAll();
                q.onsuccess = () =>
                  resolve(
                    q.result.find(
                      (d: any) => d.values.waterbody_id === "wb-willow",
                    )?.status || "missing",
                  );
              };
            }),
        ),
      { timeout: 15000 },
    )
    .toBe("synced");
  const drafts = await page.evaluate(
    async () =>
      new Promise<any[]>((resolve) => {
        const r = indexedDB.open("aquarelay-account-drafts-v1");
        r.onsuccess = () => {
          const q = r.result
            .transaction("drafts")
            .objectStore("drafts")
            .getAll();
          q.onsuccess = () => resolve(q.result);
        };
      }),
  );
  const record = drafts.find((d) => d.values.waterbody_id === "wb-willow");
  expect(record.status).toBe("synced");
  const replay = await mutation(page, "/reports", {
    ...record.values,
    client_id: record.id,
    evidence_ids: record.evidenceIds,
  });
  expect((await replay.json()).report.id).toBe(record.reportId);
});

test("account switch cannot display prior personal data when next fetch fails", async ({
  page,
}) => {
  await login(page);
  const name = `Private browser area ${Date.now()}`;
  expect(
    (
      await mutation(page, "/areas", {
        name,
        latitude: 12.97,
        longitude: 77.59,
        radius_m: 1000,
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/following");
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page.locator(".pureflow-profile-chip").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/login/);
  await page
    .getByLabel("Email", { exact: true })
    .fill("manager@demo.aquarelay.local");
  await page.getByLabel("Password", { exact: true }).fill("DemoPass123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/explore/);
  await page.route("**/api/v1/following", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Test account request unavailable" }),
    }),
  );
  await page.getByTitle("Click to open menu").click();
  await page.getByRole("complementary", {name:"AquaRelay Navigation"}).getByRole("link",{name:"Following",exact:true}).click();
  await expect(
    page.getByText("Records could not be loaded", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name })).toHaveCount(0);
  await expect(page.locator(".card-grid .follow-card")).toHaveCount(0);
});


test("original landing and tracking presentation retain record-backed behaviour",async({page})=>{
  await page.goto("/");
  await expect(page.locator(".pureflow-hero-container")).toBeVisible();
  await expect(page.locator(".pureflow-about-section")).toBeAttached();
  await expect(page.locator(".river-clean-cinema-container")).toBeAttached();
  await expect(page.locator(".gallery-stream-wrapper")).toBeAttached();
  await expect(page.locator(".pureflow-footer")).toBeAttached();
  await expect(page.locator(".public-nav")).toHaveCount(0);
  await page.locator(".lake-delivery-bar").click();
  await expect(page.locator(".amazon-tracker-page .glass-panel")).toBeVisible();
  await expect(page.getByRole("heading",{name:"Incident response records",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:/Recorded Evidence for Incident/})).toBeVisible();
  await expect(page.getByText("Patrol Boat #04",{exact:true})).toHaveCount(0);
});
