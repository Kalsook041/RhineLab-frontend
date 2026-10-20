import {expect,test} from '@playwright/test';

/** A controlled 120Hz input clock checks cadence and speed, not display FPS. */
type Clock={step(frames:number):void;freeze():void};
type TestWindow=typeof window&{__refreshClock:Clock};

test('120Hz输入时钟：停驻逐次更新，播放不加速，WELCOME保留帧内姿态',async({page})=>{
 await page.addInitScript(()=>{
  const nativeRAF=window.requestAnimationFrame.bind(window),nativeCancel=window.cancelAnimationFrame.bind(window),nativeNow=Date.now.bind(Date);
  const callbacks=new Map<number,FrameRequestCallback>();let id=0,scheduled=0,manual=false,elapsed=0,epoch=0,origin=0;
  const flush=(now:number)=>{scheduled=0;const batch=[...callbacks.values()];callbacks.clear();for(const callback of batch)callback(now);if(!manual&&callbacks.size&&!scheduled)scheduled=nativeRAF(flush);};
  window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);if(!manual&&!scheduled)scheduled=nativeRAF(flush);return id;};
  window.cancelAnimationFrame=key=>{callbacks.delete(key);};
  Date.now=()=>manual?epoch+Math.floor(elapsed):nativeNow();
  Object.assign(window,{__refreshClock:{freeze(){epoch=nativeNow();origin=performance.now();manual=true;nativeCancel(scheduled);scheduled=0;},step(frames:number){for(let i=0;i<frames;i++){elapsed+=1000/120;flush(origin+elapsed);}}}});
  // Only this clock test uses the GSAP fallback clock. Real audio retains its
  // device clock in production and has separate integration coverage.
  Object.defineProperty(window,'AudioContext',{configurable:true,value:undefined});
 });
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 const idle=await page.evaluate(()=>{
  const w=window as TestWindow,c=document.querySelector<HTMLElement>('#background')!;w.__refreshClock.freeze();
  const before=Number(c.dataset.motionTime);let changes=0,last=c.dataset.motionTime;
  for(let i=0;i<240;i++){w.__refreshClock.step(1);if(c.dataset.motionTime!==last)changes++;last=c.dataset.motionTime;}
  return{changes,elapsed:Number(c.dataset.motionTime)-before,source:w.__tangent.getTime()};
 });
 expect(idle.changes).toBeGreaterThanOrEqual(238);expect(idle.elapsed).toBeCloseTo(2,1);expect(idle.source).toBe(0);
 const seek=async(time:number)=>page.evaluate(async time=>{const w=window as TestWindow,p=w.__tangent.seek(time);w.__refreshClock.step(3);await p;},time);
 await seek(2.8);await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector<HTMLElement>('#stage')!.dataset.paused==='false');
 const power=await page.evaluate(()=>{
  const w=window as TestWindow,svg=document.querySelector<HTMLElement>('#interface')!;let changes=0,last=svg.dataset.motionFrame;
  for(let i=0;i<120;i++){w.__refreshClock.step(1);if(svg.dataset.motionFrame!==last)changes++;last=svg.dataset.motionFrame;}
  return{changes,time:w.__tangent.getTime()};
 });
 expect(power.changes).toBeGreaterThanOrEqual(118);expect(power.time).toBeCloseTo(3.8,1);
 await page.evaluate(()=>{(window as TestWindow).__refreshClock.step(125);});
 expect(await page.evaluate(()=>window.__tangent.getState())).toBe('waiting');expect(await page.evaluate(()=>window.__tangent.getTime())).toBe(4.8);
 await seek(16.4);await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector<HTMLElement>('#stage')!.dataset.paused==='false');
 const welcome=await page.evaluate(()=>{
  const w=window as TestWindow,letter=document.getElementById('welcome-letter-0')!;let changes=0,last=letter.getAttribute('transform');
  for(let i=0;i<100;i++){w.__refreshClock.step(1);const pose=letter.getAttribute('transform');if(pose!==last)changes++;last=pose;}
  return{changes,time:w.__tangent.getTime()};
 });
 expect(welcome.changes).toBeGreaterThan(60);expect(welcome.time).toBeCloseTo(16.4+100/120,1);
 await page.evaluate(()=>{(window as TestWindow).__refreshClock.step(120);});
 expect(await page.evaluate(()=>window.__tangent.getState())).toBe('welcome');
 expect(await page.locator('video,img,image').count()).toBe(0);
});
