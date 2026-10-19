import {test,expect} from '@playwright/test';
test.use({launchOptions:{args:['--enable-gpu','--use-angle=d3d11']}});

test('WELCOME 从右侧逐字展开归位，进度条由中心展开并随入场填满',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 await page.evaluate(()=>window.__tangent.seek(491/30));
 const first=await page.locator('#welcome-letter-0').boundingBox();expect(first!.x).toBeGreaterThan(620);expect(first!.x).toBeLessThan(680);
 await expect(page.locator('#welcome-letter-4')).toBeHidden();
 const bar=page.locator('#welcome-bottom rect').nth(0),fill=page.locator('#welcome-bottom rect').nth(1);
 expect(Number(await bar.getAttribute('width'))).toBeLessThan(100);
 await page.evaluate(()=>window.__tangent.seek(507/30));const mid=await page.locator('#welcome-letter-0').boundingBox();
 expect(first!.x-mid!.x).toBeGreaterThan(100);
 const midFill=Number(await fill.getAttribute('width'));expect(midFill).toBeGreaterThan(500);expect(midFill).toBeLessThan(900);
 await page.evaluate(()=>window.__tangent.seek(525/30));
 expect(Number(await fill.getAttribute('width'))).toBeCloseTo(Number(await bar.getAttribute('width'))-2,2);
 await expect(page.locator('#welcome-year text')).toHaveText(String(new Date().getFullYear()));
 expect(Number(await page.locator('#welcome-underline').getAttribute('stroke-dasharray'))||0).toBe(0);
 await page.evaluate(()=>window.__tangent.seek(4.8));
 await expect(page.locator('#credit-year-outline text')).toHaveText(String(new Date().getFullYear()).slice(2));
 await page.evaluate(()=>window.__tangent.seek(60/30));
 await expect(page.locator('#access-en text')).toHaveAttribute('font-family','TangentAccess');
 expect(await page.evaluate(()=>document.fonts.check('100px TangentAccess','ACCESS PERMISSION REQUIRED'))).toBe(true);
});

test.describe('字形滤镜边缘',()=>{
 test('1280宽视口下，字形右侧空白不产生整组阴影的竖线',async({page})=>{
   await page.setViewportSize({width:1280,height:720});await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
   await page.evaluate(()=>window.__tangent.seek(545/30));const png=await page.screenshot();
   const rows=await page.evaluate(async url=>{
     const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,1280,720).data;let darkRows=0;
     for(let y=220;y<430;y++){
       const neighbors=Array.from({length:5},(_,j)=>pixels[(y*1280+962+j)*4]).sort((a,b)=>a-b);
       const edge=Math.min(...Array.from({length:6},(_,j)=>pixels[(y*1280+970+j)*4]));
       if(neighbors[2]-edge>6)darkRows++;
     }return darkRows;
   },`data:image/png;base64,${png.toString('base64')}`);
   expect(rows).toBeLessThan(5);
 });
});
