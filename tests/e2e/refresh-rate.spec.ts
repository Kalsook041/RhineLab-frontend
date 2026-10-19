import {expect,test} from '@playwright/test';

test('球体等待跟随每次浏览器刷新，不再隔帧绘制',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 const result=await page.evaluate(async()=>{
  const canvas=document.querySelector<HTMLElement>('#background')!,times:string[]=[];let start=0;
  await new Promise<void>(resolve=>{function tick(now:number){if(!start)start=now;times.push(canvas.dataset.motionTime!);if(now-start<1200)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
  return{samples:times.length,updates:times.slice(1).filter((t,i)=>t!==times[i]).length,source:window.__tangent.getTime()};
 });
 expect(result.samples).toBeGreaterThan(8);expect(result.updates/(result.samples-1)).toBeGreaterThan(.8);expect(result.source).toBe(0);
});

test('同一个原片帧内圆弧、请求框和WELCOME仍有中间姿态，关键事件帧不变',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 const at=async(f:number)=>{await page.evaluate(f=>window.__tangent.seek(f/30),f);};
 const arc=async()=>Number((await page.locator('#power-arc').getAttribute('stroke-dasharray'))!.split(' ')[0]);
 await at(90);const a=await arc();await at(90.5);const b=await arc();await expect(page.locator('#interface')).toHaveAttribute('data-frame','90');await at(91);const c=await arc();expect(b).toBeCloseTo((a+c)/2,6);expect(b).toBeGreaterThan(a);
 await at(260);const x=Number(await page.locator('#request-ghost-2').getAttribute('width'));await at(260.5);const y=Number(await page.locator('#request-ghost-2').getAttribute('width'));expect(y).toBeGreaterThan(x);await expect(page.locator('#interface')).toHaveAttribute('data-frame','260');
 await at(500);const pose=await page.locator('#welcome-letter-0').getAttribute('transform');await at(500.5);expect(await page.locator('#welcome-letter-0').getAttribute('transform')).not.toBe(pose);
 await at(252.5);await expect(page.locator('#request-frame')).toHaveCSS('visibility','hidden');
 await at(144);expect(await page.evaluate(()=>window.__tangent.getState())).toBe('waiting');
});
