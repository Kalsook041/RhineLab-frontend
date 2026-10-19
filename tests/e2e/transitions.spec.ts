import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window { __tangent: { seek(time: number): Promise<void>; getTime(): number; getState(): string; restart(): void | Promise<void> } }
}

async function frameLuma(page: Page, frame: number): Promise<number> {
  await page.evaluate((time) => window.__tangent.seek(time), frame / 30);
  const png = await page.screenshot();
  const url = `data:image/png;base64,${png.toString('base64')}`;
  return page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 108;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Screenshot analysis canvas unavailable');
    context.drawImage(image, 0, 0, 192, 108);
    const data = context.getImageData(0, 0, 192, 108).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
    return sum / (192 * 108);
  }, url);
}

test('10 秒转场确有多次黑白极性反转，311 帧才稳定为暗场', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__tangent));
  const frames = [302, 303, 304, 305, 307, 308, 309, 310, 311];
  const samples = new Map<number, number>();
  for (const frame of frames) samples.set(frame, await frameLuma(page, frame));
  const luma = (frame: number) => samples.get(frame)!;
  expect(luma(302) - luma(303)).toBeGreaterThan(45);
  expect(luma(305) - luma(304)).toBeGreaterThan(35);
  expect(luma(307) - luma(308)).toBeGreaterThan(30);
  expect(luma(309) - luma(308)).toBeGreaterThan(60);
  expect(luma(310) - luma(311)).toBeGreaterThan(80);
  expect(await page.evaluate(() => window.__tangent.getState())).toBe('playing');
});

test('授权卡压扁后留八帧空隙，再由横条重建 WELCOME 卡', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__tangent));
  const values = new Map<number, number>();
  for (const frame of [450, 459, 462, 466, 469, 470, 480, 491]) {
    values.set(frame, await frameLuma(page, frame));
  }
  const luma = (frame: number) => values.get(frame)!;
  expect(luma(450) - luma(459)).toBeGreaterThan(12);
  expect(luma(459) - luma(462)).toBeGreaterThan(8);
  for (const frame of [462, 466, 469]) expect(luma(frame)).toBeLessThan(65);
  expect(luma(480) - luma(462)).toBeGreaterThan(7);
  expect(luma(491) - luma(480)).toBeGreaterThan(20);
  expect(await page.evaluate(() => window.__tangent.getState())).toBe('playing');
});

test('转场中重播取消旧进度，WELCOME 不会被旧回调抢写', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__tangent));
  await page.evaluate(() => window.__tangent.seek(459 / 30));
  await page.evaluate(() => window.__tangent.restart());
  await expect.poll(() => page.evaluate(() => window.__tangent.getTime())).toBeLessThan(1);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__tangent.getTime())).toBeLessThan(1.5);
  expect(await page.evaluate(() => window.__tangent.getState())).toBe('intro');
});
