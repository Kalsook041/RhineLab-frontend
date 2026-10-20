import {expect,test} from '@playwright/test';

test('Pages生产子路径加载全部素材，点击登录后完整到达WELCOME',async({page,baseURL})=>{
 const errors:string[]=[],badResponses:string[]=[],rootRequests:string[]=[],assets=new Set<string>();
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{const u=new URL(response.url());if(u.origin!==new URL(baseURL!).origin)return;if(response.status()>=400)badResponses.push(`${response.status()} ${u.pathname}`);if(u.pathname.includes('/assets/'))assets.add(u.pathname);});
 page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/assets/'))rootRequests.push(request.url());});
 await page.goto('./');await page.waitForFunction(()=>Boolean(window.__tangent));
 await expect(page.locator('#stage')).toHaveAttribute('data-state','ready');
 expect(await page.evaluate(()=>document.fonts.check('100px TangentAccess'))).toBe(true);
 const map=await page.request.get('assets/native/world-points.json');expect(map.ok()).toBe(true);expect((await map.json()).length).toBeGreaterThan(3000);
 await page.locator('#start').click();await expect(page.locator('#power')).toBeEnabled({timeout:12000});
 expect(await page.locator('#account').inputValue()).toBe('admin');await expect(page.locator('#password')).toHaveAttribute('type','password');
 await page.waitForFunction(()=>window.__tangent.getAudioState().duration>24);
 await page.locator('#power').click();await page.waitForFunction(()=>window.__tangent.getState()==='welcome',null,{timeout:22000});
 await expect(page.locator('#welcome-title')).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth)).toBe(true);
 for(const path of ['world-points.json','globe-points.json','access-reference.woff2','interactive-cycle.m4a'])expect([...assets].some(url=>url.startsWith('/RhineLab-frontend/assets/')&&url.endsWith(path))).toBe(true);
 expect(errors).toEqual([]);expect(badResponses).toEqual([]);expect(rootRequests).toEqual([]);expect(await page.locator('video,img,image').count()).toBe(0);
});
