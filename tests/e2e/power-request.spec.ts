import {expect,test} from '@playwright/test';

async function at(page:import('@playwright/test').Page,frame:number){await page.evaluate(f=>window.__tangent.seek(f/30),frame);}

test('电源弧逐步收笔，竖笔和分隔线生长，文件横向展开',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 await at(page,90);
 const fraction=Number((await page.locator('#power-arc').getAttribute('stroke-dasharray'))!.split(' ')[0]);
 expect(fraction).toBeGreaterThan(.8);expect(fraction).toBeLessThan(.9);
 await at(page,104);
 const first=await page.evaluate(()=>({stem:(document.querySelector('#power-stem') as SVGGraphicsElement).getBBox().height,divider:(document.querySelector('#identity-divider') as SVGGraphicsElement).getBBox().height,file:Number(document.querySelector('#file-icon')!.getAttribute('width'))}));
 expect(first.stem).toBeLessThan(16);expect(first.divider).toBeLessThan(25);expect(first.file).toBeLessThan(16);
 await at(page,106);expect(Number(await page.locator('#file-icon').getAttribute('x'))).toBeLessThanOrEqual(1050);
 await at(page,114);
 const end=await page.evaluate(()=>({stem:(document.querySelector('#power-stem') as SVGGraphicsElement).getBBox().height,divider:(document.querySelector('#identity-divider') as SVGGraphicsElement).getBBox().height,file:Number(document.querySelector('#file-icon')!.getAttribute('width'))}));
 expect(end.stem).toBeGreaterThan(30);expect(end.divider).toBeGreaterThan(140);expect(end.file).toBe(53);
});

test('请求框持续扩张回声、保留原片空帧，文字字高与下划线独立展开',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));
 await at(page,251);expect(Number(await page.locator('#request-frame').evaluate(n=>getComputedStyle(n).opacity))).toBeGreaterThan(.8);
 expect(Number(await page.locator('#request-en svg').getAttribute('width'))).toBeLessThan(230);
 await at(page,252);await expect(page.locator('#request-frame')).toHaveCSS('visibility','hidden');
 await at(page,255);expect(Number(await page.locator('#request-frame').evaluate(n=>getComputedStyle(n).opacity))).toBeGreaterThan(.8);
 await at(page,257);await expect(page.locator('#request-en svg')).toHaveAttribute('overflow','visible');
 const widths=async()=>page.locator('#request-frames rect').evaluateAll(ns=>ns.map(n=>Number(n.getAttribute('width'))));
 await at(page,260);const early=await widths(),short=await page.locator('#request-line').evaluate(n=>(n as SVGPathElement).getTotalLength());
 await at(page,270);const late=await widths(),long=await page.locator('#request-line').evaluate(n=>(n as SVGPathElement).getTotalLength());
 expect(late.length).toBe(6);expect(late[1]-early[1]).toBeGreaterThan(5);expect(late[3]-early[3]).toBeGreaterThan(30);
 expect(late[0]).toBeLessThan(early[0]);expect(long).toBeGreaterThan(short+150);
 // Source echo strokes occupy several soft rows, rather than single-pixel wireframes.
 const echoShot=await page.screenshot({clip:{x:850,y:240,width:220,height:20}});
 const echoRows=await page.evaluate(async url=>{
  const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=220;c.height=20;const ctx=c.getContext('2d')!;ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,220,20).data;let rows=0;
  for(let y=0;y<20;y++)if(pixels[(y*220+110)*4]<180)rows++;return rows;
 },`data:image/png;base64,${echoShot.toString('base64')}`);
 expect(echoRows).toBeGreaterThanOrEqual(3);expect(echoRows).toBeLessThanOrEqual(7);
 // Incoming Chinese glyphs cross this band during typing; measure the English
 // cap after they have landed, so this is not a mixed-line bounding box.
 await at(page,286);
 const shot=await page.screenshot({clip:{x:838,y:550,width:250,height:26}});
 const height=await page.evaluate(async url=>{
  const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=250;c.height=26;const ctx=c.getContext('2d')!;ctx.drawImage(im,0,0);const data=ctx.getImageData(0,0,250,26).data,rows:number[]=[];
  for(let y=0;y<26;y++){let ink=0;for(let x=0;x<250;x++)if(data[(y*250+x)*4]<150)ink++;if(ink>3)rows.push(y);}
  return Math.max(...rows)-Math.min(...rows)+1;
 },`data:image/png;base64,${shot.toString('base64')}`);
 expect(height).toBeGreaterThanOrEqual(18);expect(height).toBeLessThanOrEqual(20);
});
