import {test,expect} from '@playwright/test';
test('identity details and stronger contrast preserve mobile layout and reduced motion',async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/v1/waterbodies/wb-willow?**',async route=>{const response=await route.fetch();const body=await response.json();body.waterbody.identity_details={name_status:'Local name not recorded',mapped_names:[],coordinate_notice:'Mapped feature centre; not a surveyed address or boundary',seasonal:'yes'};await route.fulfill({json:body});});
 await page.goto('/waterbodies/wb-willow');await expect(page.getByLabel('Loading screen')).toHaveCount(0,{timeout:10000});
 const panel=page.getByRole('region',{name:'Mapped identity details'});
 await expect(panel.getByText('Local name not recorded')).toBeVisible();
 await expect(panel.getByText('Seasonal water (mapped)')).toBeVisible();
 expect(await panel.evaluate(e=>getComputedStyle(e).borderTopWidth)).toBe('1px');
 expect(await page.getByRole('heading',{level:1}).evaluate(e=>getComputedStyle(e).color)).toBe('rgb(31, 41, 55)');
 await page.screenshot({path:'docs/screenshots/readability-passport-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 expect(await panel.evaluate(e=>getComputedStyle(e).animationDuration)).toBe('1e-05s');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'docs/screenshots/readability-passport-mobile.png',fullPage:true});
});
