import {expect,test} from '@playwright/test';
test.use({launchOptions:{args:['--enable-unsafe-swiftshader']}});
test('GPU 地形绘制真实像素；上下文丢失后自动转为 Canvas',async({page})=>{
 await page.addInitScript(()=>{const original=WebGLRenderingContext.prototype.getParameter;WebGLRenderingContext.prototype.getParameter=function(value){if(value===37446)return 'Hardware test renderer';return original.call(this,value);};});
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));await page.evaluate(()=>window.__tangent.seek(462/30));
 if(await page.locator('#background').getAttribute('data-renderer')!=='webgl')test.skip(true,'此运行环境不支持 WebGL 上下文');
 await expect(page.locator('#terrain')).toBeVisible();
 const energy=await page.locator('#terrain').evaluate(node=>{const canvas=node as HTMLCanvasElement,gl=canvas.getContext('webgl')!,data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);let active=0;for(let i=3;i<data.length;i+=4)if(data[i]>10)active++;return active;});expect(energy).toBeGreaterThan(1000);
 await page.locator('#terrain').evaluate(node=>node.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await page.evaluate(()=>window.__tangent.seek(463/30));await expect(page.locator('#terrain')).toBeHidden();await expect(page.locator('#background')).toHaveAttribute('data-renderer','canvas2d');
});
