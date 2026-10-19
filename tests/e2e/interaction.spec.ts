import { expect, test, type Page } from '@playwright/test';

type Tangent = {
  seek(time: number): Promise<void>;
  getTime(): number;
  getState(): string;
  restart(): void | Promise<void>;
};

declare global {
  interface Window { __tangent: Tangent }
}

const HOLD = 144 / 30;
const END = 546 / 30;

async function ready(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__tangent));
}

async function time(page: Page): Promise<number> {
  return page.evaluate(() => window.__tangent.getTime());
}

async function seek(page: Page, sourceTime: number): Promise<void> {
  await page.evaluate((value) => window.__tangent.seek(value), sourceTime);
}

test('球体点击启动后播放至完整电源并无限等待；登录后按原时序续播', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#stage')).toHaveAttribute('data-state','ready');
  await page.locator('#start').click();
  await expect.poll(() => time(page), { timeout: 7_000 }).toBeGreaterThanOrEqual(HOLD - 1 / 30);
  const atHold = await time(page);
  expect(atHold).toBeCloseTo(HOLD, 2);
  await page.waitForTimeout(400);
  expect(await time(page)).toBeCloseTo(HOLD, 2);
  await expect(page.locator('#power')).toBeVisible();
  await page.locator('#power').click();
  await expect.poll(() => time(page)).toBeGreaterThan(HOLD + 0.1);
  await seek(page, 545 / 30);
  await expect.poll(() => time(page), { timeout: 2_000 }).toBeGreaterThanOrEqual(545 / 30);
  await expect.poll(() => page.evaluate(() => window.__tangent.getState()), { timeout: 2_000 }).toBe('welcome');
  await page.waitForTimeout(300);
  expect(await time(page)).toBeLessThanOrEqual(END + 1 / 30);
  await expect(page.locator('#welcome-title')).toBeVisible();
});

test('重播取消当前进程并回到片头，旧完成回调不能改写新轮', async ({ page }) => {
  await ready(page);
  await seek(page, 450 / 30);
  await page.evaluate(() => window.__tangent.restart());
  await expect.poll(() => time(page)).toBeLessThan(1);
  await expect(page.locator('#stage')).not.toHaveAttribute('data-state', 'welcome');
  await page.waitForTimeout(250);
  expect(await time(page)).toBeLessThan(1.5);
  await seek(page, 540 / 30);
  await page.keyboard.press('r');
  await expect.poll(() => time(page)).toBeLessThan(1);
  await expect(page.locator('#stage')).not.toHaveAttribute('data-state', 'welcome');
});

test('Space 暂停和继续，焦点操作保持键盘可用', async ({ page }) => {
  await ready(page);
  await seek(page, 180 / 30);
  await page.keyboard.press('Space');
  await expect.poll(() => time(page)).toBeGreaterThan(180 / 30 + 0.1);
  await page.keyboard.press('Space');
  const pausedAt = await time(page);
  await page.waitForTimeout(220);
  expect(await time(page)).toBeCloseTo(pausedAt, 2);
  await page.keyboard.press('Space');
  await expect.poll(() => time(page)).toBeGreaterThan(pausedAt + 0.1);
  await page.evaluate(() => window.__tangent.restart());
  await seek(page, HOLD);
  await expect(page.locator('#power')).toBeVisible();
  await page.locator('#power').focus();
  await expect(page.locator('#power')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => time(page)).toBeGreaterThan(HOLD);
});

test('系统低运动偏好保留可操作流程，重启与尺寸改变不丢状态', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await page.locator('#start').click();
  await expect(page.locator('#power')).toBeVisible();
  await page.locator('#power').focus();
  await page.keyboard.press('Enter');
  await seek(page, 540 / 30);
  await expect(page.locator('#welcome-title')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#welcome-title')).toBeVisible();
  await page.keyboard.press('r');
  await expect.poll(() => time(page)).toBeCloseTo(HOLD, 2);
});

test('Canvas 失效时交互与源时钟仍可完成', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await ready(page);
  await seek(page, 540 / 30);
  await expect(page.locator('#welcome-title')).toBeVisible();
  await page.evaluate(() => window.__tangent.restart());
  await expect.poll(() => time(page)).toBeLessThan(1);
});

test('地图数据失败时前景仍可操作并可重播', async ({ page }) => {
  await page.route('**/world-points.json', (route) => route.abort());
  await ready(page);
  await seek(page, HOLD);
  await expect(page.locator('#power')).toBeVisible();
  await seek(page, 540 / 30);
  await expect(page.locator('#welcome-title')).toBeVisible();
  await page.evaluate(() => window.__tangent.restart());
  await expect.poll(() => time(page)).toBeLessThan(1);
});
