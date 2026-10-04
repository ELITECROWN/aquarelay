import {test,expect} from '@playwright/test';
test.afterEach(async({},info)=>{if(info.error)console.log(info.error.message)});
for(const width of [1280,390])test(`gallery fills viewport and scrolls through images at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:720});await page.goto('/');await expect(page.getByLabel('Opening AquaRelay')).toHaveCount(0);
 const track=page.locator('.fullscreen-stream-track'),stage=page.locator('.fullscreen-stream-stage'),gallery=stage.locator('.gallery-stream-card');
 await page.evaluate(()=>document.fonts.ready);
 const top=await track.evaluate(el=>el.getBoundingClientRect().top+window.scrollY);
 await page.evaluate(y=>window.scrollTo(0,y+100),top);
 await expect.poll(async()=>{await track.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY+200));return Math.round((await stage.boundingBox())!.y)}).toBe(0);
 const box=(await gallery.boundingBox())!;expect(box.width).toBe(width);expect(box.height).toBe(720);expect(box.x).toBe(0);
 expect(await gallery.evaluate(el=>getComputedStyle(el).borderTopWidth)).toBe('0px');expect(await gallery.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('0px');
 const card=gallery.locator('[aria-hidden] > div > div').first();const before=await card.getAttribute('style');
 await track.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY+500));await expect.poll(()=>card.getAttribute('style')).not.toBe(before);await expect.poll(async()=>{await track.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY+500));return Math.round((await stage.boundingBox())!.y)}).toBe(0);
 await page.screenshot({path:`docs/screenshots/fullscreen-stream-${width}.png`});
});

