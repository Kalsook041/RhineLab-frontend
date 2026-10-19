import {expect,test} from '@playwright/test';

test('地球退出先保持球面旋转退远，球径和粒径一起缩小后才隐去',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 const samples=await page.evaluate(async()=>{
  const {createOpeningParticles}=await import('/src/renderers/openingParticles.ts');
  const geometry=await(await fetch('/assets/native/globe-points.json')).json(),map=await(await fetch('/assets/native/world-points.json')).json();
  let data:number[][]=[];
  const ctx={fillStyle:'',globalAlpha:1,beginPath(){},fill(){},arc(x:number,y:number,r:number){data.push([x,y,r,this.globalAlpha]);}};
  const scene=createOpeningParticles(ctx as unknown as CanvasRenderingContext2D,geometry,map);
  const result=[0,12,24,36,48,60].map(f=>{
   data=[];scene.sphere(f,f/30);
   const radii=data.map(p=>Math.hypot(p[0]-960,p[1]-530)).sort((a,b)=>a-b),sizes=data.map(p=>p[2]).sort((a,b)=>a-b);
   return{frame:f,count:data.length,radius:radii[Math.floor(radii.length*.98)]??0,size:sizes[Math.floor(sizes.length*.5)]??0,alpha:data.reduce((s,p)=>s+p[3],0)/Math.max(1,data.length)};
  });
  const landmark=createOpeningParticles(ctx as unknown as CanvasRenderingContext2D,geometry,[[0,0]]);
  data=[];landmark.sphere(36,36/30);
  return{result,landmarkX:data[0][0]};
 });
 const initial=samples.result[0],middle=samples.result[3];
 expect(middle.count).toBeGreaterThan(initial.count*.95);
 expect(middle.radius/initial.radius).toBeGreaterThan(.7);
 expect(middle.radius/initial.radius).toBeLessThan(.9);
 expect(middle.size/initial.size).toBeLessThan(.9);
 expect(middle.alpha/initial.alpha).toBeGreaterThan(.4);
 expect(samples.result[4].size).toBeLessThan(middle.size);
 expect(samples.result[5].count).toBe(0);
 expect(samples.landmarkX).toBeLessThan(700);
});
