import {expect,test} from '@playwright/test';

test('球体等待源时间固定、粒子持续运动，点击保留相位并从零播放',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 const sample=()=>page.evaluate(()=>{
   const canvas=document.querySelector<HTMLCanvasElement>('#background')!,data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
   let hash=0;for(let i=0;i<data.length;i+=28)hash=(Math.imul(hash,31)+data[i])|0;
   return{hash,source:window.__tangent.getTime(),motion:Number(canvas.dataset.motionTime),frame:Number(canvas.dataset.frame)};
 });
 const a=await sample();await page.waitForTimeout(600);const b=await sample();
 expect(a.source).toBe(0);expect(b.source).toBe(0);expect(b.frame).toBe(0);
 expect(b.motion).toBeGreaterThan(a.motion+.4);expect(b.hash).not.toBe(a.hash);
 await expect(page.locator('#credentials')).toBeHidden();await expect(page.locator('#power')).toBeHidden();
 await page.locator('#start').click();
 await expect.poll(()=>page.evaluate(()=>window.__tangent.getTime())).toBeGreaterThan(.1);
 expect((await sample()).motion).toBeGreaterThan(b.motion);
});

test('球体长时间旋转保留可见半球、圆形边界和不同的前后粒径',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 const samples=await page.evaluate(async()=>{
   const {createOpeningParticles}=await import('/src/renderers/openingParticles.ts');
   const points=await (await fetch('/assets/native/globe-points.json')).json();
   const map=await (await fetch('/assets/native/world-points.json')).json();
   let data:number[][]=[];
   const ctx={fillStyle:'',globalAlpha:1,beginPath(){},fill(){},arc(x:number,y:number,r:number){data.push([x,y,r,this.globalAlpha]);}};
   const globe=createOpeningParticles(ctx as unknown as CanvasRenderingContext2D,points,map);
   return [0,8,21,42,64,84].map(time=>{
     data=[];globe.sphere(0,time);
     const radius=data.map(([x,y])=>Math.hypot(x-960,y-530)).sort((a,b)=>a-b);
     const sizes=data.map(p=>p[2]).sort((a,b)=>a-b);
     return{time,count:data.length,radius:radius[Math.floor(radius.length*.99)],min:sizes[Math.floor(sizes.length*.1)],max:sizes[Math.floor(sizes.length*.9)]};
   });
 });
 for(const s of samples){expect(s.count).toBeGreaterThan(2100);expect(s.radius).toBeGreaterThan(500);expect(s.radius).toBeLessThan(545);expect(s.max-s.min).toBeGreaterThan(.4);}
});
