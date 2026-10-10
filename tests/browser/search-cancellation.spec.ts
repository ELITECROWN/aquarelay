import { test, expect } from '@playwright/test';

test('changing Explore search cancels recovery for the obsolete search', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('https://tile.openstreetmap.org/**', r => r.abort());
  await page.route('**/api/v1/waterbodies/map?*', r => {
    if (new URL(r.request().url()).searchParams.get('q') === 'Willow')
      return r.fulfill({status:502,body:'Starting'});
    return r.continue();
  });
  await page.goto('/explore');
  const search = page.getByPlaceholder('Name, alias, or locality');
  await search.fill('Willow');
  await expect(page.getByText(/Connecting to AquaRelay/)).toBeVisible();
  await search.fill('Pine');
  await expect(page.getByText(/Connecting to AquaRelay/)).toHaveCount(0,{timeout:5000});
});
