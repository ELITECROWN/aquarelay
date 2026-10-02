import { chromium, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const origin = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";
const output = path.resolve("docs/qa-workflow");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.AQUARELAY_BROWSER_CHANNEL || "msedge",
  headless: true,
});
const errors = [];
let activePage;
async function readJson(context, route) {
  const response = await context.request.get(`${origin}${route}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function account(email) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const session = await (
    await context.request.get(`${origin}/api/v1/auth/session`)
  ).json();
  const response = await context.request.post(`${origin}/api/v1/auth/login`, {
    headers: { "X-CSRF-Token": session.csrf_token },
    data: { email, password: "DemoPass123!" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const page = await context.newPage();
  activePage = page;
  await page.addInitScript(() => {
    window.__shareTrace = [];
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
      window.__shareTrace.push({
        kind: "begin",
        at: performance.now(),
        width: this.width,
        height: this.height,
      });
      return original.call(
        this,
        (result) => {
          window.__shareTrace.push({
            kind: "callback",
            at: performance.now(),
            size: result?.size,
          });
          callback(result);
        },
        ...args,
      );
    };
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page };
}
try {
  const { context, page } = await account("citizen@demo.aquarelay.local");
  await page.goto(`${origin}/report?waterbody=wb-reedwater`);
  await expect(
    page.getByRole("heading", { name: "Where and when?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Water body", exact: true }),
  ).toHaveValue("wb-reedwater");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: path.join(output, `report-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Dead or distressed fish", { exact: true }).check();
  await page
    .getByLabel("Describe what you saw", { exact: false })
    .fill(
      "Synthetic UI verification: approximately 5–10 fish observed from a public bank. Cause unknown.",
    );
  await page
    .getByLabel("Approximate count or range", { exact: false })
    .fill("5–10");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 160;
      const context = canvas.getContext("2d");
      context.fillStyle = "#DCE8ED";
      context.fillRect(0, 0, 320, 160);
      context.fillStyle = "#183B30";
      context.font = "18px sans-serif";
      context.fillText("SYNTHETIC DEMO EVIDENCE", 14, 80);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic-ui-evidence.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit observation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your observation is on record." }),
  ).toBeVisible();
  const reportId = await page
    .locator(".wf-record-details dd")
    .nth(0)
    .textContent();
  const caseId = await page
    .locator(".wf-record-details dd")
    .nth(1)
    .textContent();
  await page.getByRole("link", { name: "View incident" }).click();
  await expect(
    page.getByRole("heading", { name: "The recorded observation" }),
  ).toBeVisible();
  const caseData = await (
    await context.request.get(`${origin}/api/v1/cases/${caseId}`)
  ).json();
  expect(
    caseData.reports.find((item) => item.id === reportId).count_estimate,
  ).toBe("5–10");
  expect(caseData.evidence).toHaveLength(1);
  expect(
    (await context.request.get(`${origin}${caseData.evidence[0].url}`)).ok(),
  ).toBeTruthy();
  await page.screenshot({
    path: path.join(output, "incident-1440.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Share update", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("canvas.wf-share-preview")).toHaveAttribute(
    "width",
    "1080",
  );
  await expect(
    page.getByRole("button", { name: "Download square PNG" }),
  ).toBeEnabled();
  await page.screenshot({ path: path.join(output, "share-square-dialog.png") });
  let downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download square PNG" }).click();
  let download = await downloadPromise;
  await download.saveAs(path.join(output, "share-square.png"));
  expect(
    (await readFile(path.join(output, "share-square.png"))).readUInt32BE(20),
  ).toBe(1080);
  await page.getByRole("button", { name: "Story · 1080 × 1920" }).click();
  await expect(page.locator("canvas.wf-share-preview")).toHaveAttribute(
    "height",
    "1920",
  );
  downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download story PNG" }).click();
  download = await downloadPromise;
  await download.saveAs(path.join(output, "share-story.png"));
  expect(
    (await readFile(path.join(output, "share-story.png"))).readUInt32BE(20),
  ).toBe(1920);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(output, "share-story-mobile.png") });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto(`${origin}/report?waterbody=wb-reedwater`);
  await expect(
    page.getByRole("combobox", { name: "Water body", exact: true }),
  ).toHaveValue("wb-reedwater");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Dead or distressed fish", { exact: true }).check();
  await page
    .getByLabel("Describe what you saw", { exact: false })
    .fill(
      "Synthetic candidate comparison check. No additional report is submitted.",
    );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page
      .getByText(
        /Same registered water body.*Same reported observation type.*Recorded times are within 7 days.*Approximate report positions are within 1 km/,
      )
      .first(),
  ).toBeVisible();
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: path.join(output, "related-candidates-390.png"),
    fullPage: true,
    animations: "disabled",
  });
  await context.close();
  const manager = await account("manager@demo.aquarelay.local");
  await manager.page.goto(`${origin}/integrations/import`);
  await expect(
    manager.page.getByRole("heading", { name: "Choose your source file" }),
  ).toBeVisible();
  await manager.page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("fixtures/demo-ngo-missing-unit.csv"));
  await manager.page
    .getByLabel("Dataset identity", { exact: false })
    .fill(`synthetic-ui-verification-${Date.now()}`);
  await manager.page
    .getByRole("button", { name: "Preview source", exact: true })
    .click();
  await expect(
    manager.page.getByRole("heading", { name: "Review field mappings" }),
  ).toBeVisible();
  await manager.page
    .getByRole("button", { name: "Preview transformed records", exact: true })
    .click();
  await expect(
    manager.page.getByText("No admissible records.", { exact: false }),
  ).toBeVisible();
  await expect(
    manager.page.getByRole("button", { name: "Approve & import" }),
  ).toBeDisabled();
  await manager.page
    .getByRole("button", { name: "Edit mapping", exact: true })
    .click();
  await manager.page
    .getByLabel("Temperature unit", { exact: false })
    .selectOption("degC");
  await manager.page.getByLabel("pH unit", { exact: false }).selectOption("1");
  await manager.page
    .getByLabel("Source timezone", { exact: false })
    .fill("Asia/Kolkata");
  await manager.page
    .getByRole("button", { name: "Preview transformed records", exact: true })
    .click();
  await manager.page.screenshot({
    path: path.join(output, "import-1440.png"),
    fullPage: true,
  });
  await manager.page
    .getByLabel("I reviewed the water-body identities", { exact: false })
    .check();
  await manager.page.getByRole("button", { name: "Approve & import" }).click();
  await expect(
    manager.page.getByRole("heading", { name: "Import processed" }),
  ).toBeVisible();
  const counts = await manager.page.locator(".wf-result-counts").textContent();
  expect(counts).toContain("imported");
  const connectorPath = await manager.page
    .getByRole("link", { name: "Inspect integration health & mapping version" })
    .getAttribute("href");
  await manager.page.setViewportSize({ width: 390, height: 844 });
  await manager.page.screenshot({
    path: path.join(output, "import-result-390.png"),
    fullPage: true,
    animations: "disabled",
  });
  await manager.page.goto(
    `${origin}/integrations/import?connector=${connectorPath.split("/").at(-1)}`,
  );
  await manager.page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("fixtures/demo-ngo-missing-unit.csv"));
  await manager.page
    .getByRole("button", { name: "Preview source", exact: true })
    .click();
  await expect(
    manager.page.getByLabel("Temperature unit", { exact: false }),
  ).toHaveValue("degC");
  await expect(
    manager.page.getByLabel("pH unit", { exact: false }),
  ).toHaveValue("1");
  await expect(
    manager.page.getByLabel("Source timezone", { exact: false }),
  ).toHaveValue("Asia/Kolkata");
  await expect(
    manager.page.getByRole("combobox", { name: "Destination for water_temp" }),
  ).toHaveValue("temperature");
  await manager.page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
  });
  await manager.page.screenshot({
    path: path.join(output, "reused-mapping-390.png"),
    fullPage: true,
    animations: "disabled",
  });
  await manager.page.setViewportSize({ width: 1440, height: 1000 });
  await manager.page.goto(`${origin}/incidents/${caseId}`);
  await manager.page
    .getByRole("button", { name: "Review this report" })
    .click();
  await manager.page
    .getByLabel("Decision reason")
    .fill(
      "Synthetic demo review: the original observation was accepted for investigation; no cause is confirmed.",
    );
  await manager.page
    .getByRole("button", { name: "Save report review" })
    .click();
  await expect(
    manager.page.getByText("Accepted For Investigation", { exact: true }),
  ).toBeVisible();
  await manager.page
    .getByRole("button", { name: "Share update", exact: true })
    .click();
  await expect(
    manager.page
      .getByRole("dialog")
      .getByText("Included with your caption:", { exact: false }),
  ).toContainText("Report accepted for investigation");
  await expect(manager.page.getByRole("dialog")).not.toContainText(
    "Community report — not yet reviewed",
  );
  await expect(
    manager.page.getByRole("button", { name: "Download square PNG" }),
  ).toBeEnabled();
  downloadPromise = manager.page.waitForEvent("download");
  await manager.page
    .getByRole("button", { name: "Download square PNG" })
    .click();
  download = await downloadPromise;
  await download.saveAs(path.join(output, "share-reviewed.png"));
  await manager.page
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const mutate = async (route, body) => {
    const session = await (
      await manager.context.request.get(`${origin}/api/v1/auth/session`)
    ).json();
    const response = await manager.context.request.post(
      `${origin}/api/v1${route}`,
      { headers: { "X-CSRF-Token": session.csrf_token }, data: body },
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const target = await mutate("/reports", {
    client_id: `ui-merge-target-${Date.now()}`,
    waterbody_id: "wb-reedwater",
    observation_type: "unsure",
    observed_at: new Date().toISOString(),
    description:
      "Synthetic demo target case for reviewing a duplicate link and its correction.",
    synthetic: true,
  });
  await manager.page.getByRole("tab", { name: "Duplicate review" }).click();
  await manager.page
    .getByLabel("Reviewed duplicate target")
    .selectOption(target.case_id);
  await manager.page
    .getByLabel("Reviewer reason")
    .fill(
      "Synthetic demo reviewer confirms a potentially related duplicate for this interface check.",
    );
  await manager.page.getByRole("button", { name: "Record update" }).click();
  await expect(
    manager.page.getByText("This case was linked as a reviewed duplicate of", {
      exact: false,
    }),
  ).toBeVisible();
  await manager.page
    .getByLabel("Reviewer reason")
    .fill(
      "Synthetic correction: keep the two cases separate while preserving the previous duplicate decision.",
    );
  await manager.page.getByRole("button", { name: "Record update" }).click();
  await expect(
    manager.page.getByText("This case was linked as a reviewed duplicate of", {
      exact: false,
    }),
  ).not.toBeVisible();
  await mutate(`/cases/${caseId}/transition`, {
    state: "acknowledged",
    reason: "Synthetic review verification acknowledges the observation.",
  });
  await mutate(`/cases/${caseId}/transition`, {
    state: "investigating",
    reason: "Synthetic review verification records investigation.",
  });
  const action = await mutate(`/cases/${caseId}/actions`, {
    title: "Synthetic UI follow-up record",
    description:
      "Synthetic demonstration follow-up documentation; condition and cause remain unassessed.",
    completed_at: new Date().toISOString(),
  });
  await mutate(`/cases/${caseId}/transition`, {
    state: "closed",
    reason: "Synthetic follow-up is documented; no cause confirmed.",
    outcome_category: "closed_without_confirmed_cause",
    outcome: "Closed without a confirmed cause",
    completed_at: new Date().toISOString(),
    supporting_record: action.id,
  });
  const reopenedCitizen = await account("citizen@demo.aquarelay.local");
  await reopenedCitizen.page.goto(`${origin}/incidents/${caseId}`);
  await reopenedCitizen.page
    .getByLabel("New information or reason")
    .fill(
      "Synthetic new evidence for review. Please evaluate whether this documented case should be reopened.",
    );
  await reopenedCitizen.page
    .getByRole("button", { name: "Request review", exact: true })
    .click();
  await expect(
    reopenedCitizen.page.getByText(/saved; awaiting organisation review/),
  ).toBeVisible();
  const closedCase = await readJson(
    reopenedCitizen.context,
    `/api/v1/cases/${caseId}`,
  );
  expect(closedCase.case.state).toBe("closed");
  expect(closedCase.case.reopening_requests.length).toBe(1);
  await reopenedCitizen.context.close();
  activePage = manager.page;
  await manager.page.goto(`${origin}/integrations`);
  const capabilities = await readJson(
    manager.context,
    "/api/v1/handoff-capabilities",
  );
  const handoffChoice = manager.page.getByRole("combobox", {
    name: "Handoff recipient",
  });
  await expect(handoffChoice).toBeEnabled();
  if (!capabilities.institutional.available) {
    await expect(
      handoffChoice.locator("option[value=institutional]"),
    ).toHaveAttribute("disabled", "");
    await expect(
      manager.page.getByText("Institutional handoff unavailable:", {
        exact: false,
      }),
    ).toBeVisible();
  }
  let receipt = manager.page.locator(".wf-receipt").first();
  if (capabilities.local_demo.available) {
    await handoffChoice.selectOption("local_demo");
    await manager.page
      .getByRole("combobox", { name: "Water body", exact: true })
      .selectOption("wb-reedwater");
    const sent = manager.page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/handoffs/wb-reedwater") &&
        response.request().method() === "POST",
    );
    await manager.page
      .getByRole("button", { name: "Send to demo receiver", exact: true })
      .click();
    const response = await sent;
    expect(response.ok(), await response.text()).toBeTruthy();
    const handoff = await response.json();
    receipt = manager.page
      .locator(".wf-receipt")
      .filter({ hasText: handoff.id })
      .first();
  }
  await receipt.locator("summary").click();
  await receipt
    .getByRole("button", { name: "Inspect persisted payload & validation" })
    .click();
  await expect
    .poll(
      async () =>
        JSON.parse(await receipt.locator("pre").textContent()).payload !==
        undefined,
    )
    .toBeTruthy();
  await manager.page.screenshot({
    path: path.join(output, "handoff-capabilities-1440.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        verified: [
          "responsive-report-390-768-1440",
          "actual-report-ID-and-range",
          "actual-evidence-upload",
          "actual-square-story-PNG",
          "mobile-share-dialog",
          "bounded-candidate-reasons",
          "missing-unit-approval-disabled",
          "corrected-import-committed",
          "approved-template-settings-reused",
          "per-report-review-decision",
          "accepted-review-share-label",
          "duplicate-link-and-correction",
          "reopening-request-preserves-closure",
          "handoff-capability-guard-and-real-payload",
        ],
        caseId,
        reportId,
        counts,
        screenshots: output,
      },
      null,
      2,
    ),
  );
  await manager.context.close();
} catch (error) {
  console.error(error);
  const tracePage =
    activePage && !activePage.isClosed() ? activePage : undefined;
  console.log(
    JSON.stringify(
      {
        pageErrors: errors,
        shareTrace: await tracePage?.evaluate(() => window.__shareTrace),
        url: tracePage?.url(),
      },
      null,
      2,
    ),
  );
  await tracePage?.screenshot({
    path: path.join(output, "failure.png"),
    fullPage: true,
    animations: "disabled",
  });
  throw error;
} finally {
  await browser.close();
}
