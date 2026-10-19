import {expect,test} from '@playwright/test';

test('地球转过半圈露出另一组大陆，不重复复制首个半球',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 const result=await page.evaluate(async()=>{
  const {createOpeningParticles}=await import('/src/renderers/openingParticles.ts');
  const geometry=await(await fetch('/assets/native/globe-points.json')).json(),map=await(await fetch('/assets/native/world-points.json')).json();
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
  const ctx=canvas.getContext('2d')!,globe=createOpeningParticles(ctx,geometry,map);
  // Compare a coarse optical-density field, not Canvas paint-call order.
  const sample=(time:number)=>{
   ctx.fillStyle='#e5e4dd';ctx.fillRect(0,0,1920,1080);globe.sphere(0,time);
   const data=ctx.getImageData(430,0,1060,1060).data,grid=new Float64Array(20*20);
   for(let y=0;y<1060;y++)for(let x=0;x<1060;x++)grid[Math.floor(y/53)*20+Math.floor(x/53)]+=Math.max(0,229-data[(y*1060+x)*4]);
   return grid;
  };
  const a=sample(0),b=sample(Math.PI/.075),full=sample(2*Math.PI/.075);
  let half=0,cycle=0,mass=0;
  for(let i=0;i<a.length;i++){half+=Math.abs(a[i]-b[i]);cycle+=Math.abs(a[i]-full[i]);mass+=a[i]+b[i];}
  return{half:half/mass,cycle:cycle/mass};
 });
 expect(result.half).toBeGreaterThan(.15);expect(result.cycle).toBeLessThan(.001);
});

test('初始地球等待后，双螺旋进入电源等待及登录时不回拨相位',async({page})=>{
 test.setTimeout(30_000);
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 await page.evaluate(()=>{
  const samples:Array<{source:number;motion:number}>=[];
  (window as unknown as {particleSamples:typeof samples}).particleSamples=samples;
  const observe=()=>{
   samples.push({source:window.__tangent.getTime(),motion:Number(document.querySelector<HTMLElement>('#background')!.dataset.motionTime)});
   requestAnimationFrame(observe);
  };requestAnimationFrame(observe);
 });
 await page.waitForTimeout(1000);await page.locator('#start').click();
 await expect(page.locator('#stage')).toHaveAttribute('data-state','waiting',{timeout:9000});
 await page.waitForTimeout(350);await page.locator('#power').click();
 await expect.poll(()=>page.evaluate(()=>window.__tangent.getTime())).toBeGreaterThan(5.1);
 const samples=await page.evaluate(()=>(window as unknown as {particleSamples:Array<{source:number;motion:number}>}).particleSamples);
 const differences=samples.slice(1).flatMap((p,i)=>p.source>=2.4&&samples[i].source>=2.4?[p.motion-samples[i].motion]:[]);
 expect(Math.min(...differences)).toBeGreaterThanOrEqual(-.001);
 // The ready-globe delay belongs to that field only. After the empty f61–71
 // interval, both curve forms start at their original source phase.
 const firstCurve=samples.find(p=>p.source>=2.6)!;
 expect(firstCurve.motion-firstCurve.source).toBeGreaterThan(-.034);
 expect(firstCurve.motion-firstCurve.source).toBeLessThan(.001);
 const before=samples.filter(p=>p.source>4.6&&p.source<4.8).at(-1)!;
 const after=samples.find(p=>p.source===4.8)!;
 expect(before).toBeTruthy();expect(after).toBeTruthy();
 expect(after.motion-before.motion).toBeGreaterThanOrEqual(0);
 expect(after.motion-before.motion).toBeLessThan(.15);
 // Login resumes the same phase and a growing source clock, without a seek.
 const resumed=samples.find(p=>p.source>4.9)!;
 expect(resumed.motion-resumed.source).toBeGreaterThan(after.motion-after.source+.1);
});
