// Real-browser cadence probe. Does not change the application's clock or quality.
import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

const args=process.argv.slice(2),option=(key,fallback)=>args.find(a=>a.startsWith(`--${key}=`))?.split('=').slice(1).join('=')||fallback;
const url=option('url','http://127.0.0.1:4173/'),width=Number(option('width','1920')),height=Math.round(width*9/16);
const uncapped=args.includes('--uncapped'),output=resolve(option('output','.local/performance-report.json'));
const flags=['--enable-gpu','--use-angle=d3d11'];
if(uncapped)flags.push('--disable-frame-rate-limit','--disable-gpu-vsync');
const browser=await chromium.launch({headless:!args.includes('--headed'),channel:option('channel',undefined),args:flags});
try {
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const raf=requestAnimationFrame.bind(window),rows=[],costs=[];
  Object.assign(window,{__refreshProbe:{rows,costs}});
  window.requestAnimationFrame=callback=>raf(time=>{
   const start=performance.now();callback(time);
   if(callback.name==='_tick')costs.push({at:time,ms:performance.now()-start,source:window.__tangent?.getTime()});
  });
  function sample(at){const canvas=document.getElementById('background'),stage=document.getElementById('stage');
   if(window.__tangent)rows.push({at,source:window.__tangent.getTime(),state:window.__tangent.getState(),phase:stage.dataset.phase,motion:Number(canvas.dataset.motionTime)});
   raf(sample);
  }raf(sample);
 });
 await page.goto(url);await page.waitForFunction(()=>Boolean(window.__tangent));
 await page.waitForTimeout(1800);await page.locator('#start').click();
 await page.waitForFunction(()=>window.__tangent.getState()==='waiting');await page.waitForTimeout(1800);
 await page.locator('#power').click();await page.waitForFunction(()=>window.__tangent.getState()==='welcome');await page.waitForTimeout(1000);
 const {rows,costs}=await page.evaluate(()=>window.__refreshProbe);
 const quantile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)]:null;
 const summarize=(label,selected)=>{
  const intervals=selected.slice(1).map((r,i)=>r.at-selected[i].at),elapsed=selected.at(-1)?.at-selected[0]?.at;
  const changes=selected.slice(1).filter((r,i)=>r.motion!==selected[i].motion).length;
  const cpu=costs.filter(r=>r.at>=selected[0]?.at&&r.at<=selected.at(-1)?.at).map(r=>r.ms);
  return{label,samples:selected.length,rafHz:elapsed?(selected.length-1)*1000/elapsed:null,motionUpdatesHz:elapsed?changes*1000/elapsed:null,intervalP95ms:quantile(intervals,.95),scriptP95ms:quantile(cpu,.95)};
 };
 const runs=[summarize('ready-globe',rows.filter(r=>r.state==='ready')),summarize('waiting-helices',rows.filter(r=>r.state==='waiting'))];
 runs.push(summarize('power-entry',rows.filter(r=>r.phase==='identity'&&r.state==='intro')));
 for(const phase of ['access','identity','request','processing','authorized','reveal'])runs.push(summarize(phase,rows.filter(r=>r.phase===phase&&(phase==='identity'?r.state==='playing':r.state!=='ready'&&r.state!=='waiting'))));
 runs.push(summarize('WELCOME-active-f491-525',rows.filter(r=>r.source>=491/30&&r.source<525/30)));
 const report={mode:uncapped?'uncapped-stress-NOT-display-fps':'browser-rAF-cadence-NOT-presentation-proof',targetHz:120,budgetMs:1000/120,viewport:{width,height,dpr:1},browser:browser.version(),runs,errors,mediaElements:await page.locator('video,img,image').count(),rows,costs};
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));
 console.table(runs);console.log(`Saved ${output}\n${uncapped?'Uncapped stress does not measure display FPS.':'Use a 120Hz display and --headed to test real browser cadence. rAF cadence is not proof of physical presentation.'}`);
 if(errors.length)process.exitCode=1;
}finally{await browser.close();}
