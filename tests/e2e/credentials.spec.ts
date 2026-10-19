import { expect, test, type Page } from '@playwright/test';

async function waiting(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__tangent));
  await page.evaluate(() => window.__tangent.seek(4.8));
}

test('等待界面默认账户与掩码密码，正确提交继续原有动画和声音', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__tangent));
  await expect(page.locator('#credentials')).toBeHidden();
  await page.evaluate(() => window.__tangent.seek(4.8));
  await expect(page.getByLabel('账户', { exact:true })).toHaveValue('admin');
  await expect(page.getByLabel('密码', { exact:true })).toHaveValue('123456');
  await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  await expect(page.locator('#identity-divider')).toBeHidden();
  await expect(page.locator('#file-icon')).toBeHidden();
  await page.locator('#power').click();
  await expect(page.locator('#credentials')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__tangent.getTime())).toBeGreaterThan(5);
  await expect.poll(() => page.evaluate(() => window.__tangent.getAudioState().state)).toBe('playing');
});

test('错误和空输入不会绕过验证，改正后 Enter 登录；编辑不触发全局快捷键', async ({ page }) => {
  await waiting(page);
  await page.locator('#account').fill('');
  await page.locator('#account').pressSequentially('rs m');
  await expect(page.locator('#account')).toHaveValue('rs m');
  expect(await page.evaluate(() => window.__tangent.getTime())).toBe(4.8);
  await expect(page.locator('#sound')).toHaveAttribute('aria-checked','true');
  await expect(page.locator('#motion')).toHaveAttribute('aria-checked','true');
  await page.locator('#power').click();
  await expect(page.locator('#credential-error')).toHaveText('账户或密码不正确。');
  await expect(page.locator('#account')).toBeFocused();
  await expect(page.locator('#account')).toHaveAttribute('aria-invalid','true');
  expect(await page.evaluate(() => window.__tangent.getTime())).toBe(4.8);
  expect((await page.evaluate(() => window.__tangent.getAudioState())).state).toBe('locked');
  await page.locator('#account').fill('admin');
  await page.locator('#password').fill('');
  await page.locator('#password').press('Enter');
  await expect(page.locator('#credential-error')).toHaveText('请输入密码。');
  await expect(page.locator('#password')).toBeFocused();
  await page.locator('#password').fill('invalid');
  await expect(page.locator('#credential-error')).toBeHidden();
  await page.locator('#password').press('Enter');
  await expect(page.locator('#credential-error')).toHaveText('账户或密码不正确。');
  await page.locator('#password').fill('123456');
  await page.locator('#password').press('Enter');
  await expect.poll(() => page.evaluate(() => window.__tangent.getTime())).toBeGreaterThan(5);
  await expect(page.locator('#credentials')).toBeHidden();
  await page.keyboard.press('r');
  await expect.poll(() => page.evaluate(() => window.__tangent.getTime())).toBeLessThan(1);
  await page.evaluate(() => window.__tangent.seek(4.8));
  await expect(page.locator('#account')).toHaveValue('admin');
  await expect(page.locator('#password')).toHaveValue('123456');
  await expect(page.locator('#credential-error')).toBeHidden();
});

test('桌面、竖屏和短横屏输入区可操作，不遮挡电源或角标', async ({ page }) => {
  await waiting(page);
  for (const viewport of [{ width:1920,height:1080 },{ width:1280,height:800 },{ width:390,height:844 },{ width:844,height:390 },{ width:390,height:420 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.__tangent.seek(4.8));
    const form = (await page.locator('#credentials').boundingBox())!;
    const power = (await page.locator('#power').boundingBox())!;
    expect(form.x).toBeGreaterThanOrEqual(0);
    expect(form.y).toBeGreaterThanOrEqual(0);
    expect(form.x + form.width).toBeLessThanOrEqual(viewport.width);
    expect(form.y + form.height).toBeLessThanOrEqual(viewport.height);
    const overlap = Math.min(form.x+form.width,power.x+power.width)>Math.max(form.x,power.x)
      &&Math.min(form.y+form.height,power.y+power.height)>Math.max(form.y,power.y);
    expect(overlap, `${viewport.width}×${viewport.height}, form=${JSON.stringify(form)}, power=${JSON.stringify(power)}`).toBe(false);
    for (const field of ['#account','#password']) {
      await expect(page.locator(field)).toBeEditable();
      const box = (await page.locator(field).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(140);
      expect(box.height).toBeGreaterThanOrEqual(36);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBe(0);
  }
});
