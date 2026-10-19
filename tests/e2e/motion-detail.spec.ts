import {expect,test,type Page} from '@playwright/test';

declare global {interface Window {__tangent:{seek(time:number):Promise<void>;getTime():number;getState():string;restart():void|Promise<void>}}}
async function ready(page:Page) {
  await page.setViewportSize({width:1920,height:1080});await page.goto('/');
  await page.waitForFunction(()=>Boolean(window.__tangent));
}
async function cloudWidth(page:Page,frame:number) {
  await page.evaluate(t=>window.__tangent.seek(t),frame/30);
  return page.locator('#background').evaluate(node=>{
    const canvas=node as HTMLCanvasElement,ctx=canvas.getContext('2d')!,s=canvas.width/1920;
    const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,widths:number[]=[];
    // Thin horizontal slices avoid treating the curved path's longitudinal
    // extent as particle spread. Separate the two strands at the largest gap.
    for(let y=260;y<980;y+=30) {
      const xs:number[]=[];
      for(let py=Math.round(y*s);py<Math.round((y+4)*s);py++)for(let px=Math.round(25*s);px<Math.round(720*s);px++) {
        const at=(py*canvas.width+px)*4;
        if(data[at]<190&&data[at+1]<190)xs.push(px/s);
      }
      xs.sort((a,b)=>a-b);if(xs.length<6)continue;
      let gap=0,split=0;for(let i=1;i<xs.length;i++)if(xs[i]-xs[i-1]>gap){gap=xs[i]-xs[i-1];split=i;}
      const groups=gap>30?[xs.slice(0,split),xs.slice(split)]:[xs];
      for(const group of groups)if(group.length>=4)widths.push(group[Math.floor(group.length*.9)]-group[Math.floor(group.length*.1)]);
    }
    widths.sort((a,b)=>a-b);return {samples:widths.length,median:widths[Math.floor(widths.length/2)]??0};
  });
}

test('曲线实际像素先扩散成点云，再收拢为新形态，回看同帧确定',async({page})=>{
  await ready(page);const formed=await cloudWidth(page,108),scattered=await cloudWidth(page,122),reformed=await cloudWidth(page,138);
  expect(formed.samples).toBeGreaterThan(12);expect(scattered.samples).toBeGreaterThan(12);
  expect(scattered.median).toBeGreaterThan(formed.median+12);
  expect(scattered.median).toBeGreaterThan(reformed.median+12);
  expect(await cloudWidth(page,122)).toEqual(scattered);
});

test('片头螺旋粒子沿轨迹流动，不能只移动整条曲线；亚帧运动连续',async({page})=>{
  await ready(page);
  const result=await page.evaluate(async()=>{
    const moduleUrl='/src/renderers/openingParticles.ts';
    const {createOpeningParticles}=await import(moduleUrl);
    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
    const ctx=canvas.getContext('2d')!,arc=ctx.arc.bind(ctx);let points:number[][]=[];
    ctx.arc=(x,y,r,start,end,ccw)=>{points.push([x,y]);arc(x,y,r,start,end,ccw);};
    const renderer=createOpeningParticles(ctx,[],[]);
    const sample=(frame:number,time:number)=>{points=[];renderer.orbits(frame,time);return points;};
    const a=sample(78,2.6),b=sample(96,3.2);
    const visible=a.slice(0,2700).map((p,i)=>({p,q:b[i]})).filter(({p,q})=>p[0]>30&&p[0]<700&&p[1]>150&&p[1]<950&&q[0]>30&&q[0]<700&&q[1]>150&&q[1]<950);
    const delta=visible.map(({p,q})=>[q[0]-p[0],q[1]-p[1]]);
    const median=(values:number[])=>values.sort((x,y)=>x-y)[Math.floor(values.length/2)];
    const dx=median(delta.map(p=>p[0])),dy=median(delta.map(p=>p[1]));
    const residual=median(delta.map(p=>Math.hypot(p[0]-dx,p[1]-dy)));
    const tiny=sample(78,2.6+.001);
    const small=visible.map(({p})=>{const index=a.indexOf(p),q=tiny[index];return Math.hypot(q[0]-p[0],q[1]-p[1]);});
    // The right helix now sorts by depth; track a stable particle's axis position
    // instead of treating paint-call indexes as particle identities.
    const rightUrl='/src/renderers/rightHelix.ts';const {createRightHelix}=await import(rightUrl);
    const right=createRightHelix(ctx);right.render(78,2.6,1);const beforeU=right.getParticle(450).u;
    right.render(96,3.2,1);const rightDy=right.getParticle(450).u-beforeU;
    const geometry=await (await fetch('/assets/native/globe-points.json')).json();
    // Track a single geographic landmark. Depth-sorted paint slots are not
    // stable IDs; particles can also enter/leave the fallback's visible limb.
    const globe=createOpeningParticles(ctx,geometry,[[0,0]]);
    points=[];globe.sphere(0,0);const sphereStart=points;
    points=[];globe.sphere(6,.2);const sphereNext=points;
    const globeDx=sphereNext[0][0]-sphereStart[0][0];
    return {residual,dy,rightDy,globeDx,subframe:median(small),visible:visible.length};
  });
  expect(result.visible).toBeGreaterThan(800);
  expect(result.residual).toBeGreaterThan(2);
  expect(result.dy).toBeLessThan(-2);
  expect(result.rightDy).toBeLessThan(-2);
  expect(result.globeDx).toBeLessThan(-2);
  expect(result.subframe).toBeGreaterThan(.005);
  expect(result.subframe).toBeLessThan(.1);
});

async function confirmationPixels(page:Page,frame:number) {
  await page.evaluate(t=>window.__tangent.seek(t),frame/30);
  const png=await page.screenshot({clip:{x:735,y:465,width:150,height:150}});
  return page.evaluate(async url=>{
    const image=new Image();image.src=url;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=150;canvas.height=150;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
    const data=ctx.getImageData(0,0,150,150).data;let ring=0,mark=0,thickness=0;
    const ink=(x:number,y:number)=>data[(y*150+x)*4]<185;
    for(let y=0;y<150;y++)for(let x=0;x<150;x++)if(ink(x,y)) {
      const radius=Math.hypot(x+735-812,y+465-540);
      if(radius>=53&&radius<=67)ring++;else if(radius<50)mark++;
    }
    for(let x=5;x<35;x++)if(ink(x,75))thickness++;
    return {ring,mark,thickness};
  },`data:image/png;base64,${png.toString('base64')}`);
}

test('右双螺旋旋转带有前后深度，粒子粗细和透明度不能全部相同',async({page})=>{
  await ready(page);
  const result=await page.evaluate(async()=>{
    const url='/src/renderers/openingParticles.ts';const {createOpeningParticles}=await import(url);
    const c=document.createElement('canvas');c.width=1920;c.height=1080;
    const ctx=c.getContext('2d')!,arc=ctx.arc.bind(ctx),points:Array<{x:number;y:number;r:number;opacity:number}>=[];
    ctx.arc=(x,y,r,...args)=>{points.push({x,y,r,opacity:ctx.globalAlpha});arc(x,y,r,...args);};
    const draw=ctx.drawImage.bind(ctx);ctx.drawImage=(...args:Parameters<typeof ctx.drawImage>)=>{
      const [,x,y,w,h]=args as unknown as [CanvasImageSource,number,number,number,number];
      points.push({x:x+w/2,y:y+h/2,r:w/2,opacity:ctx.globalAlpha});draw(...args);
    };
    createOpeningParticles(ctx,[],[]).orbits(144,4.8);
    const right=points.filter(p=>p.x>1350&&p.x<1760&&p.y>100&&p.y<850);
    return {count:right.length,alphaRange:Math.max(...right.map(p=>p.opacity))-Math.min(...right.map(p=>p.opacity)),radiusRange:Math.max(...right.map(p=>p.r))-Math.min(...right.map(p=>p.r))};
  });
  expect(result.count).toBeGreaterThan(800);
  expect(result.alphaRange).toBeGreaterThan(.07);
  expect(result.radiusRange).toBeGreaterThan(.25);
});

test('右螺旋同一粒子转到背面时变小变浅，停驻仍持续旋转',async({page})=>{
  await ready(page);
  const result=await page.evaluate(async()=>{
    const url='/src/renderers/rightHelix.ts';const {createRightHelix}=await import(url);
    const c=document.createElement('canvas'),ctx=c.getContext('2d')!,right=createRightHelix(ctx);
    right.render(144,4.8,1);
    let id=0,front=right.getParticle(0);
    for(let i=1;i<1800;i++) {const p=right.getParticle(i);if(p.y>100&&p.y<850&&p.z>front.z){id=i;front=p;}}
    const halfTurn=Math.PI/(.46+14/674*Math.PI*2);
    right.render(144,4.8+halfTurn,1);const back=right.getParticle(id);
    right.render(144,4.8+halfTurn+.5,1);const continued=right.getParticle(id);
    return {front,back,continued};
  });
  expect(result.front.z).toBeGreaterThan(100);expect(result.back.z).toBeLessThan(-100);
  expect(result.front.opacity).toBeGreaterThan(result.back.opacity*3);
  expect(result.front.radius).toBeGreaterThan(result.back.radius*1.5);
  expect(Math.abs(result.continued.x-result.back.x)).toBeGreaterThan(10);
});

test('确认环保留原外径并加粗，勾与环分别缺段和闪断',async({page})=>{
  await ready(page);
  const full=await confirmationPixels(page,210),noMark=await confirmationPixels(page,213),arc=await confirmationPixels(page,218),paleRing=await confirmationPixels(page,225);
  expect(full.thickness).toBeGreaterThanOrEqual(9);expect(full.thickness).toBeLessThanOrEqual(11);
  expect(full.ring).toBeGreaterThan(3000);expect(full.mark).toBeGreaterThan(700);
  expect(noMark.ring).toBeGreaterThan(3000);expect(noMark.mark).toBeLessThan(10);
  expect(arc.ring).toBeLessThan(full.ring*.3);expect(arc.mark).toBeGreaterThan(700);
  expect(paleRing.ring).toBeGreaterThan(3000);expect(paleRing.mark).toBeLessThan(10);
  expect(await confirmationPixels(page,210)).toEqual(full);
});
