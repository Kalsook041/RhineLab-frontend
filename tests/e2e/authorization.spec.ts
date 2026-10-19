import {test,expect,type Page} from '@playwright/test';

async function ready(page:Page){
  await page.setViewportSize({width:1920,height:1080});await page.goto('/');
  await page.waitForFunction(()=>Boolean(window.__tangent));
}
const seek=(page:Page,frame:number)=>page.evaluate(t=>window.__tangent.seek(t),frame/30);

test('白卡覆盖旧进度文字，打字停顿和错位回声按源帧展开',async({page})=>{
  await ready(page);await seek(page,379);
  await expect(page.locator('#auth-card')).toBeVisible();
  await expect(page.locator('#processing')).toBeHidden();
  await seek(page,390);await expect(page.locator('#auth-en text')).toHaveText('PERMI');
  const first=await page.locator('#auth-card').boundingBox();
  await seek(page,398);await expect(page.locator('#authorized')).toBeHidden();
  await seek(page,405);await expect(page.locator('#auth-en text')).toHaveText('PERMISION AUTHORIZED');
  await expect(page.locator('#auth-echo')).toBeVisible();
  const front=await page.locator('#auth-card').boundingBox(),echo=await page.locator('#auth-echo').boundingBox();
  expect(front!.x-first!.x).toBeGreaterThan(30);
  expect(front!.x-echo!.x).toBeGreaterThan(60);expect(front!.y-echo!.y).toBeGreaterThan(50);
  const mark=await page.locator('#auth-geometry').boundingBox(),title=await page.locator('#auth-en').boundingBox();
  expect(mark!.y).toBeGreaterThan(title!.y+title!.height);
  expect(mark!.x+mark!.width/2).toBeGreaterThan(970);
  expect(mark!.x+mark!.width/2).toBeLessThan(1010);
  await seek(page,420);await expect(page.locator('#auth-echo')).toBeHidden();
});

test('小图形独立形变，内框持续收缩、间断消失，再压成横条',async({page})=>{
  await ready(page);await seek(page,421);await expect(page.locator('#auth-geometry rect')).toHaveAttribute('fill','currentColor');
  await seek(page,426);await expect(page.locator('#auth-geometry rect')).toHaveAttribute('fill','none');
  await seek(page,429);const first=await page.locator('#auth-border').boundingBox();
  await seek(page,435);const middle=await page.locator('#auth-border').boundingBox();
  expect(first!.height-middle!.height).toBeGreaterThan(90);
  await seek(page,443);await expect(page.locator('#auth-border')).toBeHidden();
  await seek(page,445);await expect(page.locator('#auth-border')).toBeVisible();
  await seek(page,453);const end=await page.locator('#auth-border').boundingBox();
  expect(middle!.height-end!.height).toBeGreaterThan(70);
  await seek(page,457);await expect(page.locator('#auth-border')).toBeHidden();await expect(page.locator('#auth-sides')).toBeVisible();
  await seek(page,461);const strip=await page.locator('#auth-card').boundingBox();expect(strip!.height).toBeLessThan(25);
  for(const frame of [462,466,469]){await seek(page,frame);await expect(page.locator('#auth-card')).toBeHidden();await expect(page.locator('#authorized')).toBeHidden();await expect(page.locator('#welcome-card')).toBeHidden();}
  await seek(page,480);await expect(page.locator('#welcome-card')).toBeVisible();
});
