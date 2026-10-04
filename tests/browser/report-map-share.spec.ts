import {test,expect} from '@playwright/test';
const blankTile=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
test.afterEach(async({},info)=>{if(info.error)console.log(info.error.message)});
test('report from selected water outside first page, pick map position and share synced observation',async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:blankTile}));
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill('citizen@demo.aquarelay.local');await page.getByLabel('Password',{exact:true}).fill('DemoPass123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/explore/);
 await page.route('**/api/v1/waterbodies?page_size=100*',r=>r.fulfill({json:{items:[],total:0}}));
 await page.goto('/explore');await page.getByRole('button',{name:/Demo Willow Pond.*on map/}).click();await page.getByRole('link',{name:'Report here',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Water body',exact:true})).toHaveValue('wb-willow');
 const latitude=page.getByLabel('Latitude',{exact:true});await expect(latitude).toHaveValue('12.97');
 const canvas=page.getByLabel('Choose observation location').locator('canvas');await expect(canvas).toBeVisible();await canvas.focus();await canvas.press('ArrowRight');
 await expect(page.getByLabel('Longitude',{exact:true})).not.toHaveValue('77.578');
 await page.screenshot({path:'docs/screenshots/report-map-picker.png',fullPage:true});
 const chosen=Number(await page.getByLabel('Longitude',{exact:true}).inputValue());
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('radio',{name:'Foam',exact:true}).check();await page.getByPlaceholder('Describe the location and visible observation. It is fine to be unsure.').fill('Visible foam collected beside the eastern bank. Cause unknown.');
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 const posted=page.waitForRequest(r=>r.method()==='POST'&&new URL(r.url()).pathname==='/api/v1/reports');await page.getByRole('button',{name:/Submit/}).click();const request=await posted;expect(request.postDataJSON().longitude).toBe(chosen);
 await expect(page.getByRole('heading',{name:'Your observation is on record.'})).toBeVisible();await page.getByRole('button',{name:'Share my report',exact:true}).click();
 await expect(page.getByRole('dialog').getByText(/Community report — not yet reviewed/).first()).toBeVisible();await expect(page.getByLabel('Editable caption')).toHaveValue(/Visible foam collected/);
 for(const name of ['Instagram Story','WhatsApp Status']){await page.getByRole('button',{name:new RegExp(name)}).click();await expect(page.getByRole('dialog').locator('canvas')).toHaveAttribute('height','1920');const ready=page.waitForEvent('download');await page.getByRole('button',{name:/Download.*PNG/}).click();expect(await (await ready).path()).toBeTruthy();}
});

test('map chunk failure preserves manual reporting fields',async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:blankTile}));
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill('citizen@demo.aquarelay.local');await page.getByLabel('Password',{exact:true}).fill('DemoPass123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/explore/);
 await page.route('**/src/features/ObservationMap.tsx*',r=>r.abort('failed'));
 await page.goto('/report?waterbody=wb-willow');
 await expect(page.getByText(/Map could not be loaded. Select a water body/)).toBeVisible();
 await page.getByLabel('Latitude',{exact:true}).fill('12.9702');await page.getByLabel('Longitude',{exact:true}).fill('77.5782');
 await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('heading',{name:'What did you observe?'})).toBeVisible();
});
