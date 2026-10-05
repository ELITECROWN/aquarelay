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
test('blocked browser storage does not break a water-body passport',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
   Storage.prototype.getItem=function(){throw new DOMException('Storage blocked','SecurityError');};
   Storage.prototype.setItem=function(){throw new DOMException('Storage blocked','SecurityError');};
 });
 await page.goto('/waterbodies/wb-reedwater');
 await expect(page.getByRole('heading',{name:'Demo Reedwater Lake',exact:true})).toBeVisible();
 await page.goto('/explore');
 await expect(page.getByRole('heading',{name:'A little closer to your waters.'})).toBeVisible();
 expect(errors).toEqual([]);
});
test('sign-in waits for a cold session and recovers without submitting an invalid request',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 let sessions=0,submissions=0;
 await page.route('**/api/v1/auth/session',async route=>{
   if(sessions++<2)await route.fulfill({status:502,body:'Server starting'});
   else await route.continue();
 });
 await page.route('**/api/v1/auth/admin-email-code',route=>{submissions++;return route.fulfill({json:{email:'dibyendukoley50@gmail.com',otp_required:true,csrf_token:'test'}});});
 await page.goto('/login?admin=1');
 const send=page.getByRole('button',{name:'Send verification code'});
 await expect(send).toBeDisabled();
 await expect(page.getByText(/Connecting to AquaRelay/)).toBeVisible();
 expect(submissions).toBe(0);
 await expect(send).toBeEnabled({timeout:20000});
 await expect(page.getByText(/Connecting to AquaRelay/)).toHaveCount(0);
 await send.click();await expect(page.getByLabel('Email verification code')).toBeVisible();
 expect(submissions).toBe(1);
});
test('mobile landing avoids decorative WebGL and retains the muted video',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.locator('.pureflow-hero-container')).toBeVisible();
 await expect(page.locator('.pureflow-app-root > div[aria-hidden="true"] canvas')).toHaveCount(0);
 const video=page.locator('.pureflow-bg-video').first();
 await expect(video).toBeVisible();
 expect(await video.evaluate(el=>el instanceof HTMLVideoElement?el.muted:true)).toBe(true);
});
test('a failed decorative scene download does not take down the homepage',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/components/ThreeDWaterScene.tsx',r=>r.abort());
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Clean Water,/})).toBeVisible();
 await expect(page.getByRole('banner').getByRole('link',{name:'Report Anomaly',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});
