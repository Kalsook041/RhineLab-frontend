import { expect, test, type Page } from '@playwright/test';

const snapshot = (page: Page) => page.evaluate(() => window.__tangent.getAudioState());
async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__tangent));
}

test('真实原片音轨经点击解锁、按源时间输出；暂停、静音和重播同步', async ({ page }) => {
  await ready(page);
  expect((await snapshot(page)).contextState).toBe('not-created');
  await page.evaluate(() => window.__tangent.seek(4.8));
  await page.locator('#power').click();
  await expect.poll(async () => (await snapshot(page)).state).toBe('playing');
  await expect.poll(async () => (await snapshot(page)).rms).toBeGreaterThan(.001);
  const playing = await snapshot(page);
  expect(playing.contextState).toBe('running');
  expect(playing.duration).toBeGreaterThan(24.15);
  expect(playing.duration).toBeLessThan(24.20);
  expect(Math.abs(playing.drift)).toBeLessThan(.065);
  expect(playing.sourceTime).toBeGreaterThan(4.8);

  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).state).toBe('ready');
  const paused = await snapshot(page);
  await page.waitForTimeout(160);
  expect((await snapshot(page)).sourceTime).toBeCloseTo(paused.sourceTime, 3);
  expect((await snapshot(page)).rms).toBeLessThan(.00001);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).rms).toBeGreaterThan(.001);

  await page.keyboard.press('s');
  await expect(page.locator('#sound')).toHaveAttribute('aria-checked', 'false');
  await page.waitForTimeout(160);
  expect((await snapshot(page)).rms).toBeLessThan(.00001);
  expect((await snapshot(page)).sourceTime).toBeGreaterThan(paused.sourceTime + .1);
  await page.keyboard.press('s');
  await expect.poll(async () => (await snapshot(page)).rms).toBeGreaterThan(.001);

  await page.keyboard.press('r');
  await expect.poll(async () => (await snapshot(page)).sourceTime).toBeLessThan(.5);
  await expect.poll(async () => (await snapshot(page)).state).toBe('playing');
  await page.evaluate(() => window.__tangent.seek(10));
  await page.waitForTimeout(120);
  const seeked = await snapshot(page);
  expect(seeked.state).toBe('ready');
  expect(seeked.sourceTime).toBe(10);
  expect(seeked.rms).toBeLessThan(.00001);

  await page.evaluate(() => window.__tangent.seek(4.8));
  await page.locator('#sound').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#sound')).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => window.__tangent.getTime())).toBe(4.8);
  await page.keyboard.press('Space');
  await expect(page.locator('#sound')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => window.__tangent.getTime())).toBe(4.8);
});

test('慢加载保留完整语音起点；后台暂停，WELCOME 停驻期间继续音乐', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/interactive-cycle.m4a', async (route) => { await gate; await route.continue(); });
  await ready(page);
  await page.evaluate(() => window.__tangent.seek(4.8));
  await page.locator('#power').click();
  await page.waitForTimeout(500);
  expect((await snapshot(page)).state).toBe('loading');
  expect(await page.evaluate(()=>window.__tangent.getTime())).toBe(4.8);
  release();
  await expect.poll(async () => (await snapshot(page)).state).toBe('playing');
  expect((await snapshot(page)).sourceTime).toBeGreaterThanOrEqual(4.8);
  expect(Math.abs((await snapshot(page)).drift)).toBeLessThan(.065);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused = await snapshot(page);
  await page.waitForTimeout(200);
  expect((await snapshot(page)).rms).toBeLessThan(.00001);
  expect((await snapshot(page)).sourceTime).toBeCloseTo(paused.sourceTime, 3);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await snapshot(page)).state).toBe('playing');
  expect(Math.abs((await snapshot(page)).drift)).toBeLessThan(.065);

  await page.evaluate(() => window.__tangent.seek(544 / 30));
  await page.keyboard.press('Space');
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'welcome');
  await page.waitForTimeout(180);
  const ended = await snapshot(page);
  expect(ended.state).toBe('playing');
  expect(ended.sourceTime).toBeGreaterThan(545 / 30);
  expect(ended.rms).toBeGreaterThan(.001);
});

test('音轨载入失败保留电源、前景时钟与重播交互', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/interactive-cycle.m4a', (route) => route.abort());
  await ready(page);
  await expect.poll(async () => (await snapshot(page)).state).toBe('unavailable');
  await page.evaluate(() => window.__tangent.seek(4.8));
  await page.locator('#power').click();
  await expect.poll(() => page.evaluate(() => window.__tangent.getTime())).toBeGreaterThan(5);
  await page.keyboard.press('r');
  await expect.poll(() => page.evaluate(() => window.__tangent.getTime())).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('完整身份语音在电源后连续播放，渲染延迟不会重启语音',async({page})=>{
 await page.addInitScript(()=>{
   const start=AudioBufferSourceNode.prototype.start;
   (window as any).__audioStarts=[];
   AudioBufferSourceNode.prototype.start=function(...args:Parameters<typeof start>){
     (window as any).__audioStarts.push(args[1]);return start.apply(this,args);
   };
 });
 await ready(page);await page.evaluate(()=>window.__tangent.seek(4.8));await page.locator('#power').click();
 await expect.poll(async()=>(await snapshot(page)).state).toBe('playing');
 // Stall a real browser frame midway through the spoken cue.
 await page.waitForTimeout(300);
 await page.evaluate(()=>{const until=performance.now()+120;while(performance.now()<until){/* deliberately block */}});
 await page.waitForTimeout(500);
 const evidence=await page.evaluate(()=>({starts:(window as any).__audioStarts as number[],audio:window.__tangent.getAudioState()}));
 expect(evidence.starts).toHaveLength(1);expect(evidence.starts[0]).toBe(4.8);
 expect(evidence.audio.sourceTime).toBeGreaterThan(5.5);
 expect(evidence.audio.corrections).toBe(0);
});

test('WELCOME 后音乐继续六秒并渐弱；暂停、后台、静音和重播保持收尾相位',async({page})=>{
 test.setTimeout(30000);
 await ready(page);await page.evaluate(()=>window.__tangent.seek(4.8));await page.locator('#power').click();
 await expect.poll(async()=>(await snapshot(page)).state).toBe('playing');
 await page.evaluate(()=>window.__tangent.seek(544/30));await page.keyboard.press('Space');
 await expect(page.locator('#stage')).toHaveAttribute('data-state','welcome');
 await page.waitForTimeout(500);
 const held=await snapshot(page);expect(held.state).toBe('playing');expect(held.volume).toBeGreaterThan(.99);
 expect(held.sourceTime).toBeGreaterThan(18.5);expect(held.rms).toBeGreaterThan(.001);
 expect(await page.evaluate(()=>window.__tangent.getTime())).toBeCloseTo(545/30,5);
 await page.keyboard.press('Space');const paused=await snapshot(page);await page.waitForTimeout(200);
 expect((await snapshot(page)).sourceTime).toBeCloseTo(paused.sourceTime,3);expect((await snapshot(page)).rms).toBeLessThan(.00001);
 await page.keyboard.press('Space');await expect.poll(async()=>(await snapshot(page)).sourceTime).toBeGreaterThan(paused.sourceTime+.15);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden=await snapshot(page);await page.waitForTimeout(150);
 expect((await snapshot(page)).sourceTime).toBeCloseTo(hidden.sourceTime,3);expect((await snapshot(page)).rms).toBeLessThan(.00001);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(async()=>(await snapshot(page)).volume,{timeout:7000,intervals:[50]}).toBeLessThan(.85);
 const early=await snapshot(page);await page.waitForTimeout(400);expect((await snapshot(page)).volume).toBeLessThan(early.volume-.1);
 await page.keyboard.press('s');await page.waitForTimeout(100);expect((await snapshot(page)).rms).toBeLessThan(.00001);
 await page.keyboard.press('s');await page.waitForTimeout(100);expect((await snapshot(page)).volume).toBeLessThan(.65);
 await expect.poll(async()=>(await snapshot(page)).state,{timeout:6000}).toBe('ready');
 expect((await snapshot(page)).sourceTime).toBeCloseTo(545/30+6,3);
 expect((await snapshot(page)).rms).toBeLessThan(.00001);expect((await snapshot(page)).volume).toBeLessThan(.005);
 await page.keyboard.press('r');await expect.poll(async()=>(await snapshot(page)).volume).toBeGreaterThan(.99);
 await expect.poll(async()=>(await snapshot(page)).sourceTime).toBeLessThan(.5);
});

test('首次球体等待不漏播开头语音；点击精确从音轨0开始',async({page})=>{
 await page.addInitScript(()=>{
   const start=AudioBufferSourceNode.prototype.start;(window as any).__starts=[];
   AudioBufferSourceNode.prototype.start=function(...args:Parameters<typeof start>){(window as any).__starts.push(args[1]);return start.apply(this,args);};
 });
 await ready(page);
 await page.waitForTimeout(600);
 expect(await page.evaluate(()=>window.__tangent.getTime())).toBe(0);
 expect((await snapshot(page)).contextState).toBe('not-created');
 await page.locator('#start').click();
 await expect.poll(async()=>(await snapshot(page)).rms).toBeGreaterThan(.001);
 expect(await page.evaluate(()=>(window as any).__starts)).toEqual([0]);
 await expect(page.locator('#start')).toBeHidden();
 await expect(page.locator('#power')).toBeVisible({timeout:7000});
 expect((await snapshot(page)).state).toBe('ready');
 expect(await page.evaluate(()=>window.__tangent.getTime())).toBe(4.8);
});
