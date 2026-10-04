import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const fixtures=JSON.parse(await fs.readFile('backend/registry/authority-directory-2026-10-04.json','utf8')).map((o:any)=>({...o,synthetic:false,contact_sources:o.sources}));
test.beforeEach(async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',route=>route.abort());
 await page.route('**/api/v1/organisations*',route=>{const q=new URL(route.request().url()).searchParams.get('q')?.toLowerCase()||'';return route.fulfill({json:{items:fixtures.filter((o:any)=>JSON.stringify([o.name,o.places]).toLowerCase().includes(q))}});});
 await page.route('**/api/v1/waterbodies/wb-willow?**',async route=>{const response=await route.fetch();const body=await response.json();body.authorities=fixtures.filter((o:any)=>o.service_regions.includes('potheri'));await route.fulfill({json:body});});
});
test('place search, office contacts, lake contacts and clean public menu',async({page})=>{
 await page.goto('/organisations');await page.getByRole('textbox',{name:'Search your place or organisation'}).fill('Potheri');
 await expect(page.getByRole('heading',{name:'Maraimalai Nagar Municipality'})).toBeVisible();
 await expect(page.getByRole('link',{name:'commr.maraimalainagar@tn.gov.in'})).toHaveAttribute('href','mailto:commr.maraimalainagar@tn.gov.in');
 await expect(page.getByText('Adigalar Salai, Maraimalai Nagar, Chengalpattu, Tamil Nadu 603209',{exact:true})).toBeVisible();
 await page.goto('/waterbodies/wb-willow');await expect(page.getByRole('heading',{name:'Authorities & local contacts'})).toBeVisible();
 await expect(page.getByRole('link',{name:'deemmn@tnpcb.gov.in'})).toBeVisible();
 await page.locator('[title="Click to open menu"]').click();
 const nav=page.getByRole('navigation',{name:'Main navigation'});await expect(nav.getByRole('link',{name:'Public API'})).toHaveCount(0);await expect(nav.getByRole('link',{name:'Integrations'})).toHaveCount(0);await expect(nav.getByRole('link',{name:'Registry & Field Records'})).toHaveCount(0);
});
test('story and status downloads have correct dimensions and square remains available',async({page})=>{
 await page.goto('/waterbodies/wb-willow');await page.getByRole('button',{name:'Share',exact:true}).click();
 const canvas=page.getByRole('dialog').locator('canvas');await expect(canvas).toHaveAttribute('height','1920');
 for(const platform of ['Instagram Story','WhatsApp Status','Square']){
  await page.getByRole('button',{name:new RegExp(platform)}).click();
  const downloadReady=page.waitForEvent('download');await page.getByRole('button',{name:/Download.*PNG/}).click();
  const download=await downloadReady;const file=await download.path();const bytes=await fs.readFile(file!);expect(bytes.subarray(1,4).toString()).toBe('PNG');expect(bytes.readUInt32BE(16)).toBe(1080);expect(bytes.readUInt32BE(20)).toBe(platform==='Square'?1080:1920);
  await fs.copyFile(file!,path.join('docs/screenshots','share-'+platform.toLowerCase().replaceAll(' ','-')+'.png'));
 }
});
