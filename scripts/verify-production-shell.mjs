import { chromium, expect } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8000";
const browser = await chromium.launch({
  channel:
    process.env.AQUARELAY_BROWSER_CHANNEL ||
    (process.platform === "win32" ? "msedge" : "chromium"),
  headless: true,
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/explore`);
  await expect(page.getByText("7 registered water bodies")).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page
    .locator(".water-results")
    .getByRole("button", { name: /Demo Reedwater Lake/ })
    .click();
  await page.getByRole("link", { name: "Open water-body passport" }).click();
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  await expect(
    page.getByText("Demo field observation notebook", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".map-place-label").first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 15000,
    })
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const requests = await Promise.all(
      (await caches.keys()).map(async (name) =>
        (await caches.open(name)).keys(),
      ),
    );
    return requests.flat().map((request) => new URL(request.url).pathname);
  });
  expect(cached.some((path) => path.startsWith("/api"))).toBe(false);
  expect(cached.some((path) => path.startsWith("/assets/"))).toBe(true);
  const entryHtml = await (await page.request.get(origin + "/")).text();
  const entryAssets = await page.evaluate(
    (html) =>
      [
        ...new DOMParser()
          .parseFromString(html, "text/html")
          .querySelectorAll("script[src],link[rel=stylesheet][href]"),
      ]
        .map(
          (element) =>
            new URL(
              element.getAttribute("src") || element.getAttribute("href"),
              location.href,
            ).pathname,
        )
        .filter((path) => path.startsWith("/assets/")),
    entryHtml,
  );
  for (const path of entryAssets)
    expect(cached, `Service worker must cache entry asset ${path}`).toContain(
      path,
    );
  await page.screenshot({
    path: "docs/screenshots/production-passport-1440.png",
    fullPage: true,
  });
  await context.setOffline(true);
  await page.goto(`${origin}/explore`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "A little closer to your waters." }),
  ).toBeVisible();
  await expect(
    page.getByText("Records could not be loaded", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  expect(errors).toEqual([]);
  console.log(
    "PASS: production map/passport, active service worker, cached shell with no API cache, honest offline records state.",
  );
  await context.close();
} finally {
  await browser.close();
}
