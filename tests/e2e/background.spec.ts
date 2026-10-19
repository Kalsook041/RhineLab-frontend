import { expect, test, type Page } from '@playwright/test';
declare global { interface Window { __tangent: { seek(time: number): Promise<void>; getTime(): number; getState(): string; restart(): void | Promise<void> } } }
async function ready(page: Page): Promise<void> { await page.goto('/'); await page.waitForFunction(() => Boolean(window.__tangent)); await expect(page.locator('#background')).toHaveJSProperty('tagName','CANVAS'); }
const backgroundTime=(page:Page)=>page.locator('#background').evaluate(node=>Number((node as HTMLElement).dataset.motionTime));
test('原生界面没有视频或 UI 图片，SVG 和 Canvas 在同一源帧完成',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));await ready(page);
 for(const frame of [0,144,225,311,480,540]){await page.evaluate(at=>window.__tangent.seek(at),frame/30);expect(await backgroundTime(page)).toBeCloseTo(frame/30,2);await expect(page.locator('#interface')).toHaveAttribute('data-frame',String(frame));const before=await backgroundTime(page);await page.waitForTimeout(100);expect(await backgroundTime(page)).toBeCloseTo(before,2);}
 expect(await page.locator('video,img,image').count()).toBe(0);expect(requests.filter(url=>/\.(mp4|webm|png|jpg|webp)(\?|$)/i.test(url))).toEqual([]);
 await expect(page.locator('[id^="welcome-glyph-"] text')).toHaveCount(7);
 expect(await page.locator('[id^="welcome-glyph-"] text').allTextContents()).toEqual([..."WELCOME"]);
 for(let i=0;i<7;i++)await expect(page.locator(`#welcome-letter-${i} use`).first()).toHaveAttribute('href',`#welcome-glyph-${i}`);
});
test('M 冻结粒子运动，前景时钟继续；恢复后同步',async({page})=>{
 await ready(page);await page.evaluate(()=>window.__tangent.seek(6));await page.keyboard.press('Space');await expect.poll(()=>page.evaluate(()=>window.__tangent.getTime())).toBeGreaterThan(6.1);await page.keyboard.press('m');const bg=await backgroundTime(page),source=await page.evaluate(()=>window.__tangent.getTime());await page.waitForTimeout(250);expect(await backgroundTime(page)).toBeCloseTo(bg,2);expect(await page.evaluate(()=>window.__tangent.getTime())).toBeGreaterThan(source+.15);await page.keyboard.press('m');
 // Compare both clocks in one browser task. Two protocol round trips can cross
 // a 30fps frame under load and falsely report an extra frame of drift.
 await expect.poll(()=>page.evaluate(()=>Math.abs(Number(document.querySelector<HTMLCanvasElement>('#background')!.dataset.motionTime)-window.__tangent.getTime()))).toBeLessThan(.04);
});
test('隐藏页面冻结整段时钟，恢复后继续',async({page})=>{
 await ready(page);await page.evaluate(()=>window.__tangent.seek(7.5));await page.keyboard.press('Space');const result=await page.evaluate(async()=>{const original=Object.getOwnPropertyDescriptor(document,'hidden');let hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});try{document.dispatchEvent(new Event('visibilitychange'));const at=window.__tangent.getTime();await new Promise(r=>setTimeout(r,220));const frozen=Math.abs(window.__tangent.getTime()-at)<.035;hidden=false;document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,250));return{frozen,resumed:window.__tangent.getTime()>at+.15};}finally{if(original)Object.defineProperty(document,'hidden',original);else Reflect.deleteProperty(document,'hidden');document.dispatchEvent(new Event('visibilitychange'));}});expect(result).toEqual({frozen:true,resumed:true});
});
test('数字地形有局部变形，不能由整张图平移解释',async({page})=>{
 await ready(page);const result=await page.evaluate(async()=>{const bg=document.querySelector<HTMLCanvasElement>('#background')!,terrain=document.querySelector<HTMLCanvasElement>('#terrain')!,w=960,h=540,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d')!;const sample=async(frame:number)=>{await window.__tangent.seek(frame/30);ctx.drawImage(bg,0,0,w,h);if(!terrain.hidden)ctx.drawImage(terrain,0,0,w,h);return ctx.getImageData(0,0,w,h).data;};const a=await sample(510),b=await sample(540);const lum=(data:Uint8ClampedArray,x:number,y:number)=>{const i=(y*w+x)*4;return .2126*data[i]+.7152*data[i+1]+.0722*data[i+2];};let best=Infinity,active=0;for(let dy=-4;dy<=4;dy++)for(let dx=-6;dx<=6;dx++){let error=0,mass=0,count=0;for(let y=380;y<520;y+=3)for(let x=80;x<880;x+=3){const p=lum(a,x,y),q=lum(b,x+dx,y+dy);error+=Math.abs(p-q);mass+=Math.max(p,q);if(p>60)count++;}best=Math.min(best,error/Math.max(1,mass));active=Math.max(active,count);}return{residual:best,active};});expect(result.active).toBeGreaterThan(300);expect(result.residual).toBeGreaterThan(.08);
});

async function backgroundSample(page:Page){return page.locator('#background').evaluate(node=>{
 const canvas=node as HTMLCanvasElement,data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
 let hash=2166136261;for(let i=0;i<data.length;i+=28)hash=Math.imul(hash^(data[i]+data[i+1]*256+data[i+2]*65536),16777619);
 return {time:Number(canvas.dataset.motionTime),hash:hash>>>0};
});}

test('自然停驻时粒子继续流动，M 可冻结，点击电源不重置相位',async({page})=>{
 await ready(page);await page.evaluate(()=>window.__tangent.seek(4.65));await page.keyboard.press('Space');
 await expect(page.locator('#stage')).toHaveAttribute('data-state','waiting');await expect(page.locator('#stage')).toHaveAttribute('data-paused','true');
 await expect.poll(()=>backgroundTime(page)).toBeGreaterThan(4.9);
 const first=await backgroundSample(page),icon=await page.locator('#power-shape').getAttribute('transform');
 await page.waitForTimeout(400);const moving=await backgroundSample(page);
 expect(moving.time).toBeGreaterThan(first.time+.25);expect(moving.hash).not.toBe(first.hash);
 expect(await page.evaluate(()=>window.__tangent.getTime())).toBeCloseTo(4.8,3);
 await expect(page.locator('#interface')).toHaveAttribute('data-frame','144');expect(await page.locator('#power-shape').getAttribute('transform')).toBe(icon);
 await page.keyboard.press('m');const frozen=await backgroundSample(page);await page.waitForTimeout(220);expect(await backgroundSample(page)).toEqual(frozen);
 await page.keyboard.press('m');await expect.poll(()=>backgroundTime(page)).toBeGreaterThan(frozen.time+.1);
 const beforeClick=await backgroundTime(page);await page.locator('#power').click();
 await expect.poll(()=>page.evaluate(()=>window.__tangent.getTime())).toBeGreaterThan(4.9);
 expect(await backgroundTime(page)).toBeGreaterThan(beforeClick); // Never snap back to source 4.8.
});

test('WELCOME 停驻时地形继续变形，隐藏页面冻结背景，恢复后继续',async({page})=>{
 await ready(page);await page.evaluate(()=>window.__tangent.seek(544/30));await page.keyboard.press('Space');
 await expect(page.locator('#stage')).toHaveAttribute('data-state','welcome');await expect.poll(()=>backgroundTime(page)).toBeGreaterThan(545/30+.1);
 const first=await backgroundSample(page);await page.waitForTimeout(350);const moving=await backgroundSample(page);
 expect(moving.time).toBeGreaterThan(first.time+.2);expect(moving.hash).not.toBe(first.hash);
 expect(await page.evaluate(()=>window.__tangent.getTime())).toBeCloseTo(545/30,3);
 const result=await page.evaluate(async()=>{
  const original=Object.getOwnPropertyDescriptor(document,'hidden');let hidden=true;
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
  const at=()=>Number(document.querySelector<HTMLElement>('#background')!.dataset.motionTime);
  try{document.dispatchEvent(new Event('visibilitychange'));const before=at();await new Promise(r=>setTimeout(r,220));const frozen=Math.abs(at()-before)<.02;
   hidden=false;document.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setTimeout(r,250));return{frozen,resumed:at()>before+.12};
  }finally{if(original)Object.defineProperty(document,'hidden',original);else Reflect.deleteProperty(document,'hidden');document.dispatchEvent(new Event('visibilitychange'));}
 });expect(result).toEqual({frozen:true,resumed:true});
});
