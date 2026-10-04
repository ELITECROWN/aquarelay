import { test, expect } from '@playwright/test';

test('admin cleanup requires preview and typed confirmation', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/api/v1/auth/session', route => route.fulfill({json:{user:{id:'qa-admin',name:'Administrator',email:'admin@test.local',role:'admin'},csrf_token:'test'}}));
  await page.route('**/api/v1/admin/cleanup/storage-status', route => route.fulfill({json:{jobs:{pending:2}}}));
  let executions = 0;
  await page.route('**/api/v1/admin/cleanup/preview', route => route.fulfill({json:{preview_id:'preview',counts:{reports:1,cases:1,uploads:1,accounts:0},original_bytes:100,confirmation:'DELETE PROTOTYPE DATA',expires_at:'2099-01-01'}}));
  await page.route('**/api/v1/admin/cleanup/execute', route => { executions++; return route.fulfill({json:{message:'Database cleanup completed.'}}); });
  await page.goto('/admin/cleanup');
  await page.getByLabel('Delete reports, incidents and their response history').check();
  await expect(page.getByLabel('Delete uploaded evidence and stored files')).toBeChecked();
  await page.getByRole('button',{name:'Preview cleanup'}).click();
  const remove = page.getByRole('button',{name:'Permanently delete selected data'});
  await expect(remove).toBeDisabled();
  expect(executions).toBe(0);
  await page.getByLabel('Type DELETE PROTOTYPE DATA to confirm').fill('DELETE PROTOTYPE DATA');
  await remove.click();
  await expect(page.locator('main').getByRole('status')).toHaveText('Database cleanup completed.');
  expect(executions).toBe(1);
});

test('landing video is muted and has no sound toggle', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const video = page.locator('.pureflow-bg-video').first();
  await expect(video).toBeVisible();
  expect(await video.evaluate(el => el instanceof HTMLVideoElement ? el.muted : (el as HTMLIFrameElement).src.includes('mute=1'))).toBe(true);
  await expect(page.getByRole('button',{name:/Sound Off|Sound On/})).toHaveCount(0);
});
