/** Native SVG text and strokes. Timing uses the measured 30fps reference frames. */
import { createWelcomeMotion } from './welcomeMotion';
import { createBrandMotion } from './brandMotion';
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ramp = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
const out = (n: number) => 1 - (1 - n) ** 3;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const curve = (f: number, keys: number[][]) => { let result=keys[0][1]; for(let i=0;i<keys.length-1;i++) if(f>=keys[i][0])result=mix(keys[i][1],keys[i+1][1],ramp(f,keys[i][0],keys[i+1][0])); return result; };
const percentFrames = [311,315,318,321,324,327,330,333,336,339,342,345,348,351,354,357,360,363,366,369];
const percents = [0,7,15,29,38,50,56,65,70,77,80,85,88,91,93,95,97,98,99,100];
// Measured independent ring trim and check intensity at source f198–232.
// [start degrees, sweep degrees, check alpha]; this is SVG geometry, not frame media.
const confirmationFrames = [
  [92,10,0],[93,14,0],[96,20,0],[101,30,0],[101,30,0],[107,49,0],
  [116,84,0],[129,164,0],[147,259,0],[174,300,0],[174,300,0],[208,319,0],
  [234,330,1],[249,336,.66],[259,338,.33],[268,335,0],[268,335,0],
  [281,325,.5],[303,305,1],[358,250,0],[181,67,.5],[217,31,1],[217,31,1],
  [231,17,1],[237,11,1],[0,360,1],[0,0,.5],[0,360,0],[0,360,0],
  [0,360,1],[0,360,1],[0,360,1],[0,360,1],[0,360,0],[0,360,0],
];
const arcPath = (radius:number,start:number,sweep:number) => {
  const a=start*Math.PI/180,b=(start+sweep)*Math.PI/180;
  return `M${radius*Math.cos(a)} ${radius*Math.sin(a)} A${radius} ${radius} 0 ${sweep>180?1:0} 1 ${radius*Math.cos(b)} ${radius*Math.sin(b)}`;
};
const powerGrowth=[[72,1],[73,3],[74,6.5],[75,11],[76,11],[77,17],[78,27],[79,35],[80,49],[81,67],[82,67],[83,91],[84,125],[85,159],[86,186.5],[87,206.5],[88,206.5],[89,222.5],[90,233.5],[91,242.5],[92,249.5],[93,255.5],[94,255.5],[95,260.5],[96,264],[97,266.5],[98,267.2],[99,268.5],[100,268.5],[101,269.5],[102,270]];

export function createNativeInterface(): { resize(width:number,height:number):void;render(frame: number,cornerTime?:number,reduced?:boolean,motionFrame?:number): void;renderBrand(frame:number,cornerTime:number,reduced?:boolean):void } {
  const nodes = new Map<string, SVGElement | HTMLElement>();
  for (const node of document.querySelectorAll<SVGElement | HTMLElement>('[id]')) nodes.set(node.id, node);
  const node = (id: string) => nodes.get(id)!;
  const attr = (id: string, name: string, value: number | string) => { const target=node(id),text=String(value);if(target.getAttribute(name)!==text)target.setAttribute(name,text); };
  const show = (id: string, opacity: number | boolean) => { const a=Number(opacity),style=node(id).style,text=String(a),visibility=a>0?'visible':'hidden';if(style.opacity!==text)style.opacity=text;if(style.visibility!==visibility)style.visibility=visibility; };
  const box = (id: string, x: number, y: number, width: number, height: number) => { for (const [key,value] of Object.entries({ x, y, width, height })) attr(id,key,value); };
  const card = (id: string, width: number, height: number, opacity = 1) => { const style = node(id).style; style.width = `${width}px`; style.height = `${height}px`; style.left = `${960-width/2}px`; style.top = `${540-height/2}px`; show(id, opacity); };
  const measurement = document.createElement('canvas').getContext('2d');
  for (const group of document.querySelectorAll<SVGGElement>('[data-label]')) {
    const text = group.querySelector('text')!;
    if (text.getAttribute('font-family') === 'TangentSerif') text.setAttribute('letter-spacing', '35');
    if (group.id === 'welcome-year') text.setAttribute('letter-spacing', '26');
    let bounds = text.getBBox();
    if (measurement) {
      measurement.font = `100px ${text.getAttribute('font-family')}`;
      measurement.letterSpacing = `${text.getAttribute('letter-spacing') ?? 0}px`;
      const metric = measurement.measureText(text.textContent!);
      bounds = { ...bounds, x:-metric.actualBoundingBoxLeft, y:-metric.actualBoundingBoxAscent, width:metric.actualBoundingBoxLeft+metric.actualBoundingBoxRight, height:metric.actualBoundingBoxAscent+metric.actualBoundingBoxDescent } as DOMRect;
    }
    const w = Number(group.dataset.width), h = Number(group.dataset.height);
    const sx = w / bounds.width, sy = h / bounds.height;
    const slant = group.id === 'request-en'||group.id === 'welcome-year'||text.getAttribute('font-family')==='TangentAccess'||group.id.startsWith('brand-')||group.id.startsWith('credit-') ? 0 : text.getAttribute('font-family') === 'TangentSerif' ? -.2 : -.045;
    group.querySelector('.ink')!.setAttribute('transform', `matrix(${sx} 0 ${slant*sy} ${sy} ${-bounds.x*sx+2} ${-bounds.y*sy})`);
  }
  // The authorization title has its own measured tracking and cap height.
  // Keep the shared label fitting used by the other scenes untouched.
  const authTitle=node('auth-en').querySelector('text')!;
  authTitle.setAttribute('letter-spacing','10');
  let authBounds=authTitle.getBBox();
  if(measurement) {
    measurement.font='100px TangentSans';measurement.letterSpacing='10px';
    const metric=measurement.measureText(authTitle.textContent!);
    authBounds={...authBounds,x:-metric.actualBoundingBoxLeft,y:-metric.actualBoundingBoxAscent,width:metric.actualBoundingBoxLeft+metric.actualBoundingBoxRight,height:metric.actualBoundingBoxAscent+metric.actualBoundingBoxDescent} as DOMRect;
  }
  const authSX=366/authBounds.width,authSY=19/authBounds.height;
  node('auth-en').querySelector('.ink')!.setAttribute('transform',`matrix(${authSX} 0 ${-.045*authSY} ${authSY} ${-authBounds.x*authSX+2} ${-authBounds.y*authSY})`);
  const authMessage=authTitle.textContent!;
  const welcome=createWelcomeMotion();
  const brand=createBrandMotion();
  let marginX=0,marginY=0;
  const resize=(width:number,height:number)=>{const scale=Math.min(width/1920,height/1080);marginX=(width/scale-1920)/2;marginY=(height/scale-1080)/2;brand.resize(width,height);};
  resize(node('stage').clientWidth,node('stage').clientHeight);
  // Each source character arrives from above; keep the full-string fitting
  // measured above, so typing cannot change the completed line's proportions.
  const requestCN=node('request-cn').querySelector('text')!;
  const requestCNSY=(node('request-cn').querySelector('.ink') as SVGGElement).transform.baseVal.getItem(0).matrix.d;
  const requestLetters=[...requestCN.textContent!].map(char=>{const span=document.createElementNS('http://www.w3.org/2000/svg','tspan');span.textContent=char;requestCN.append(span);return span;});
  requestCN.replaceChildren(...requestLetters);
  const requestLetterStarts=[261,263,264,265,267,269,270,271,275,277,281];
  node('interface').style.visibility = 'visible';
  function reveal(id: string, f: number, from: number, to: number, end = Infinity): void {
    const group = node(id) as SVGGElement, progress = Math.ceil(ramp(f, from-1, to) * 20) / 20;
    show(id, f >= from && f < end);
    const svg = group.querySelector('svg');
    if (svg) { const width=String((Number(group.dataset.width)+8)*progress),overflow=progress<1?'hidden':'visible';if(svg.getAttribute('width')!==width)svg.setAttribute('width',width);if(svg.getAttribute('overflow')!==overflow)svg.setAttribute('overflow',overflow); }
  }
  let previousFrame=-1;
  const spinnerTicks=[...node('spinner').querySelectorAll('path')];
  return {resize,renderBrand:brand.render, render(f,cornerTime=f/30,reduced=false,motionFrame=f) {
    brand.render(motionFrame,cornerTime,reduced);
    node('interface').dataset.frame = String(f);
    node('interface').dataset.motionFrame = String(motionFrame);
    if(f>=535&&previousFrame>=535){previousFrame=f;return;}previousFrame=f;
    show('access-group', f <= 72 ? 1-ramp(motionFrame,67,73) : 0);
    reveal('access-en',f,3,21); reveal('access-cn',f,30,39);
    attr('access-en','transform',`translate(794 ${507+curve(motionFrame,[[0,26],[30,26],[33,23],[36,15],[39,9],[42,5],[45,2],[48,0]])})`);
    attr('access-cn','transform',`translate(852 ${537+curve(motionFrame,[[0,18],[30,18],[33,17],[36,13],[39,8],[42,4],[45,1],[48,0]])})`);
    attr('access-line','d',`M794 ${curve(motionFrame,[[0,548],[30,548],[33,546],[36,542],[39,537],[42,534],[45,532],[48,532]])}h334`);
    attr('access-line','stroke-dasharray',`${334*ramp(motionFrame,24,39)} 334`);
    const brandFade = f < 300 ? 1 : 1-ramp(motionFrame,300,305);
    show('credit',brandFade);
    attr('credit','transform',`translate(${marginX} ${marginY})`);
    reveal('credit-year-fill',f,135,140);reveal('credit-year-outline',f,135,140);reveal('credit-line',f,127,137);reveal('credit-name',f,127,137);
    show('credit',f>=121 ? brandFade : 0);
    const powerX = curve(motionFrame,[[0,960],[108,960],[114,956],[120,935.5],[126,870],[132,824.5],[138,812],[144,812]]);
    attr('power-shape','transform',`translate(${powerX} 540)`);
    show('power-shape',f>=72 && f<194);
    const arc = curve(motionFrame,powerGrowth)/270;
    if(f<185) { attr('power-arc','d',arcPath(60,315,270));attr('power-arc','stroke-dasharray',`${arc} 1`); }
    else {
      const starts=[[185,335],[186,65+360],[187,175+360],[188,244+360],[189,296+360],[190,296+360],[191,343+360],[193,390+360]];
      const sweep=curve(motionFrame,[[185,260],[186,206],[187,120],[188,77],[189,52],[190,52],[191,29],[193,4]]);
      attr('power-arc','d',arcPath(60,curve(motionFrame,starts),sweep));attr('power-arc','stroke-dasharray','1 1');
    }
    attr('power-arc','stroke-width',20);
    attr('power-arc','stroke-dashoffset',0);show('power-arc',curve(motionFrame,[[72,.6],[73,1]])*(1-ramp(motionFrame,184,194)));
    const stemTop=curve(motionFrame,[[103,477],[104,477],[105,476],[106,476],[107,477],[108,480],[109,480],[110,481],[112,481],[113,478],[114,478],[116,477],[118,476]]);
    const stemBottom=curve(motionFrame,[[103,477],[104,486],[105,492],[106,492],[107,500],[108,506],[109,510],[110,512],[112,512],[114,509],[118,509]]);
    attr('power-stem','d',`M0 ${stemTop-540}V${stemBottom-540}`);attr('power-stem','stroke-width',20);
    show('power-stem',curve(motionFrame,[[102,0],[103,.1],[104,.65],[105,1]])*(1-ramp(motionFrame,184,188)));
    const dividerX=f<233?powerX+82:curve(motionFrame,[[233,894],[234,905],[235,885],[236,826],[237,827]]);
    const dividerTop=curve(motionFrame,[[103,542],[104,536],[105,517],[106,517],[107,496],[108,477],[109,470],[110,469]]);
    const dividerBottom=curve(motionFrame,[[103,542],[104,548],[105,567],[106,567],[107,589],[108,606],[109,614],[110,616]]);
    attr('identity-divider','d',`M${dividerX} ${dividerTop}V${dividerBottom}`);
    show('identity-divider',ramp(motionFrame,103,105)*(1-ramp(motionFrame,299,300)));
    show('file-icon',curve(motionFrame,[[103,0],[104,.35],[105,.6],[106,.6],[107,.85],[108,1]])*(1-ramp(motionFrame,299,300)));
    const iconMove=curve(motionFrame,[[0,0],[233,0],[234,.12],[235,.23],[236,.7],[237,1]]);
    const iconY=curve(motionFrame,[[0,545],[238,545],[239,465]]);
    const fileWidth=curve(motionFrame,[[103,1],[104,7],[105,25],[106,25],[107,34],[108,42],[109,49],[110,57],[111,55],[112,55],[113,53]]);
    // The source's left edge stays beside the divider as the right edge opens.
    attr('file-icon','width',fileWidth);attr('file-icon','x',mix(powerX+curve(motionFrame,[[103,87],[109,87],[110,89]]),841,iconMove)); attr('file-icon','y',iconY);
    const databaseIn=f===199?.4:f===200||f===203||f>=205?1:0;
    show('database-icon',databaseIn*(1-ramp(motionFrame,299,300)));
    const databaseX=curve(motionFrame,[[0,1108],[227,1108],[228,1026],[229,1012],[230,1003],[231,997],[232,991],[233,985]]);
    attr('database-icon','x',mix(databaseX,915,iconMove)); attr('database-icon','y',iconY);
    for(const id of ['file-icon','database-icon'])node(id).style.filter=f>=233&&f<=238?`blur(${f>=237?3:1.2}px)`:id==='file-icon'&&f>=103&&f<110?`url(#icon-shadow) blur(${curve(motionFrame,[[103,5],[104,4],[105,.8],[106,.8],[107,.6],[108,.4],[109,.3],[110,0]])}px)`:'';
    const identityOut=curve(motionFrame,[[0,1],[232,1],[233,.9],[234,.75],[235,1],[236,.9],[237,.25],[238,.25],[239,0]]);
    show('id-status',identityOut);
    node('id-status').style.filter = f>=233&&f<239 ? 'url(#identity-trail)' : '';
    attr('identity-trail-blur','stdDeviation',`${curve(motionFrame,[[232,0],[233,4],[234,9],[235,1.5],[236,2],[237,8]])} .4`);
    attr('id-status','transform',`translate(${curve(motionFrame,[[232,0],[233,6],[234,30],[235,10],[236,-55],[237,3]])} 0)`);
    reveal('id-en',f,145,160); reveal('id-cn',f,166,176);
    show('id-line',ramp(motionFrame,155,165)); show('dashed-link',ramp(motionFrame,177,194)*(1-ramp(motionFrame,232,237)));
    attr('dashed-link','stroke-dasharray',f>=181&&f<=188||f>=199&&f<=208||f>=223&&f<=230?'4 14':'12 23');
    attr('dashed-link','stroke-dashoffset',-(motionFrame-177)*1.4);
    attr('dashed-link','d',`M964 580H${mix(970,1100,ramp(motionFrame,177,194))}`);
    show('spinner',f>=175 && f<=236);
    if(f>=175&&f<=236) {
      const phase=4.4+(motionFrame-180)*.75,head=-152.4+(motionFrame-176)*12.11;
      attr('spinner','transform',`translate(1140 507) rotate(${phase})`);
      for(const [i,tick] of spinnerTicks.entries()) {
        const angle=-90+i*22.5+phase;
        const tail=((angle-head+540)%360)/360;
        tick.style.opacity=String(.04+.96*tail);
      }
    }
    const confirmation=confirmationFrames[Math.max(0,Math.min(34,f-198))];
    show('confirmation', f>=198 && f<239);
    const circleX=curve(motionFrame,[[232,812],[233,816],[234,835],[235,944],[236,958],[237,958]]);
    const circleScale=curve(motionFrame,[[236,1],[237,1.14],[238,1.14]]);
    attr('confirmation','transform',`translate(${circleX-812} 0) translate(812 540) scale(${circleScale}) translate(-812 -540)`);
    node('confirmation').style.filter=f>=233?'url(#circle-trail)':'';
    attr('circle-trail-blur','stdDeviation',`${curve(motionFrame,[[232,0],[233,.4],[234,3.2],[235,1.4],[236,.8],[237,3.2]])} ${f>=237?2:0}`);
    const measured=f>=233?360:confirmation[1];
    const sweep=measured>0&&measured<360?Math.max(.1,measured-8):measured,start=f>=233||measured===360?0:confirmation[0]+4;
    show('check-ring',sweep>0 ? (f===225||f===226?.5:1):0);
    attr('check-ring','transform',`rotate(${start} 812 540)`);
    attr('check-ring','stroke-dasharray',`${sweep/360} 1`);
    attr('check-mark','stroke-dasharray','1 1');show('check-mark',f<233?confirmation[2]:0);
    // Translation precedes the two-frame radius jump; only then do the corners fold.
    const size=curve(motionFrame,[[238,146],[239,414],[240,426],[241,436],[242,436],[243,436],[256,436],[257,420],[260,416],[266,412],[274,408],[280,406],[290,408]]),cx=960;
    box('request-frame',cx-size/2,540-size/2,size,size);
    attr('request-frame','rx',curve(motionFrame,[[238,73],[239,207],[240,142],[241,38],[242,12],[243,0]]));
    const echo=curve(motionFrame,[[256,0],[257,.07],[259,.28],[260,.44],[262,.65],[264,.84],[266,1],[270,1],[272,.74],[274,.65],[276,.5],[278,.36],[280,.3],[282,.26],[284,.2],[286,.15],[288,.11],[290,.07],[292,.04],[294,.02],[298,0]]);
    let border=f<239?0:f<257?curve(motionFrame,[[239,.75],[240,.82],[243,.83],[248,.86],[251,.95],[255,.97]]):echo*.56;
    if(f>=252&&f<=254)border=0;
    show('request-frame',border); attr('request-frame','stroke-width',f<257?curve(motionFrame,[[239,30],[240,27],[241,23],[242,17],[243,14],[244,14],[245,9],[246,6],[247,5],[248,3],[256,3]]):2.8);
    node('request-frame').style.filter=f===239?'blur(5px)':f>=257?'blur(1px)':'';
    if(f===239)show('request-frame',.75);
    const near=curve(motionFrame,[[257,460],[260,460],[266,466],[270,468],[276,470],[294,472]]);
    const middle=curve(motionFrame,[[257,526],[260,538],[266,568],[270,582],[276,596],[284,608],[294,616]]);
    const outer=curve(motionFrame,[[257,574],[260,594],[266,626],[270,642],[276,654],[284,668],[294,670]]);
    const outerTrail=curve(motionFrame,[[257,590],[260,610],[266,646],[270,660],[276,678],[284,690],[294,700]]);
    const echoSizes=[near,middle,outer,outerTrail,near+18],echoStrength=[.72,.7,.6,.36,.2],echoWidths=[3.4,4.2,4.8,5.2,4.2];
    for(let i=1;i<=5;i++) {
      const s=echoSizes[i-1];box(`request-ghost-${i}`,960-s/2,540-s/2,s,s);attr(`request-ghost-${i}`,'stroke-width',echoWidths[i-1]);
      node(`request-ghost-${i}`).style.filter='blur(1px)';
      const delayed=i===1?1:ramp(motionFrame,i===2?258:257,i===2?266:265);
      show(`request-ghost-${i}`,echo*echoStrength[i-1]*delayed);
    }
    show('request-status',f<297?1:f<299?1-ramp(motionFrame,297,299):0);
    // Source ink boundaries: the final letters are still entering at f255.
    const requestInkWidth=curve(motionFrame,[[238,0],[239,32],[240,58],[241,77],[243,105],[247,153],[249,180],[251,199],[253,220],[255,238],[257,242]]);
    const requestENSvg=node('request-en').querySelector('svg')!;
    requestENSvg.setAttribute('width',String(requestInkWidth+2));requestENSvg.setAttribute('overflow',f<257?'hidden':'visible');
    show('request-en',f>=239&&f<300);
    attr('request-en','transform',`translate(${840+curve(motionFrame,[[239,-3],[241,-7],[243,-7],[247,-3],[249,-1],[251,0]])} 552)`);
    const requestCNSvg=node('request-cn').querySelector('svg')!;requestCNSvg.setAttribute('width','242');requestCNSvg.setAttribute('overflow','visible');show('request-cn',f>=261&&f<299);
    for(const [i,letter] of requestLetters.entries()) {
      const start=requestLetterStarts[i],land=ramp(motionFrame,start,start+2);
      letter.setAttribute('y',String(-16*(1-land)**2/requestCNSY));letter.style.opacity=String(f<start?0:mix(.2,1,land));
    }
    const lineWidth=curve(motionFrame,[[251,0],[252,2],[255,9],[257,14],[260,38],[263,80],[266,150],[269,219],[272,236],[275,242]]);
    attr('request-line','d',`M842 579h${lineWidth}`);show('request-line',f>=252&&f<299);
    show('request-wipe',f>=296&&f<=298); box('request-wipe',841,553,curve(motionFrame,[[296,12],[297,35],[298,180]]),28);
    show('transition-band',f>=300&&f<=307 || f===309 || f===310);
    const dark='#222421', light='#e5e4dd';
    node('outer-band').style.filter=f<=302?'url(#horizontal-trail)':f>=305?'blur(9px)':'';
    if(f<=302) { const w=mix(920,1920,ramp(motionFrame,300,302));box('outer-band',960-w/2,401,w,278); attr('outer-band','fill',dark); show('inner-band',false); }
    else if(f<=304) { box('outer-band',0,0,1920,1080); attr('outer-band','fill','#161a1d'); box('inner-band',0,401,1920,278); attr('inner-band','fill','#d9dad7'); show('inner-band',true); }
    else if(f<=307) { const h=f===305?320:f===306?440:660;box('outer-band',0,540-h/2,1920,h); attr('outer-band','fill',dark); box('inner-band',0,480,1920,120); attr('inner-band','fill',light); show('inner-band',f===307); }
    else { box('outer-band',0,0,1920,1080); attr('outer-band','fill',light); show('inner-band',false); }
    show('processing',f>=300&&f<379); show('percent-label',f>=311&&f<=378);
    let percent=0; for(let i=0;i<percentFrames.length;i++)if(f>=percentFrames[i])percent=percents[i];
    if(node('percent-number').textContent!==String(percent))node('percent-number').textContent=String(percent); attr('progress-fill','width',305*percent/100);
    reveal('process-en',f,305,323); reveal('process-cn',f,312,330); show('process-line',ramp(motionFrame,318,330));
    attr('processing','transform','translate(0 0)');
    attr('progress-outline','stroke',f===303||f===304?'#222421':'#e5e9e0');
    if(f>=368) { show('progress-outline',false); }
    else { const w=mix(389,309,out(ramp(motionFrame,300,340)));box('progress-outline',975-w/2,518,w,12); attr('progress-outline','fill','none'); }
    if(f<368)show('progress-outline',true);
    // The filled loading strip covers the processing glyphs before the card
    // opens vertically. Its width jumps in the source; it is not an ease-out.
    show('auth-morph',f>=368&&f<=378);
    const morphW=curve(motionFrame,[[368,308],[369,308],[371,309],[372,316],[373,397],[374,719],[375,841],[376,841],[377,864],[378,864]]);
    const morphH=curve(motionFrame,[[368,62],[369,86],[370,86],[371,92],[372,94],[377,94],[378,109]]);
    box('auth-morph',curve(motionFrame,[[368,972],[369,971],[372,968],[373,960],[378,960]])-morphW/2,curve(motionFrame,[[368,549],[369,540],[378,540]])-morphH/2,morphW,morphH);
    attr('auth-morph-blur','stdDeviation',`${f===373?12:f===374?8:1.2} 1.5`);
    let authW=0,authH=0,authAlpha=0;
    if(f>=379&&f<=456) { authW=curve(motionFrame,[[379,866],[381,867],[383,868],[384,868],[386,885],[387,898],[388,898],[390,917],[392,923],[400,922],[402,913],[403,904],[405,902],[456,902]]);authH=curve(motionFrame,[[379,202],[380,466],[381,579],[382,579],[383,602],[386,600],[387,590],[390,577],[400,577],[402,571],[403,564],[456,564]]);authAlpha=1; }
    else if(f>=457&&f<=461) { authW=902;authH=curve(motionFrame,[[457,550],[458,488],[459,124],[460,124],[461,22]]);authAlpha=1; }
    card('auth-card',authW,authH,authAlpha);
    const cardX=curve(motionFrame,[[379,0],[400,0],[402,4],[403,16],[404,34],[405,39],[407,40],[408,41],[409,35],[410,20],[411,3],[413,0]]);
    const cardY=curve(motionFrame,[[379,0],[400,0],[402,4],[403,16],[404,29],[405,32],[407,34],[408,33],[409,30],[410,16],[411,3],[413,0]]);
    node('auth-card').style.transform=`translate(${cardX}px,${cardY}px)`;
    node('auth-card').style.filter=`url(#auth-edge-soften)${f===461?' brightness(1.1)':''}`;
    const edgeBlur=curve(motionFrame,[[379,8],[380,5],[381,2],[383,1],[384,.6],[403,.6],[409,.6],[410,3],[411,.6],[456,.6],[457,4],[458,10],[459,29],[460,29],[461,2]]);
    attr('auth-edge-blur','stdDeviation',`.6 ${edgeBlur}`);
    // The offset is a short echo of the same white plane. Text follows the
    // front plane; the echo never introduces a second authorization message.
    card('auth-echo',authW,authH,f>=386&&f<=410?curve(motionFrame,[[386,.16],[390,.22],[402,.22],[403,.5],[404,.64],[408,.64],[409,.4],[410,.2]]):0);
    node('auth-echo').style.transform=`translate(${curve(motionFrame,[[386,-8],[402,-8],[403,-22],[404,-68],[405,-70],[408,-70],[409,-47],[410,-20]])+cardX}px,${curve(motionFrame,[[386,-5],[402,-5],[403,-25],[404,-58],[405,-60],[408,-60],[409,-42],[410,-15]])+cardY}px)`;
    const textX=curve(motionFrame,[[384,9],[386,9],[390,6],[392,10],[400,10],[402,11],[403,24],[404,38],[405,39],[407,40],[408,41],[409,35],[410,30],[411,13],[412,13],[413,6],[414,4],[416,2],[419,0]]);
    const textY=curve(motionFrame,[[384,26],[386,26],[390,33],[392,37],[400,37],[402,38],[403,44],[404,54],[405,61],[407,61],[408,62],[409,59],[410,43],[411,21],[412,21],[413,16],[414,15],[416,11],[419,7],[421,4],[424,0]]);
    const authSquash=f>=457?curve(motionFrame,[[457,1],[458,1],[459,1],[460,1],[461,.18]]):1;
    attr('authorized','transform',`translate(${textX} ${textY}) translate(0 540) scale(1 ${authSquash}) translate(0 -540)`);
    show('authorized',f>=384&&f<=461?f===398?0:f===384?.3:f===401?.38:f===461?.18:1:0);
    attr('auth-ink-blur','stdDeviation',`${f===403?2.5:f===410?5:f===461?2.3:.4} ${f===403?1.5:f===410?1.1:f===461?1.2:.4}`);
    // Measured letter boundaries preserve the source's repeated/empty frames.
    const authCounts=[1,1,2,3,3,4,5,6,8,9,9,12,13,15,0,17,17,18,19,20];
    const count=f<384?0:f<=403?authCounts[f-384]:20;
    const message=authMessage.slice(0,count);if(authTitle.textContent!==message)authTitle.textContent=message;
    const authSvg=node('auth-en').querySelector('svg')!;
    authSvg.setAttribute('width','374');authSvg.setAttribute('overflow','visible');
    show('auth-en',f>=384);
    const chineseEnds=[1,2,4,6,6,9,11];
    const cnCount=f<414?0:f<=420?chineseEnds[f-414]:11;
    const cnSvg=node('auth-cn').querySelector('svg')!;
    cnSvg.setAttribute('width',String(cnCount?358*cnCount/11+4:0));cnSvg.setAttribute('overflow',cnCount<11?'hidden':'visible');show('auth-cn',cnCount>0);
    show('auth-line',f>=404&&f<=461);
    attr('auth-line','d',`M766 518h${curve(motionFrame,[[404,7],[407,7],[408,18],[409,42],[410,82],[411,95],[412,95],[413,182],[414,268],[415,312],[416,339],[417,355],[418,355],[419,366],[420,370]])}`);
    const geometryY=curve(motionFrame,[[384,46],[390,46],[394,46],[405,46],[409,46],[410,46],[411,62],[412,62],[413,72],[414,87],[415,87],[416,87],[419,85],[420,80],[421,81],[422,80],[425,81],[426,81],[427,79],[428,76],[429,69],[430,69],[431,64],[432,65],[433,69],[434,88],[435,99],[436,99],[437,104]]);
    const geometryAngle=curve(motionFrame,[[384,45],[386,45],[387,49],[389,20],[390,3],[391,0],[394,0],[395,4],[396,25],[397,45],[400,45],[402,30],[403,20],[404,4],[405,0],[408,0],[409,8],[410,32],[411,45],[414,45],[415,42],[416,38],[417,30],[419,10],[420,0]]);
    const geometryScale=curve(motionFrame,[[384,.25],[385,.4],[386,.65],[387,.85],[388,1]]);
    attr('auth-geometry','transform',`translate(949 ${494+geometryY}) rotate(${geometryAngle}) scale(${geometryScale})`);
    const geometry=node('auth-geometry').querySelector('rect')!;
    geometry.setAttribute('rx',String(curve(motionFrame,[[384,3],[418,3],[419,10],[420,14],[421,16]])));
    geometry.setAttribute('fill',f>=421&&f<=425?'currentColor':'none');
    show('auth-geometry',f>=384&&f<=438?f<=385?.18+.3*(f-384):f===437?.18:f===438?.08:.75:0);
    const inner=f>=427&&f<=460;show('auth-inner',inner);
    const innerW=curve(motionFrame,[[427,864],[428,836],[429,816],[430,816],[431,797],[432,781],[433,768],[434,756],[435,748],[436,748],[437,740],[438,732],[439,724],[440,720],[441,714],[442,714],[445,702],[447,696],[448,696],[449,693],[450,690],[451,690],[453,684],[454,684],[455,682],[456,682],[457,682]]);
    const innerH=curve(motionFrame,[[427,516],[428,440],[429,409],[430,409],[431,384],[432,357],[433,335],[434,316],[435,300],[436,300],[437,286],[438,272],[439,262],[440,252],[441,244],[442,244],[445,226],[447,220],[448,220],[449,216],[450,214],[451,212],[453,210],[455,210],[456,208],[457,182],[458,50],[459,4]]);
    box('auth-border',960-innerW/2,540-innerH/2,innerW,innerH);
    const borderBlank=[443,444,446,452].includes(f);
    show('auth-border',inner&&f>=428&&f<=456&&!borderBlank?f===428?.12:f===451?.4:f===456?.55:.8:0);
    attr('auth-sides','d',`M${960-innerW/2} ${540-innerH/2}v${innerH}M${960+innerW/2} ${540-innerH/2}v${innerH}`);
    show('auth-sides',f===427?.12:f===428?.35:f>=457&&f<=460?.75:0);
    welcome.render(f,motionFrame);reveal('welcome-year',f,498,502);
  } };
}
