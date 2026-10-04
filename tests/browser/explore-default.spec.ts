import {test,expect} from '@playwright/test';
test('Explore starts at Bengaluru and permits manual map movement',async({page})=>{
 const tiles:{z:number,x:number,y:number}[]=[];
 const blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://tile.openstreetmap.org/**',r=>{const match=new URL(r.request().url()).pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.png/);if(match)tiles.push({z:Number(match[1]),x:Number(match[2]),y:Number(match[3])});return r.fulfill({contentType:'image/png',body:blank});});
 await page.goto('/explore');
 const canvas=page.getByTestId('interactive-map').locator('canvas');await expect(canvas).toBeVisible();
 // Bengaluru occupies these street-map tiles at city scale; an India-wide view does not.
 await expect.poll(()=>tiles.some(t=>t.z>=11&&Math.abs(t.x/2**t.z-(77.5946+180)/360)<0.005)).toBe(true);
 const before=tiles.length;await canvas.focus();for(let i=0;i<10;i++)await canvas.press('ArrowRight');
 await expect.poll(()=>tiles.length).toBeGreaterThan(before);
 const search=page.getByPlaceholder('Name, alias, or locality');await search.fill('Willow');
 await expect(page.getByRole('button',{name:/Demo Willow Pond.*on map/})).toBeVisible();
 await search.fill('');await expect(page.getByText('7 registered water bodies')).toBeVisible();
 await expect(page.getByRole('button',{name:/Demo Willow Pond.*on map/})).toBeVisible();
});
