import {squareCycle,squareEntry} from './brandMotionData';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const curve=(frame:number,keys:readonly (readonly number[])[],channel=1)=>{
 let value=keys[0][channel];
 for(let i=0;i<keys.length-1;i++)if(frame>=keys[i][0]){
  const t=clamp((frame-keys[i][0])/(keys[i+1][0]-keys[i][0]));
  value=keys[i][channel]+(keys[i+1][channel]-keys[i][channel])*t;
 }return value;
};

/** Live SVG corner animation: source entry, then independently running squares. */
export function createBrandMotion(){
 const stage=document.getElementById('stage')!,brand=document.getElementById('brand')!;
 const get=(id:string)=>document.getElementById(id)!;
 const labels=['brand-title','brand-small','brand-os','brand-os-bold'].map(get);
 const squares=Array.from(get('brand-squares').querySelectorAll('rect'));
 const set=(node:Element,key:string,value:string|number)=>{const text=String(value);if(node.getAttribute(key)!==text)node.setAttribute(key,text);};
 const titleAlpha=[[121,0],[129,0],[132,.025],[135,.061],[138,.11],[141,.214],[144,.276],[147,.465],[150,.693],[153,.934],[156,1]];
 const smallAlpha=[[121,0],[141,0],[144,.035],[147,.095],[150,.3],[153,.49],[156,.59],[159,.77],[162,.91],[166,1]];
 const osAlpha=[[121,0],[140,0],[144,.08],[147,.25],[150,.45],[153,.74],[156,.886],[162,1]];
 const titleX=[[121,190],[129,190],[132,180],[135,112],[138,79],[141,49],[144,35],[147,22],[150,16],[153,9],[156,6],[162,3],[168,1],[180,0]];
 const smallX=[[121,180],[141,135],[144,90],[147,70],[150,34],[153,21],[156,15],[159,9],[162,6],[168,1],[180,0]];
 const osX=[[121,180],[141,135],[144,110],[147,78],[150,55],[153,37],[156,27],[159,17],[162,11],[168,3],[180,0]];
 const blurKeys=[[[121,4],[132,4],[138,2.3],[144,1.1],[150,.35],[156,0]],[[121,12],[141,12],[144,7],[147,2.5],[150,.5],[153,.15],[156,0]],[[121,12],[141,12],[144,3.5],[147,1.5],[150,.55],[153,.15],[156,0]]];
 const filters=['brand-title','brand-small','brand-os'];
 return{render(frame:number,motionTime=frame/30,reduced=false){
  const visible=frame>=121&&frame<305;
  brand.style.visibility=visible?'visible':'hidden';
  if(!visible)return;
  const fade=1-clamp((frame-300)/5),entry=reduced?180:Math.min(180,motionTime*30);
  const scale=Math.min(stage.clientWidth/1920,stage.clientHeight/1080);
  const marginX=(stage.clientWidth/scale-1920)/2,marginY=(stage.clientHeight/scale-1080)/2;
  const drift=-.25*Math.max(0,frame-180);
  set(brand,'transform',`translate(${drift-marginX} ${-marginY})`);
  brand.style.opacity=String(fade);
  const alphas=[curve(entry,titleAlpha),curve(entry,smallAlpha),curve(entry,osAlpha),curve(entry,osAlpha)];
  const xs=[127+curve(entry,titleX),127+curve(entry,smallX),125+curve(entry,osX),312+curve(entry,osX)];
  const ys=[122,161,181,181];
  for(const [i,label] of labels.entries()){
   label.style.visibility=alphas[i]>0?'visible':'hidden';label.style.opacity=String(alphas[i]);
   set(label,'transform',`translate(${xs[i]} ${ys[i]})`);
   const index=Math.min(i,2),blur=reduced?0:curve(entry,blurKeys[index]);
   label.style.filter=blur>.01?`url(#${filters[index]}-smear)`:'none';
   const svg=label.querySelector('svg')!;
   const width=i===0?(Number(label.dataset.width)+8)*clamp((entry-129)/8):Number(label.dataset.width)+8;
   set(svg,'width',width);set(svg,'overflow',i===0&&entry<137?'hidden':'visible');
  }
  for(let i=0;i<3;i++)set(get(`${filters[i]}-blur`),'stdDeviation',`${reduced?0:curve(entry,blurKeys[i])} ${i===0?.35:.2}`);
  const cycleFrame=reduced?0:motionTime*30-180,cycle=Math.floor(cycleFrame/30),phase=((cycleFrame%30)+30)%30;
  const commonX=curve(entry,squareEntry),commonY=curve(entry,squareEntry,2);
  for(const [i,square] of squares.entries()){
   const x=commonX+30*i,y=commonY+(reduced?0:curve(phase,squareCycle[i],2));
   const angle=reduced?0:90*cycle+curve(phase,squareCycle[i]);
   square.style.opacity=String(reduced?1:clamp((entry-120-i*4)/5));
   set(square,'x',-9);set(square,'y',-9);set(square,'width',18);set(square,'height',18);set(square,'stroke-width',1.6);
   set(square,'transform',`translate(${x} ${y}) rotate(${angle})`);
  }
 }};
}
