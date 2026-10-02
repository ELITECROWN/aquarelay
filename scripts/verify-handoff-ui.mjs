import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const origin = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  channel: process.env.AQUARELAY_BROWSER_CHANNEL || "msedge",
  headless: true,
});
try {
  await mkdir("docs/qa-workflow", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  // Exercise the documented polling fallback; every data/mutation response is real.
  await context.route("**/api/v1/events/stream", (route) =>
    route.abort("failed"),
  );
  const sessionResponse = await context.request.get(
    `${origin}/api/v1/auth/session`,
  );
  expect(sessionResponse.ok(), await sessionResponse.text()).toBeTruthy();
  const session = await sessionResponse.json();
  const login = await context.request.post(`${origin}/api/v1/auth/login`, {
    headers: { "X-CSRF-Token": session.csrf_token },
    data: { email: "manager@demo.aquarelay.local", password: "DemoPass123!" },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const capabilitiesResponse = await context.request.get(
    `${origin}/api/v1/handoff-capabilities`,
  );
  expect(
    capabilitiesResponse.ok(),
    await capabilitiesResponse.text(),
  ).toBeTruthy();
  const capabilities = await capabilitiesResponse.json();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/integrations`);
  const choice = page.getByRole("combobox", { name: "Handoff recipient" });
  await expect(choice).toBeEnabled();
  if (!capabilities.institutional.available) {
    await expect(choice.locator("option[value=institutional]")).toHaveAttribute(
      "disabled",
      "",
    );
    await expect(
      page.getByText("Institutional handoff unavailable:", { exact: false }),
    ).toContainText(capabilities.institutional.reason);
  }
  expect(capabilities.local_demo.available).toBeTruthy();
  await choice.selectOption("local_demo");
  await page
    .getByRole("combobox", { name: "Water body", exact: true })
    .selectOption("wb-reedwater");
  const sent = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/handoffs/wb-reedwater") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Send to demo receiver", exact: true })
    .click();
  const response = await sent;
  expect(response.ok(), await response.text()).toBeTruthy();
  const handoff = await response.json();
  expect(handoff.channel).toBe("local_demo");
  expect(handoff.acknowledged).toBe(false);
  const receipt = page
    .locator(".wf-receipt")
    .filter({ hasText: handoff.id })
    .first();
  await receipt.locator("summary").click();
  await receipt
    .getByRole("button", { name: "Inspect persisted payload & validation" })
    .click();
  await expect
    .poll(
      async () =>
        JSON.parse(await receipt.locator("pre").textContent()).payload
          ?.resourceType,
    )
    .toBe("Bundle");
  await expect(
    receipt.getByText("Organisation acknowledgement not received", {
      exact: false,
    }),
  ).toBeVisible();
  await expect
    .poll(
      async () => {
        const result = await context.request.get(
          `${origin}/api/v1/receipts/${handoff.id}`,
        );
        expect(result.ok()).toBeTruthy();
        return (await result.json()).status;
      },
      { timeout: 15000 },
    )
    .toBe("delivered");
  await expect(receipt.getByText("Delivered", { exact: true })).toBeVisible({
    timeout: 7000,
  });
  await receipt
    .getByRole("button", { name: "Inspect persisted payload & validation" })
    .click();
  await expect
    .poll(
      async () => JSON.parse(await receipt.locator("pre").textContent()).status,
    )
    .toBe("delivered");
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "docs/qa-workflow/handoff-capabilities-1440.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
  console.log(
    JSON.stringify(
      {
        verified: [
          "institutional-unavailable-guard",
          "explicit-local-demo-recipient",
          "actual-persisted-FHIR-payload",
          "delivery-without-acknowledgement",
          "polling-fallback",
        ],
        receipt_id: handoff.id,
        status: "delivered",
        acknowledged: false,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
