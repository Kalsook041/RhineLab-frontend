/** Source-derived vector topology plus continuous procedural motion.
 * No frame textures or sampled particle trajectories are used at runtime. */
import {createRightHelix} from './rightHelix';
export type GlobePoint = [number,number,number,number,number];
const TAU=Math.PI*2;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
const ramp=(f:number,a:number,b:number)=>smooth((f-a)/(b-a));
const hash=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const keys=(f:number,points:number[][])=>{
  let value=points[0][1];for(let i=0;i<points.length-1;i++)if(f>=points[i][0]) {
    const t=clamp((f-points[i][0])/(points[i+1][0]-points[i][0]));value=points[i][1]+(points[i+1][1]-points[i][1])*t;
  }return value;
};
// Additional turn while departing, on top of the continuous idle rotation.
// f0–36 fits the source; later faint poses continue that turn without reversing.
const departureAngles=[0,-.0214,-.0501,-.1988,-.3891,-.9316,-1.3228,-1.55,-1.79,-2.02,-2.17];
function departureTurn(frame:number):number {
  const at=clamp(frame/60)*10,i=Math.min(9,Math.floor(at)),t=at-i;
  const slope=(j:number)=>{
    if(j===0)return departureAngles[1]-departureAngles[0];
    if(j===10)return departureAngles[10]-departureAngles[9];
    const a=departureAngles[j]-departureAngles[j-1],b=departureAngles[j+1]-departureAngles[j];
    return a*b<=0?0:2*a*b/(a+b);
  };
  return (2*t**3-3*t*t+1)*departureAngles[i]+(t**3-2*t*t+t)*slope(i)
    +(-2*t**3+3*t*t)*departureAngles[i+1]+(t**3-t*t)*slope(i+1);
}
type Point={x:number;y:number};
type Cubic=[Point,Point,Point,Point];
// Two different source f78 strands. Tracing along their length preserves the
// horizontal fold that a sine expressed as x(y) cannot represent.
const strandPaths:Cubic[][]=[
  [
    [{x:780,y:-80},{x:735,y:70},{x:742,y:135},{x:770,y:335}],
    [{x:770,y:335},{x:798,y:454},{x:419,y:417},{x:405,y:523}],
    [{x:405,y:523},{x:395,y:625},{x:541,y:801},{x:471,y:931}],
    [{x:471,y:931},{x:441,y:1016},{x:303,y:1072},{x:160,y:1130}],
  ],
  [
    [{x:1065,y:-80},{x:1170,y:51},{x:1105,y:55},{x:973,y:70}],
    [{x:973,y:70},{x:749,y:95},{x:610,y:259},{x:556,y:455}],
    [{x:556,y:455},{x:521,y:573},{x:572,y:721},{x:488,y:840}],
    [{x:488,y:840},{x:429,y:955},{x:201,y:953},{x:-160,y:900}],
  ],
];
function trace(path:Cubic[],count:number):Float32Array {
  const points:Point[]=[],distances:number[]=[];let length=0;
  for(const [a,b,c,d] of path)for(let i=0;i<=100;i++) {
    const t=i/100,s=1-t,p={x:s**3*a.x+3*s*s*t*b.x+3*s*t*t*c.x+t**3*d.x,y:s**3*a.y+3*s*s*t*b.y+3*s*t*t*c.y+t**3*d.y};
    if(points.length)length+=Math.hypot(p.x-points.at(-1)!.x,p.y-points.at(-1)!.y);
    points.push(p);distances.push(length);
  }
  const result=new Float32Array(count*2);let cursor=1;
  for(let i=0;i<count;i++) {
    const at=i/(count-1)*length;while(cursor<points.length-1&&distances[cursor]<at)cursor++;
    const a=points[cursor-1],b=points[cursor],t=(at-distances[cursor-1])/Math.max(.001,distances[cursor]-distances[cursor-1]);
    result[i*2]=a.x+(b.x-a.x)*t;result[i*2+1]=a.y+(b.y-a.y)*t;
  }return result;
}

export function createOpeningParticles(ctx:CanvasRenderingContext2D,geometry:GlobePoint[],map:number[][]) {
  // Use the complete PSD land mask, rather than mirroring the visible source
  // hemisphere. The latter showed the same continents again after half a turn.
  // The source is a translucent Form globe: the far-side continents remain
  // visible through the gaps. Fitting only its front invented a tilted pole.
  const yaw=-.221154*Math.PI/180,tilt=.169868*Math.PI/180,roll=.49786*Math.PI/180;
  const cloud:GlobePoint[]=map.length?map.map(([lon,lat],i):GlobePoint=>{
    const a=lon*Math.PI/180+yaw,b=lat*Math.PI/180;
    // Small fixed surface irregularity breaks the perfect latitude rings seen
    // in a regular UV grid, without screen-space noise that swims on rotation.
    const dx=Math.cos(b)*Math.sin(a)+(hash(i+22000)-.5)*.006;
    const dy=-Math.sin(b)+(hash(i+24000)-.5)*.006;
    const dz=Math.cos(b)*Math.cos(a)+(hash(i+26000)-.5)*.006;
    const length=Math.hypot(dx,dy,dz),x=dx/length,y=dy/length,z=dz/length;
    const ty=y*Math.cos(tilt)-z*Math.sin(tilt),tz=y*Math.sin(tilt)+z*Math.cos(tilt);
    const reference=geometry[Math.floor(hash(i+7700)*geometry.length)];
    return [x*Math.cos(roll)-ty*Math.sin(roll),x*Math.sin(roll)+ty*Math.cos(roll),tz,
      reference?.[3]??(.9+hash(i)*.5),reference?.[4]??(.25+hash(i+9)*.3)];
  }):geometry;
  const count=1350,initial=strandPaths.map(path=>trace(path,count));
  const rightHelix=createRightHelix(ctx);
  const seeds=Array.from({length:count},(_,i)=>({a:hash(i+50),b:hash(i+5100),c:hash(i+8500),size:.65+hash(i+130)*.55}));
  // Only a failed geographic fetch uses the traced-hemisphere fallback.
  const surface=map.length?cloud:[...cloud,...cloud.filter(p=>p[2]>.025).map(([x,y,z,size,strength]):GlobePoint=>[-x,y,-z,size,strength])];
  const projected=surface.map((point,id)=>({point,id,x:0,y:0,z:0,alpha:0,size:0}));
  function sphere(frame:number,time:number):void {
    // A fixed-size globe moves away from the camera. Projection and particle
    // footprint contract together; its surface never fractures into a cloud.
    const initialDistance=7.490889,distance=initialDistance+4.5*clamp(frame/60)**2;
    const sizeScale=initialDistance/distance;
    const spin=-time*.075+departureTurn(frame),c=Math.cos(spin),s=Math.sin(spin);
    const visibility=keys(frame,[[0,1],[18,1],[24,.95],[30,.66],[36,.48],[42,.25],[48,.25],[54,.11],[60,0]]);
    ctx.fillStyle='#343a33';
    for(const particle of projected) {
      const [px,py,pz,size,strength]=particle.point;
      const z=-px*s+pz*c;
      const x=(px*c+pz*s)*530,y=py*530;
      const depth=map.length ? .32+.68*clamp((z+1)/2) : (.55+.45*Math.max(0,z))/(.55+.45*Math.abs(pz));
      const horizon=map.length?1:clamp((z+.015)/.03)/Math.max(.5,clamp((Math.abs(pz)+.015)/.03));
      const perspective=map.length ? .97419*initialDistance/(distance-z) : sizeScale;
      particle.x=960+x*perspective;particle.y=530+y*perspective;particle.z=z;
      particle.alpha=strength*visibility*depth*horizon;
      particle.size=size*1.12*(.78+.22*Math.max(0,z))/(map.length?1:(.78+.22*Math.abs(pz)))*sizeScale;
    }
    projected.sort((a,b)=>a.z-b.z);
    for(const p of projected)if(p.alpha>.002){ctx.globalAlpha=p.alpha;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,TAU);ctx.fill();}
    ctx.globalAlpha=1;
  }
  function orbits(frame:number,time:number):void {
    const alpha=ramp(frame,72,78)*(1-ramp(frame,296,303));
    if(alpha<=0)return;
    // A source-relative difference stays zero throughout normal playback.
    // Advect from the first clear spiral frame using the continuous motion clock,
    // including the power hold, so clicking cannot restart the particle phase.
    const flowOffset=(time-78/30)*-.01;
    const base=keys(frame,[[72,850],[108,850],[138,758.5],[144,748.4],[162,735],[210,736.4],[240,745],[264,782],[300,820]]);
    const reformed=ramp(frame,108,138);
    const phase=1.2717-(time-4.8)*.46;
    const burst=ramp(frame,110,122)*(1-ramp(frame,126,138));
    const cloudDim=keys(frame,[[108,1],[120,.8],[126,.7],[138,1]]);
    const shift=keys(frame,[[72,0],[78,0],[90,-28],[108,-70],[120,-103],[138,-145]]);
    ctx.fillStyle='#343a33';
    for(let branch=0;branch<2;branch++) {
      const sign=branch?1:-1,positions=initial[branch];
      for(let i=0;i<count;i++) {
        const seed=seeds[i],flow=((i/count+flowOffset)%1+1)%1,u=flow*1540-230;
        const angle=u/617*TAU+phase,span=Math.sin(angle);
        const targetX=base-.712*u+sign*75.7*span;
        const targetY=u+sign*(60.8*span-9.5*Math.cos(angle));
        // Interpolate the traced curve instead of snapping to a sampled vertex.
        // The two open ends are off-screen, so wrapping never crosses the view.
        const vertex=flow*(count-1),index=Math.floor(vertex),fraction=vertex-index;
        const at=index*2,next=Math.min(count-1,index+1)*2;
        const initialX=positions[at]+(positions[next]-positions[at])*fraction;
        const initialY=positions[at+1]+(positions[next+1]-positions[at+1])*fraction;
        let x=initialX+shift+(targetX-initialX-shift)*reformed;
        let y=initialY+(targetY-initialY)*reformed;
        const local=burst*(.55+.45*Math.sin(u*.012+time*.7)**2);
        const normal=(seed.a+seed.b-1)*68*local;
        const tangent=(seed.c-.5)*80*local;
        x+=normal+tangent*.57+local*9*Math.sin(u*.021+time*2+seed.a*3)+(seed.a-.5)*3.5;
        y+=normal*.7-tangent*.82+local*7*Math.cos(u*.018-time*1.4)+(seed.b-.5)*1.8;
        ctx.globalAlpha=alpha*(.5+seed.a*.28)*(1-local*(.2+seed.c*.35))*(1-local*(1-cloudDim));
        const radius=seed.size+local*.5*(.7+seed.b*.5);
        ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();
      }
    }
    rightHelix.render(frame,time,alpha);
    ctx.globalAlpha=1;
  }
  return {sphere,orbits};
}
