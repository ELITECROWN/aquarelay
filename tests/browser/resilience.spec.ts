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
