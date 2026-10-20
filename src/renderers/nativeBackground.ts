import { waveFit } from './waveFit';
import { createTerrainGL, type TerrainGL } from './terrainGL';
import { createOpeningParticles, type GlobePoint } from './openingParticles';
import {createParticleBatch,type ParticleBatch} from './particleBatch';
/** Source frames control form; the independent motion clock also runs during idle. No frame textures. */
export type NativeBackground = { render(frame: number, motionTime: number, motionFrame?: number): void; resize(scale: number): void; destroy(): void };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ramp = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export async function createNativeBackground(canvas: HTMLCanvasElement, fail: () => void): Promise<NativeBackground> {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { fail(); return { render() {}, resize() {}, destroy() {} }; }
  ctx.fillStyle='#e5e4dd';ctx.fillRect(0,0,1920,1080);
  let map: number[][] = [];
  try { map = await (await fetch('/assets/native/world-points.json')).json(); } catch { fail(); }
  let globeGeometry:GlobePoint[]=[];
  try { const response=await fetch('/assets/native/globe-points.json');if(response.ok)globeGeometry=await response.json(); } catch { /* The map supplies a procedural fallback. */ }
  let particles:ParticleBatch|undefined;
  try{particles=createParticleBatch();}catch{particles=undefined;}
  const opening=createOpeningParticles(ctx,globeGeometry,map,particles);
  let resolution = 1, destroyed = false;
  // Only tiny background digits are cached from live fonts. This canvas is
  // generated locally, never loaded from a screenshot or a media asset.
  const digits=document.createElement('canvas');let digitScale=0;
  const terrainCanvas=document.getElementById('terrain') as HTMLCanvasElement;
  let gpu:TerrainGL|undefined;
  const rows: Array<{ base: number; seed: number; depth: number; points: Float32Array; current: Float32Array; marks: Uint8Array; glyphs: Array<{ x: number; seed: number }> }> = [];
  for (let row = 0; row < 166; row++) {
    const base = -100 + 300 * (Math.exp(row * .012) - 1);
    const depth=clamp(base/1080),seed=hash(row+100),points=new Float32Array(323*7),marks=new Uint8Array(323);
    for(let i=0;i<323;i++) {
      const x=i*6-6,s=base*.001,j=i*7;
      points[j]=base-x*(.04+.22*depth)+.55*Math.sin(x*.7+seed*100);
      for(let w=0;w<3;w++) { const angle=x*[.004,.011,.034][w]+s*[2.1,4.3,9][w];points[j+1+w*2]=Math.sin(angle);points[j+2+w*2]=Math.cos(angle); }
      marks[i]=Number(hash(x+base)>.35);
    }
    rows.push({ base, seed, depth, points, current:new Float32Array(323),marks, glyphs: Array.from({ length: 7 + Math.floor(hash(row) * 6) }, (_, i) => ({ x: hash(row * 21 + i) * 1920, seed: hash(row * 41 + i) })) });
  }
  try { gpu=createTerrainGL(terrainCanvas,rows); } catch { gpu=undefined; }
  function buildDigits(scale:number):void {
    if(digitScale===scale)return;digitScale=scale;
    digits.width=16*32*scale;digits.height=Math.ceil(rows.length*10/16)*32*scale;
    const pen=digits.getContext('2d');if(!pen)return;pen.scale(scale,scale);pen.fillStyle='#dce4d7';
    for(let r=0;r<rows.length;r++){pen.font=`${4.5+rows[r].depth**1.6*15}px TangentThin, sans-serif`;for(let n=0;n<10;n++){const index=r*10+n;pen.fillText(String(n),(index%16)*32+4,Math.floor(index/16)*32+24);}}
  }
  function groundY(x: number, row: typeof rows[number], time: number): number {
    const d = row.depth, s = row.base * .001;
    return row.base - x * (.04 + .22 * d)
      + (13 + d * 14) * Math.sin(x * .004 + s * 2.1 + time * .27)
      + 7 * Math.sin(x * .011 + s * 4.3 - time * .19)
      + 2.3 * Math.sin(x * .034 + s * 9 + time * .43);
  }
  function terrain(time: number, opacity: number): void {
    ctx!.save(); ctx!.globalAlpha = opacity;
    const cos=[Math.cos(time*.27),Math.cos(-time*.19),Math.cos(time*.43)],sin=[Math.sin(time*.27),Math.sin(-time*.19),Math.sin(time*.43)];
    for (let rowIndex=0;rowIndex<rows.length;rowIndex++) {
      const row=rows[rowIndex];
      if(row.base-1920*(.04+.22*row.depth)>1140)continue;
      ctx!.strokeStyle = `rgba(221,227,217,${.28 + row.depth * .45})`;
      ctx!.lineWidth = .5 + row.depth * .34;
      ctx!.beginPath();
      const amp=13+row.depth*14;
      for (let i=0;i<323;i++) {
        const j=i*7,p=row.points,x=i*6-6;
        const y=p[j]+amp*(p[j+1]*cos[0]+p[j+2]*sin[0])+7*(p[j+3]*cos[1]+p[j+4]*sin[1])+2.3*(p[j+5]*cos[2]+p[j+6]*sin[2]);
        row.current[i]=y;
        if (i===0) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
      }
      ctx!.stroke();
      ctx!.fillStyle = `rgba(227,232,223,${.25 + row.depth * .48})`;
      // Both marks and contours share cached vertices; there is no per-frame
      // random allocation or duplicated trigonometry at every point.
      ctx!.beginPath();for (let i=1;i<321;i++) if(row.marks[i])ctx!.rect(i*6-6,row.current[i],.8+row.depth*.5,.8);ctx!.fill();
      for (const glyph of row.glyphs) {
        const x = (glyph.x + Math.sin(time * .18 + glyph.seed * 8) * 8 + 1920) % 1920;
        const y = groundY(x, row, time);
        if (y < -15 || y > 1100) continue;
        const cycle = Math.floor(time * (.6 + glyph.seed * .7) + glyph.seed * 40);
        ctx!.save(); ctx!.translate(x, y - 1); ctx!.rotate(-.05 - .15 * row.depth);
        ctx!.globalAlpha=opacity*(.21+row.depth*.46)*(.65+.35*Math.sin(time*2+glyph.seed*20)**2);
        const index=rowIndex*10+((cycle+Math.floor(glyph.seed*10))%10+10)%10;
        ctx!.drawImage(digits,(index%16)*32*digitScale,Math.floor(index/16)*32*digitScale,32*digitScale,32*digitScale,-4,-24,32,32);ctx!.restore();
      }
    }
    ctx!.restore();
  }
  function waves(time: number, opacity: number): void {
    ctx!.save(); ctx!.globalAlpha = opacity;
    // Fit the full-width motion envelope, including distinct phases for both lines.
    let from = waveFit[0], to = waveFit[1];
    for(let i=0;i<waveFit.length-1;i++) if(time>=waveFit[i][0]) { from=waveFit[i];to=waveFit[i+1]; }
    const blend=(time-from[0])/(to[0]-from[0]);
    const p=from.slice(1).map((value,i)=>value+(to[i+1]-value)*blend);
    for (let branch = 0; branch < 2; branch++) {
      ctx!.beginPath();
      for (let x = -20; x < 1940; x += 8) {
        const offset=branch*3;
        const y = p[offset] + p[offset+1] * Math.sin(x*p[6]+p[offset+2]);
        if (x === -20) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
      }
      ctx!.strokeStyle = 'rgba(225,232,222,.13)'; ctx!.lineWidth = 8; ctx!.shadowColor = '#dce7d5'; ctx!.shadowBlur = 25; ctx!.stroke();
      ctx!.strokeStyle = 'rgba(232,239,227,.57)'; ctx!.lineWidth = 2.1; ctx!.shadowBlur = 7; ctx!.stroke();
    }
    ctx!.restore();
  }
  return {
    resize(scale) { resolution = Math.max(.3, Math.min(3, scale * devicePixelRatio)); canvas.width = Math.round(1920 * resolution); canvas.height = Math.round(1080 * resolution); buildDigits(resolution>=1.5?2:1);gpu?.resize(canvas.width,canvas.height);gpu?.texture(digits); },
    render(frame, motionTime, motionFrame=frame) {
      if (destroyed) return;
      canvas.dataset.frame = String(frame); canvas.dataset.motionTime = motionTime.toFixed(4);
      ctx.setTransform(resolution, 0, 0, resolution, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      const dark = frame >= 311 || frame === 303 || frame === 304;
      ctx.fillStyle = dark ? '#222421' : '#e5e4dd'; ctx.fillRect(0, 0, 1920, 1080);
      if(frame<303)particles?.begin(canvas.width,canvas.height);
      if (frame < 61) opening.sphere(motionFrame,motionTime);
      if (frame >= 72 && frame <= 302) opening.orbits(motionFrame,motionTime);
      if(frame<303){if(particles)particles.flush(ctx);else canvas.dataset.particleRenderer='canvas2d';}
      if(frame===308) { ctx.fillStyle='#222421';ctx.shadowColor='#222421';ctx.shadowBlur=20;ctx.fillRect(0,120,1920,840);ctx.shadowBlur=0; }
      if (frame >= 308 && frame <= 377) waves(motionTime, (.3+.7*ramp(motionFrame, 308, 311)) * (1 - ramp(motionFrame, 375, 378)));
      terrainCanvas.hidden=true;
      if (frame >= 378) {
        if(gpu?.render(motionTime-12.6,ramp(motionFrame,377,381)))terrainCanvas.hidden=false;
        else terrain(motionTime-12.6,ramp(motionFrame,377,381));
      }
      canvas.dataset.renderer=terrainCanvas.hidden?'canvas2d':'webgl';
      if (frame < 303) {
        const vignette = ctx.createRadialGradient(960, 530, 470, 960, 530, 1180); vignette.addColorStop(0, 'rgba(255,255,255,0)'); vignette.addColorStop(1, 'rgba(255,255,247,.2)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, 1920, 1080);
      }
    },
    destroy() { destroyed = true; canvas.width = 0; canvas.height = 0;digits.width=0;digits.height=0;gpu?.destroy();particles?.destroy(); },
  };
}
