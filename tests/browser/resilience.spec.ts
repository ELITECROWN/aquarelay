import {test,expect} from '@playwright/test';
test('WebGL failure preserves the website',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind:string,...args:any[]){if(kind.includes('webgl'))return null;return (original as any).call(this,kind,...args)} as any;});
 await page.goto('/');await expect(page.getByRole('heading',{name:/Clean Water,/})).toBeVisible();await expect(page.getByLabel('Opening AquaRelay')).toHaveCount(0);expect(errors).toEqual([]);
});
test('reduced motion skips decorative WebGL background',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('.pureflow-hero-container')).toBeVisible();
 await expect(page.locator('.pureflow-app-root > div[aria-hidden="true"] canvas')).toHaveCount(0);
});
test('a fresh mobile session recovers from a temporary API proxy failure',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 let calls=0;
 let sessions=0;
 await page.route('**/api/v1/auth/session',async route=>{sessions++;await route.continue();});
 await page.route('**/api/v1/waterbodies?*',async route=>{
   if(calls++===0)await route.fulfill({status:502,body:'Server starting'});
   else await route.continue();
 });
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/explore');
 await expect(page.getByText('7 registered water bodies')).toBeVisible({timeout:30000});
 expect(calls).toBeGreaterThan(1);expect(sessions).toBe(1);expect(errors).toEqual([]);
});
test('Explore retains a real basic map when WebGL is unavailable',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind:string,...args:any[]){if(kind.includes('webgl'))return null;return (original as any).call(this,kind,...args)} as any;});
 await page.goto('/explore');
 await expect(page.getByTitle('Selected observation region')).toBeVisible({timeout:30000});
 await expect(page.getByText('7 registered water bodies')).toBeVisible();
 expect(errors).toEqual([]);
});
