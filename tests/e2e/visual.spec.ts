import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __tangent: { seek(time: number): Promise<void>; getTime(): number; getState(): string; restart(): void | Promise<void> };
  }
}

const FRAMES = [0, 90, 144, 180, 225, 255, 270, 300, 303, 305, 308, 310, 311,
  330, 360, 375, 405, 450, 459, 462, 470, 480, 491, 498, 510, 540];

test('1920×1080 原画幅占满 viewport，seek 在实际背景帧与前景同步后才完成', async ({ page }, testInfo) => {
  test.setTimeout(45_000); // 26 full-HD native renders and PNG encodes.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__tangent));
  const stage = page.locator('#stage');
  const box = await stage.boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: 1920, height: 1080 });
  const background = page.locator('#background');
  await expect(background).toHaveJSProperty('tagName', 'CANVAS');

  for (const frame of FRAMES) {
    const sourceTime = frame / 30;
    await page.evaluate((time) => window.__tangent.seek(time), sourceTime);
    const at = await page.evaluate(() => ({
      source: window.__tangent.getTime(),
      native: Number(document.querySelector<HTMLCanvasElement>('#background')?.dataset.motionTime),
      state: window.__tangent.getState(),
    }));
    expect(at.source, `source frame ${frame}`).toBeCloseTo(sourceTime, 2);
    expect(at.native, `native frame ${frame}`).toBeDefined();
    expect(Math.abs(at.native - sourceTime), `canvas sync at frame ${frame}`).toBeLessThanOrEqual(1 / 30 + 0.005);
    const screenshot = await page.screenshot({ path: testInfo.outputPath(`f${String(frame).padStart(4, '0')}.png`) });
    // Solid native transition frames compress more than noisy video. Validate
    // the PNG signature and decoded dimensions, not its encoded byte count.
    expect(screenshot.subarray(1, 4).toString()).toBe('PNG');
    expect(screenshot.readUInt32BE(16)).toBe(1920);
    expect(screenshot.readUInt32BE(20)).toBe(1080);
    await page.waitForTimeout(90);
    expect(await page.evaluate(() => window.__tangent.getTime()), `external seek holds frame ${frame}`).toBeCloseTo(sourceTime, 2);
  }
});

test('窄屏可访问电源且保持裁切规则，画面没有横向滚动', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__tangent));
  await page.evaluate(() => window.__tangent.seek(144 / 30));
  const power = page.locator('#power');
  await expect(power).toBeVisible();
  const box = await power.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('各视口背景覆盖四边，卡片与电源保持比例且命中区域与图标一致',async({page})=>{
  await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
  for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:1920,height:720}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>window.__tangent.seek(4.8));
    const stage=await page.locator('#stage').boundingBox(),bg=await page.locator('#background').boundingBox();
    expect(stage).toMatchObject({x:0,y:0,...viewport});
    expect(bg!.x).toBeLessThanOrEqual(.5);expect(bg!.y).toBeLessThanOrEqual(.5);
    expect(bg!.x+bg!.width).toBeGreaterThanOrEqual(viewport.width-.5);
    expect(bg!.y+bg!.height).toBeGreaterThanOrEqual(viewport.height-.5);
    const power=await page.locator('#power').boundingBox();
    const visual=await page.locator('#power-shape').evaluate(n=>{const m=(n as SVGGraphicsElement).getScreenCTM()!;return {x:m.e,y:m.f,scale:m.a};});
    expect(power!.x+power!.width/2).toBeCloseTo(visual.x,1);
    expect(Math.abs(power!.y+power!.height/2-visual.y)).toBeLessThanOrEqual(visual.scale*2+.1);
    await page.evaluate(()=>window.__tangent.seek(18));const card=await page.locator('#welcome-card').boundingBox();
    expect(card!.x).toBeGreaterThanOrEqual(0);expect(card!.y).toBeGreaterThanOrEqual(0);
    expect(card!.x+card!.width).toBeLessThanOrEqual(viewport.width+.5);
    expect(card!.y+card!.height).toBeLessThanOrEqual(viewport.height+.5);
    expect(card!.width/card!.height).toBeCloseTo(1506/530,2);
  }
});
