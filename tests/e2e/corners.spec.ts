import {expect,test,type Page} from '@playwright/test';

async function ready(page:Page){await page.goto('/');await page.waitForFunction(()=>window.__tangent);}
const poses=(page:Page)=>page.locator('#brand-squares').evaluate(n=>Array.from(n.querySelectorAll('rect')).map(s=>{
 const m=s.getCTM()!;return{x:m.e,y:m.f,angle:((Math.atan2(m.b,m.a)*180/Math.PI)%90+90)%90,transform:s.getAttribute('transform')};
}));

test('角标按原片分阶段入场，方块从右上弧线落下并持续错峰翻转',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});await ready(page);
 for(const [frame,x,y] of [[123,289,148],[135,258.91,201.67],[150,184,232],[198,136.69,224.83]]){
  await page.evaluate(t=>window.__tangent.seek(t),frame/30);const points=await poses(page);
  expect(points[0].x).toBeCloseTo(x,0);expect(Math.abs(points[0].y-y)).toBeLessThan(1);
 }
 await page.evaluate(()=>window.__tangent.seek(144/30));
 const alpha=await page.locator('#brand-title').evaluate(n=>Number(getComputedStyle(n).opacity));
 expect(alpha).toBeGreaterThan(.2);expect(alpha).toBeLessThan(.4);
 await page.evaluate(()=>window.__tangent.seek(168/30));
 for(const id of ['brand-title','brand-small','brand-os','brand-os-bold']){
  const style=await page.locator('#'+id).evaluate(n=>({opacity:getComputedStyle(n).opacity,filter:getComputedStyle(n).filter}));
  expect(style.opacity).toBe('1');expect(style.filter).toBe('none');
 }
 const rolling=await poses(page);expect(rolling[0].angle).toBeGreaterThan(75);
 expect(rolling[0].angle-rolling[1].angle).toBeGreaterThan(8);expect(rolling[1].angle-rolling[2].angle).toBeGreaterThan(20);
});

test('电源等待时文字完成且方块仍运动；登录不倒退，Space和后台可冻结',async({page})=>{
 await ready(page);await page.evaluate(()=>window.__tangent.seek(4.6));await page.keyboard.press('Space');
 await expect(page.locator('#stage')).toHaveAttribute('data-state','waiting');await page.waitForTimeout(1400);
 await expect(page.locator('#brand-small')).toHaveCSS('opacity','1');
 const before=await poses(page);await page.waitForTimeout(220);expect(await poses(page)).not.toEqual(before);
 expect(await page.evaluate(()=>window.__tangent.getTime())).toBe(4.8);
 await page.keyboard.press('Space');const paused=await poses(page);await page.waitForTimeout(180);expect(await poses(page)).toEqual(paused);
 await page.keyboard.press('Space');await page.waitForTimeout(100);expect(await poses(page)).not.toEqual(paused);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden=await poses(page);await page.waitForTimeout(180);expect(await poses(page)).toEqual(hidden);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 const titleBefore=await page.locator('#brand-title').boundingBox();await page.locator('#power').click();
 await expect.poll(()=>page.evaluate(()=>window.__tangent.getTime())).toBeGreaterThan(4.9);
 await expect(page.locator('#brand-title')).toHaveCSS('opacity','1');
 expect(await page.locator('#brand-title').boundingBox()).toEqual(titleBefore);
});

test('不同视口角标贴边、署名避开竖线，低运动偏好静止方块',async({page})=>{
 await ready(page);
 for(const viewport of [{width:1920,height:938},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.evaluate(()=>window.__tangent.seek(180/30));
  await expect(page.locator('#credit-name')).toHaveText('TANGENTJZ');
  const spacing=await page.evaluate(()=>{const name=document.querySelector('#credit-name text')!.getBoundingClientRect(),stem=document.querySelector('#credit-stem')!.getBoundingClientRect();return{nameRight:name.right,stemX:stem.x};});
  expect(spacing.nameRight).toBeLessThan(spacing.stemX);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.__tangent.seek(144/30));
 const still=await poses(page);await page.waitForTimeout(200);expect(await poses(page)).toEqual(still);
 await expect(page.locator('#brand-small')).toHaveCSS('opacity','1');
});
