import {expect,test} from '@playwright/test';
test.use({launchOptions:{args:['--enable-unsafe-swiftshader']}});

test('批量绘制保留全部粒子及前后顺序，上下文丢失后继续Canvas交互',async({page})=>{
 await page.addInitScript(()=>{
  const original=WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter=function(value){if(value===37446)return 'Hardware test renderer';return original.call(this,value);};
  const upload=WebGLRenderingContext.prototype.bufferSubData;
  WebGLRenderingContext.prototype.bufferSubData=function(target,offset,source){
   if(this.canvas instanceof HTMLCanvasElement&&this.canvas.id==='particle-batch'){
    Object.assign(window,{__particleCanvas:this.canvas,__particleUpload:Array.from(new Float32Array(source.buffer,source.byteOffset,source.byteLength/4))});
   }upload.call(this,target,offset,source);
  };
 });
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));await page.evaluate(()=>window.__tangent.seek(144/30));
 if(await page.locator('#background').getAttribute('data-particle-renderer')!=='webgl-instanced')test.skip(true,'环境不支持实例化WebGL');
 const info=await page.evaluate(()=>{
  const w=window as typeof window&{__particleUpload:number[]};const data=w.__particleUpload,types=[0,0,0,0];for(let i=4;i<data.length;i+=5)types[data[i]]++;
  const canvas=document.querySelector<HTMLCanvasElement>('#background')!,pixels=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let dark=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<180)dark++;
  return{count:data.length/5,types,dark,paired:data.slice(2700*5).every((_,i,rest)=>i%10!==4||rest[i]===1&&rest[i+5]===2)};
 });
 expect(info.count).toBe(6300);expect(info.types).toEqual([2700,1800,1800,0]);expect(info.paired).toBe(true);expect(info.dark).toBeGreaterThan(1000);
 await page.evaluate(()=>window.__tangent.seek(0));expect(Number(await page.locator('#background').getAttribute('data-particle-primitives'))).toBe(3331);
 await page.evaluate(()=>{const w=window as typeof window&{__particleCanvas:HTMLCanvasElement};w.__particleCanvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));});
 await page.evaluate(()=>window.__tangent.seek(144/30));await expect(page.locator('#background')).toHaveAttribute('data-particle-renderer','canvas2d');await expect(page.locator('#power')).toBeEnabled();
 await page.locator('#power').click();await expect.poll(()=>page.evaluate(()=>window.__tangent.getTime())).toBeGreaterThan(4.9);
});

test('没有实例化扩展时保留原始Canvas粒子',async({page})=>{
 await page.addInitScript(()=>{
  const extension=WebGLRenderingContext.prototype.getExtension;
  WebGLRenderingContext.prototype.getExtension=function(name:string){if(this.canvas instanceof HTMLCanvasElement&&this.canvas.id==='particle-batch'&&name==='ANGLE_instanced_arrays')return null;return extension.call(this,name);};
 });
 await page.goto('/');await page.waitForFunction(()=>Boolean(window.__tangent));await page.evaluate(()=>window.__tangent.seek(144/30));await expect(page.locator('#background')).toHaveAttribute('data-particle-renderer','canvas2d');await expect(page.locator('#power')).toBeEnabled();
});
