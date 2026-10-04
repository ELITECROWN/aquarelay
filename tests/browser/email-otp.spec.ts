import {test,expect} from '@playwright/test';
test('email code step supports retry, resend and completed sign-in',async({page})=>{
 let verified=false;
 const user={id:'qa-email-user',name:'Email QA',email:'qa@example.org',role:'citizen',username:'email_qa',email_verified:true};
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{user:verified?user:null,csrf_token:'qa-csrf'}}));
 await page.route('**/api/v1/auth/login',r=>r.fulfill({json:{otp_required:true,email:'qa@example.org',csrf_token:'qa-csrf'}}));
 await page.route('**/api/v1/auth/resend-login-code',r=>r.fulfill({json:{otp_required:true}}));
 await page.route('**/api/v1/auth/verify-login-code',r=>{if(r.request().postDataJSON().code!=='123456')return r.fulfill({status:422,json:{detail:'Incorrect verification code.'}});verified=true;return r.fulfill({json:{user,csrf_token:'qa-csrf'}})});
 await page.goto('/login');await page.getByLabel('Email',{exact:true}).fill('qa@example.org');await page.getByLabel('Password',{exact:true}).fill('QaPassword123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const code=page.getByLabel('Email verification code');await expect(code).toBeVisible();await code.fill('000000');await page.getByRole('button',{name:'Verify and sign in'}).click();await expect(page.getByRole('alert')).toHaveText('Incorrect verification code.');
 await page.getByRole('button',{name:'Resend code'}).click();await expect(page.getByText('A new code has been queued. Use the latest email.')).toBeVisible();await code.fill('123456');await page.getByRole('button',{name:'Verify and sign in'}).click();await expect(page).toHaveURL(/explore/);
});
