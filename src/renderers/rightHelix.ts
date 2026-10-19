/** Native 3D double helix, projected into the reference's pale right column. */
const TAU=Math.PI*2,PITCH=674,COUNT=900,STRIDE=6;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const correction=(frame:number)=>{
  const keys=[[144,0],[150,0],[180,-.082],[210,.014],[234,.066]];
  let value=0;for(let i=0;i<keys.length-1;i++)if(frame>=keys[i][0]) {
    const t=clamp((frame-keys[i][0])/(keys[i+1][0]-keys[i][0]));value=keys[i][1]+(keys[i+1][1]-keys[i][1])*t;
  }return value;
};

export function createRightHelix(ctx:CanvasRenderingContext2D) {
  // Stable particle slots are independent of the back-to-front paint order.
  const particles=new Float32Array(COUNT*2*STRIDE);
  const order=Uint16Array.from({length:COUNT*2},(_,i)=>i);
  const seeds=Array.from({length:COUNT*2},(_,i)=>({a:hash(i+9300),b:hash(i+11100),size:hash(i+13400),grain:hash(i+15400)}));
  // Procedural optical footprint: no source frame or raster UI is loaded.
  const grain=document.createElement('canvas');grain.width=grain.height=48;
  const g=grain.getContext('2d')!,soft=g.createRadialGradient(24,24,0,24,24,24);
  soft.addColorStop(0,'#535a4f');soft.addColorStop(.28,'rgba(83,90,79,.6)');
  soft.addColorStop(.6,'rgba(83,90,79,.12)');soft.addColorStop(1,'rgba(83,90,79,0)');
  g.fillStyle=soft;g.fillRect(0,0,48,48);
  function render(frame:number,time:number,opacity:number):void {
    const phase=-80/PITCH*TAU-(time-4.8)*.46+correction(frame);
    const flowOffset=(time-2.6)*-.01;
    for(let id=0;id<COUNT*2;id++) {
      const branch=Math.floor(id/COUNT),i=id%COUNT,seed=seeds[id];
      const flow=((i/COUNT+flowOffset)%1+1)%1,u=flow*1400-160;
      const angle=u/PITCH*TAU+phase+branch*Math.PI;
      const radius=120+(seed.a-.5)*6;
      const z=radius*Math.cos(angle)+(seed.b-.5)*2.4;
      const perspective=5200/(5200-z),depth=clamp((z/120+1)/2);
      // Narrow, irregular grain clusters travel with the same particle slots.
      // The reference is a soft particle ribbon, with gaps rather than a stroke.
      const cluster=.66+.34*Math.sin(i*.131+branch*2.1)*Math.sin(i*.047+.9);
      const j=id*STRIDE;
      particles[j]=1549+(radius*Math.sin(angle)+(seed.b-.5)*4.2)*perspective;
      particles[j+1]=540+(u-540+z*.08+(seed.grain-.5)*3.8)*perspective;
      particles[j+2]=z;
      particles[j+3]=(.8+depth*.7+seed.size*.45)*perspective;
      particles[j+4]=opacity*(.02+depth*.073)*cluster*(.55+seed.grain*.55);
      particles[j+5]=u;
    }
    order.sort((a,b)=>particles[a*STRIDE+2]-particles[b*STRIDE+2]);
    ctx.fillStyle='#535a4f';
    for(const id of order) {
      const j=id*STRIDE,r=particles[j+3];ctx.globalAlpha=particles[j+4];
      ctx.drawImage(grain,particles[j]-r*3.1,particles[j+1]-r*3.1,r*6.2,r*6.2);
      ctx.globalAlpha=particles[j+4]*.1;
      ctx.beginPath();ctx.arc(particles[j],particles[j+1],r*.55,0,TAU);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  // A read-only snapshot of a stable ID is useful for checking depth exchange;
  // comparing Canvas call indexes would confuse paint order with identity.
  function getParticle(id:number) {
    const j=id*STRIDE;
    return {x:particles[j],y:particles[j+1],z:particles[j+2],radius:particles[j+3],opacity:particles[j+4],u:particles[j+5]};
  }
  return {render,getParticle};
}
