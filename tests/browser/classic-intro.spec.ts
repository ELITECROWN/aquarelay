import {test,expect} from '@playwright/test';
test('classic white logo intro counts to 100 and leaves normal cursor',async({page})=>{
 await page.goto('/',{waitUntil:'domcontentloaded'});
 const intro=page.getByLabel('Opening AquaRelay');await expect(intro).toBeVisible();
 expect(await intro.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)');
 const counter=intro.locator('.classic-intro-counter');const first=Number(await counter.textContent());await expect.poll(async()=>Number(await counter.textContent())).toBeGreaterThan(first);
 await expect(counter).toHaveText('100');await page.screenshot({path:'docs/screenshots/classic-logo-intro.png'});
 await expect(intro).toHaveCount(0);await expect(page.locator('#lusion-cursor-dot, #lusion-cursor-ring')).toHaveCount(0);
 await page.reload();await expect(intro).toHaveCount(0);
});
test('reduced-motion visitors skip the intro animation',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.getByLabel('Opening AquaRelay')).toHaveCount(0);});
