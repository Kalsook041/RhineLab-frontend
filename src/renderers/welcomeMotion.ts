/** Low dimensional poses measured from f491–525. All glyphs remain live SVG text. */
type PoseKey = [number,number,number,number,number,number,number,number,number?];
const boxes=[[501,386,216,202],[689,386,122,202],[794,386,88,202],[897,382,129,210],[1026,383,132,209],[1146,386,186,202],[1312,386,126,202]];
// frame, left, top, width, height, opacity, horizontal/vertical blur, column roll
const tracks:PoseKey[][]=[
 [[491,650,440,157,147,.15,3,8,.25],[492,629,407,184,181,.24,2.5,7,.38],[493,613,389,188,201,.42,1.5,5,.28],[494,596,386,195,202,.6,1,4,.25],[495,581,386,199,202,.72,.7,3,.2],[497,567,385,205,203,.87,.5,2,.17],[499,546,386,211,202,1,.3,1.5,.1],[501,531,386,213,202,1,.2,1,.06],[503,525,386,214,202,1,.2,.7,.03],[505,515,386,215,202,1,.1,.4,.01],[507,509,386,215,202,1,0,0,0],[511,502,386,217,202,1,0,0,0],[520,501,386,216,202,1,0,0,0]],
 [[492,841,470,23,114,.12,5,9],[493,815,390,80,198,.35,2,7],[494,800,386,87,202,.55,1.5,5],[495,783,386,94,202,.75,1,4],[497,767,386,101,202,.9,.6,3],[499,743,386,111,202,1,.4,2],[501,725,386,117,202,1,.2,1],[505,706,386,122,202,1,0,0],[511,691,386,123,202,1,0,0],[520,689,386,122,202,1,0,0]],
 [[493,991,497,68,90,.28,2,3],[494,968,486,80,101,.5,1,1],[495,946,474,80,114,.75,.5,.5],[497,923,462,81,126,.9,.3,.3],[499,883,439,84,149,1,.2,.2],[501,855,421,84,167,1,0,0],[503,844,415,84,173,1,0,0],[505,826,402,86,186,1,0,0],[507,813,394,86,194,1,0,0],[511,801,386,87,202,1,0,0],[520,794,386,88,202,1,0,0]],
 [[494,1100,420,50,80,.08,5,15],[495,1079,406,80,107,.28,3,10],[497,1055,387,122,138,.55,1.5,7],[499,1007,384,130,163,.85,.8,4],[501,974,384,128,180,.95,.5,2],[503,958,383,132,187,1,.3,1],[505,939,383,129,198,1,.2,.5],[507,923,383,129,205,1,0,0],[511,908,382,129,210,1,0,0],[520,897,382,129,210,1,0,0]],
 [[495,1170,490,50,55,.06,8,17],[497,1114,437,109,154,.3,4,13],[498,1144,414,119,178,.5,3,10],[499,1126,392,125,200,.68,2,7],[500,1110,387,130,205,.82,1.5,5],[501,1096,384,132,208,.9,1,3],[504,1073,384,134,208,1,.5,1.5],[507,1051,383,133,209,1,.2,.5],[511,1037,383,132,209,1,0,0],[520,1026,383,132,209,1,0,0]],
 [[497,1233,448,65,80,.08,9,18,.15],[498,1260,414,137,178,.16,6,15,.12],[499,1250,392,154,200,.3,4,12,.1],[501,1219,384,167,208,.55,3,9,.08],[503,1200,386,179,202,.72,2,6,.06],[505,1180,386,185,202,.88,1.5,3,.03],[507,1168,386,187,202,.96,.7,1.5,.01],[511,1157,386,187,202,1,.3,.5,0],[520,1146,386,186,202,1,0,0,0]],
 [[499,1432,481,32,44,.09,6,9],[500,1405,449,68,86,.22,4,8],[501,1389,432,89,113,.36,3,7],[503,1377,416,103,138,.6,2,5],[505,1357,391,114,176,.8,1.5,3],[507,1341,389,118,187,.94,.7,1.5],[511,1326,386,125,200,1,.3,.5],[520,1313,386,126,202,1,0,0],[525,1312,386,126,202,1,0,0]],
];
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const value=(f:number,keys:number[][])=>{let v=keys[0][1];for(let i=0;i<keys.length-1;i++)if(f>=keys[i][0]){const t=clamp((f-keys[i][0])/(keys[i+1][0]-keys[i][0]));v=keys[i][1]+(keys[i+1][1]-keys[i][1])*t;}return v;};
const svgNS='http://www.w3.org/2000/svg';
export function createWelcomeMotion(){
 const root=document.querySelector<SVGSVGElement>('#interface')!,defs=root.querySelector('defs')!;
 const nodes=new Map<string,HTMLElement|SVGElement>();
 const node=(id:string)=>{let element=nodes.get(id);if(!element){element=document.querySelector<HTMLElement|SVGElement>(`#${id}`)!;nodes.set(id,element);}return element;};
 const set=(element:Element,key:string,n:number|string)=>{const text=String(n);if(element.getAttribute(key)!==text)element.setAttribute(key,text);};
 const show=(element:Element,alpha:number)=>{const s=(element as SVGElement).style,a=String(alpha),v=alpha>0?'visible':'hidden';if(s.opacity!==a)s.opacity=a;if(s.visibility!==v)s.visibility=v;};
 const make=(name:string,attrs:Record<string,string|number>={})=>{const e=document.createElementNS(svgNS,name);for(const[k,v]of Object.entries(attrs))set(e,k,v);return e;};
 const measure=document.createElement('canvas');measure.width=640;measure.height=500;
 const pen=measure.getContext('2d',{willReadFrequently:true});
 node('welcome-letter-position').removeAttribute('transform');node('welcome-letter-fit').removeAttribute('transform');
 (node('welcome-letter-fit') as SVGElement).style.filter='none';
 const letters=boxes.map((box,i)=>{
   const group=node(`welcome-letter-${i}`),text=group.querySelector('text')!;
   text.removeAttribute('x');text.setAttribute('y','0');text.setAttribute('font-family','TangentImpact');text.setAttribute('font-size','300');
   text.setAttribute('transform','skewX(-10.2)');
   const raw=make('g');raw.append(text);group.append(raw);let b=(raw as SVGGElement).getBBox();
   // SVG text getBBox includes line-box space for this font. Measure the actual
   // font ink, otherwise every unfolded letter is compressed vertically.
   if(pen){pen.setTransform(1,0,0,1,0,0);pen.clearRect(0,0,640,500);pen.font='300px TangentImpact';pen.setTransform(1,0,-Math.tan(10.2*Math.PI/180),1,100,350);pen.fillText(text.textContent!,0,0);
     const pixels=pen.getImageData(0,0,640,500).data;let l=640,t=500,r=0,d=0;
     for(let y=0;y<500;y++)for(let x=0;x<640;x++)if(pixels[(y*640+x)*4+3]>15){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);d=Math.max(d,y);}
     if(r>l)b={x:l-100,y:t-350,width:r-l+1,height:d-t+1} as DOMRect;
   }
   const master=make('g',{id:`welcome-glyph-${i}`,transform:`scale(${box[2]/b.width} ${box[3]/b.height}) translate(${-b.x} ${-b.y})`});
   // An explicit glyph-space gutter avoids fractional-viewport CSS shadow
   // textures leaking a vertical edge outside the last letter on D3D11.
   const fringe=make('filter',{id:`welcome-fringe-${i}`,filterUnits:'userSpaceOnUse',x:b.x-12,y:b.y-12,width:b.width+24,height:b.height+24});
   fringe.append(make('feDropShadow',{dx:-1.3*b.width/box[2],dy:0,stdDeviation:0,'flood-color':'#b76560'}),make('feDropShadow',{dx:1.3*b.width/box[2],dy:0,stdDeviation:0,'flood-color':'#77b3a9'}));defs.append(fringe);raw.setAttribute('filter',`url(#welcome-fringe-${i})`);
   master.append(raw);defs.append(master);
   const top=[83,103,119,135,155,181,201][i],bottom=[27,30,31,33,37,42,49][i];
   const gradient=make('linearGradient',{id:`welcome-letter-ink-${i}`,x1:0,y1:b.y,x2:0,y2:b.y+b.height,gradientUnits:'userSpaceOnUse'});
   gradient.append(make('stop',{offset:0,'stop-color':`rgb(${top} ${top+3} ${top})`}),make('stop',{offset:1,'stop-color':`rgb(${bottom} ${bottom+4} ${bottom})`}));defs.append(gradient);text.setAttribute('fill',`url(#welcome-letter-ink-${i})`);
   const filter=make('filter',{id:`welcome-soft-${i}`,x:'-50%',y:'-100%',width:'200%',height:'300%'}),blur=make('feGaussianBlur',{stdDeviation:0});filter.append(blur);defs.append(filter);
   const slices=Array.from({length:16},(_,j)=>{
     const clip=make('clipPath',{id:`welcome-slice-${i}-${j}`,clipPathUnits:'userSpaceOnUse'});clip.append(make('rect',{x:j*box[2]/16-.15,y:-5,width:box[2]/16+.3,height:box[3]+10}));defs.append(clip);
     const slice=make('g'),cut=make('g',{'clip-path':`url(#welcome-slice-${i}-${j})`});cut.append(make('use',{href:`#welcome-glyph-${i}`}));slice.append(cut);group.append(slice);return slice;
   });const full=make('use',{href:`#welcome-glyph-${i}`});group.append(full);
   const channels=Array.from({length:8},(_,j)=>tracks[i].map(k=>[k[0],k[j+1]??0]));
   return{group,blur,slices,full,box,channels,fragmented:undefined as boolean|undefined};
 });
 const bar=node('welcome-bottom'),barRects=bar.querySelectorAll('rect'),barEdges=bar.querySelectorAll('path');
 let previous:number|undefined;
 return {render(frame:number,motionFrame=frame){
   // Before entry and after settling, the letter slices have no changing pose.
   // Avoid updating 112 hidden slices on every high-refresh particle tick.
   if(previous!==undefined&&(frame<470&&previous<470||frame>=525&&previous>=525)){previous=frame;return;}
   previous=frame;
   // The source contains repeated frames from its lower-rate composition.
   const held=(at:number)=>at>=470&&at%6===4?at-1:at;
   const base=Math.floor(motionFrame),fraction=motionFrame-base;
   const f=held(base)+(held(base+1)-held(base))*fraction;
   let width=0,height=0,alpha=0;
   if(f>=470){width=value(f,[[470,304],[471,496],[473,1122],[474,1410],[475,1474],[477,1498],[480,1502],[486,1506]]);height=value(f,[[470,104],[475,104],[480,118],[483,149],[485,242],[486,300],[487,400],[488,454],[489,480],[491,492],[498,524],[510,530]]);alpha=held(frame)<473?.22:held(frame)===473?.7:1;}
   const card=node('welcome-card');Object.assign(card.style,{left:`${960-width/2}px`,top:`${540-height/2}px`,width:`${width}px`,height:`${height}px`});show(card,alpha);
   show(node('welcome-ui'),f>=487?1:0);
   const barW=value(f,[[487,10],[488,22],[489,48],[491,84],[492,144],[493,227],[494,365],[495,584],[497,794],[498,962],[499,1012],[501,1102],[503,1126],[505,1150]]),barX=960-barW/2;
   show(bar,f>=487?1:0);set(barRects[0],'x',barX);set(barRects[0],'width',barW);set(barRects[1],'x',barX+1);
   // User override: complete at the last letter's arrival, rather than stop at 50%.
   const progress=clamp(value(f,[[487,0],[495,.025],[499,.16],[503,.32],[507,.55],[511,.76],[520,.96],[525,1]]));
   set(barRects[1],'width',Math.max(0,barW-2)*progress);for(const[e,i]of [...barEdges].entries())set(i,'d',`M${barX} ${e===0?721:705}h${barW}`);
   const lineW=value(f,[[499,13],[501,60],[503,78],[505,168],[507,370],[509,435],[511,509],[515,553],[520,561]]),lineX=value(f,[[499,952],[501,928],[503,930],[505,914],[507,864],[509,859],[511,851],[515,845],[520,846]]);
   show(node('welcome-underline'),f>=499?1:0);set(node('welcome-underline'),'d',`M${lineX} 595h${lineW}`);node('welcome-underline').removeAttribute('stroke-dasharray');
   for(let i=0;i<letters.length;i++){
     const letter=letters[i];
     const {group,blur,slices,full,box}=letter;
     if(f<tracks[i][0][0]){show(group,0);continue;}
     const keys=tracks[i],pose=letter.channels.map(channel=>value(f,channel));
     const[x,y,w,h,opacity,bx,by,roll]=pose;show(group,f>=keys[0][0]?opacity:0);set(group,'transform',`translate(${x} ${y-box[3]+h}) scale(${w/box[2]} 1)`);
     set(blur,'stdDeviation',`${bx} ${by}`);if(bx||by)set(group,'filter',`url(#welcome-soft-${i})`);else group.removeAttribute('filter');
     const edgeReveal=value(f,[[492,.22],[493,.32],[494,.5],[495,.7],[497,.9],[499,1.2]]);
     const fragmented=roll>.0001||(i===1&&f<499);full.style.display=fragmented?'none':'';show(full,fragmented?0:1);set(full,'transform',`matrix(1 0 0 ${h/box[3]} 0 ${box[3]-h})`);
     if(fragmented)for(let j=0;j<slices.length;j++){const slice=slices[j],u=(j+.5)/16,sy=Math.max(.02,h/box[3]-roll*u**.8);set(slice,'transform',`matrix(1 0 0 ${sy} 0 ${box[3]*(1-sy)})`);slice.style.display='';show(slice,i===1?.2+.8*clamp((edgeReveal-u)*4+.5):1);}
     else if(letter.fragmented!==false)for(const slice of slices){slice.style.display='none';show(slice,0);}
     letter.fragmented=fragmented;
   }
 }};
}
