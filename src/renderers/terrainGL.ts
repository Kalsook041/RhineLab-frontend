/** GPU line field; its only texture is a browser-generated cache of small font digits. */
type Row = { base:number;depth:number;seed:number;marks:Uint8Array;glyphs:Array<{x:number;seed:number}> };
export type TerrainGL = { render(time:number,opacity:number):boolean; texture(source:HTMLCanvasElement):void; resize(width:number,height:number):void;destroy():void };
export function createTerrainGL(canvas:HTMLCanvasElement,rows:Row[]):TerrainGL|undefined {
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true,premultipliedAlpha:true});if(!gl)return;
  // Chromium's software GPU is slower than the cached 2D field. Keep a real
  // hardware path for desktop browsers, and use the same geometry in 2D otherwise.
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  const renderer=info?String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)):'';
  if(!renderer||/SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(renderer))return;
  canvas.dataset.renderer=renderer;
  let valid=true;
  const lost=(event:Event)=>{event.preventDefault();valid=false;};canvas.addEventListener('webglcontextlost',lost);
  const shader=(type:number,source:string)=>{const value=gl.createShader(type)!;gl.shaderSource(value,source);gl.compileShader(value);if(!gl.getShaderParameter(value,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(value)??'Terrain shader failed');return value;};
  const program=(vertex:string,fragment:string)=>{const p=gl.createProgram()!,v=shader(gl.VERTEX_SHADER,vertex),f=shader(gl.FRAGMENT_SHADER,fragment);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)??'Terrain program failed');return p;};
  const field=program(`precision highp float;attribute vec4 point;uniform float time;uniform float ratio;varying float depth;
  void main(){float x=point.x,b=point.y,d=point.z,s=b*.001;float y=b-x*(.04+.22*d)+(13.+d*14.)*sin(x*.004+s*2.1+time*.27)+7.*sin(x*.011+s*4.3-time*.19)+2.3*sin(x*.034+s*9.+time*.43)+.55*sin(x*.7+point.w*100.);gl_Position=vec4(x/960.-1.,1.-y/540.,0.,1.);gl_PointSize=(.8+d*.5)*ratio;depth=d;}`,`precision mediump float;uniform float opacity;uniform float marks;uniform highp float ratio;varying float depth;void main(){float w=.8+depth*.5;float size=min(1.,w*ratio);float alpha=marks>.5?(.25+depth*.48)*size*size*.8/w:(.28+depth*.45)*min(1.,(.5+depth*.34)*ratio);gl_FragColor=vec4(.867,.89,.851,alpha*opacity);}`);
  const digits=program(`precision highp float;attribute vec2 point;attribute vec2 texcoord;attribute float alpha;uniform float opacity;varying vec2 uv;varying float visibility;void main(){gl_Position=vec4(point.x/960.-1.,1.-point.y/540.,0.,1.);uv=texcoord;visibility=alpha*opacity;}`,`precision mediump float;uniform sampler2D atlas;varying vec2 uv;varying float visibility;void main(){float a=texture2D(atlas,uv).a;gl_FragColor=vec4(.863,.894,.843,a*visibility);}`);
  const lineData:number[]=[],markData:number[]=[];
  for(const row of rows) {
    if(row.base-1920*(.04+.22*row.depth)>1140)continue;
    for(let i=0;i<322;i++)lineData.push(i*6-6,row.base,row.depth,row.seed,(i+1)*6-6,row.base,row.depth,row.seed);
    for(let i=1;i<321;i++)if(row.marks[i])markData.push(i*6-6,row.base,row.depth,row.seed);
  }
  const buffer=(data:Float32Array)=>{const b=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;};
  const lines=buffer(new Float32Array(lineData)),marks=buffer(new Float32Array(markData)),glyphs=gl.createBuffer()!,atlas=gl.createTexture()!;
  const totalGlyphs=rows.reduce((sum,row)=>sum+row.glyphs.length,0),glyphData=new Float32Array(totalGlyphs*6*5);
  let atlasWidth=512,atlasHeight=Math.ceil(rows.length*10/16)*32;
  const bindPoint=(p:WebGLProgram,b:WebGLBuffer,stride:number)=>{gl.bindBuffer(gl.ARRAY_BUFFER,b);const location=gl.getAttribLocation(p,'point');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,stride===16?4:2,gl.FLOAT,false,stride,0);};
  const fieldPoint=gl.getAttribLocation(field,'point'),glyphPoint=gl.getAttribLocation(digits,'point'),glyphUV=gl.getAttribLocation(digits,'texcoord'),glyphAlpha=gl.getAttribLocation(digits,'alpha');
  gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  const fieldTime=gl.getUniformLocation(field,'time'),fieldRatio=gl.getUniformLocation(field,'ratio'),fieldOpacity=gl.getUniformLocation(field,'opacity'),fieldMarks=gl.getUniformLocation(field,'marks'),glyphOpacity=gl.getUniformLocation(digits,'opacity');
  return {
    resize(width,height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);},
    texture(source){atlasWidth=source.width;atlasHeight=source.height;gl.bindTexture(gl.TEXTURE_2D,atlas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);},
    render(time,opacity){
      if(!valid)return false;
      gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(field);gl.uniform1f(fieldTime,time);gl.uniform1f(fieldRatio,canvas.width/1920);gl.uniform1f(fieldOpacity,opacity);
      gl.disableVertexAttribArray(glyphUV);gl.disableVertexAttribArray(glyphAlpha);
      bindPoint(field,lines,16);gl.uniform1f(fieldMarks,0);gl.drawArrays(gl.LINES,0,lineData.length/4);
      bindPoint(field,marks,16);gl.uniform1f(fieldMarks,1);gl.drawArrays(gl.POINTS,0,markData.length/4);
      let at=0;
      for(let rowIndex=0;rowIndex<rows.length;rowIndex++) {
        const row=rows[rowIndex],d=row.depth,s=row.base*.001,angle=-.05-.15*d,cos=Math.cos(angle),sin=Math.sin(angle);
        for(const glyph of row.glyphs){
          const x=(glyph.x+Math.sin(time*.18+glyph.seed*8)*8+1920)%1920;
          const y=row.base-x*(.04+.22*d)+(13+d*14)*Math.sin(x*.004+s*2.1+time*.27)+7*Math.sin(x*.011+s*4.3-time*.19)+2.3*Math.sin(x*.034+s*9+time*.43)-1;
          if(y< -15||y>1100)continue;
          const cycle=Math.floor(time*(.6+glyph.seed*.7)+glyph.seed*40),index=rowIndex*10+((cycle+Math.floor(glyph.seed*10))%10+10)%10;
          const alpha=(.21+d*.46)*(.65+.35*Math.sin(time*2+glyph.seed*20)**2),scale=atlasWidth/512;
          const u=(index%16)*32*scale/atlasWidth,v=Math.floor(index/16)*32*scale/atlasHeight,du=32*scale/atlasWidth,dv=32*scale/atlasHeight;
          for(const [dx,dy,ux,vy] of [[-4,-24,0,0],[28,-24,1,0],[-4,8,0,1],[-4,8,0,1],[28,-24,1,0],[28,8,1,1]]) {glyphData[at++]=x+dx*cos-dy*sin;glyphData[at++]=y+dx*sin+dy*cos;glyphData[at++]=u+ux*du;glyphData[at++]=v+vy*dv;glyphData[at++]=alpha;}
        }
      }
      gl.useProgram(digits);gl.uniform1f(glyphOpacity,opacity);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,atlas);
      gl.bindBuffer(gl.ARRAY_BUFFER,glyphs);gl.bufferData(gl.ARRAY_BUFFER,glyphData.subarray(0,at),gl.DYNAMIC_DRAW);
      gl.disableVertexAttribArray(fieldPoint);gl.enableVertexAttribArray(glyphPoint);gl.vertexAttribPointer(glyphPoint,2,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(glyphUV);gl.vertexAttribPointer(glyphUV,2,gl.FLOAT,false,20,8);gl.enableVertexAttribArray(glyphAlpha);gl.vertexAttribPointer(glyphAlpha,1,gl.FLOAT,false,20,16);gl.drawArrays(gl.TRIANGLES,0,at/5);return true;
    },
    destroy(){valid=false;canvas.removeEventListener('webglcontextlost',lost);gl.deleteBuffer(lines);gl.deleteBuffer(marks);gl.deleteBuffer(glyphs);gl.deleteTexture(atlas);gl.deleteProgram(field);gl.deleteProgram(digits);canvas.width=0;canvas.height=0;},
  };
}
