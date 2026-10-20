/** One instanced draw for the existing ordered Canvas particles; no geometry reduction. */
export type ParticleBatch={
 readonly active:boolean;
 begin(width:number,height:number):boolean;
 circle(x:number,y:number,radius:number,alpha:number,style?:'globe'|'strand'|'core'):void;
 grain(x:number,y:number,halfSize:number,alpha:number):void;
 texture(source:HTMLCanvasElement):void;
 flush(ctx:CanvasRenderingContext2D):void;
 destroy():void;
};

export function createParticleBatch():ParticleBatch|undefined {
 const canvas=document.createElement('canvas');canvas.id='particle-batch';
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:true,premultipliedAlpha:true});
 if(!gl)return;
 try {
 const info=gl.getExtension('WEBGL_debug_renderer_info'),renderer=info?String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)):'';
 const instancing=gl.getExtension('ANGLE_instanced_arrays');
 // Software WebGL is slower than the original 2D path on this workload.
 if(!instancing||!renderer||/SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(renderer)){gl.getExtension('WEBGL_lose_context')?.loseContext();return;}
 let valid=true,active=false,count=0,capacity=8192,data=new Float32Array(capacity*5);
 const lost=(event:Event)=>{event.preventDefault();valid=false;active=false;};canvas.addEventListener('webglcontextlost',lost);
 const shader=(type:number,source:string)=>{
  const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(error||'Particle shader failed');}return s;
 };
 const program=gl.createProgram()!;
 const vertex=shader(gl.VERTEX_SHADER,`precision highp float;
 attribute vec2 corner;attribute vec4 pose;attribute float kind;uniform float ratio;
 varying vec2 local;varying float radius;varying float opacity;varying float shape;
 void main(){float extent=pose.z+(kind==1.?0.:1./ratio);local=corner*extent;radius=pose.z;opacity=pose.w;shape=kind;
 vec2 p=pose.xy+local;gl_Position=vec4(p.x/960.-1.,1.-p.y/540.,0.,1.);}`);
 const fragment=shader(gl.FRAGMENT_SHADER,`precision highp float;
 varying vec2 local;varying float radius;varying float opacity;varying float shape;uniform float ratio;uniform sampler2D grain;
 void main(){float coverage=0.;
 if(shape==1.)coverage=texture2D(grain,local/(2.*radius)+.5).a;
 else{for(int y=0;y<4;y++){for(int x=0;x<4;x++){
 vec2 offset=(vec2(float(x),float(y))*.25-.375)/ratio;
 // Match the small-circle coverage of Canvas/Skia, keeping the geometric radius.
 float edge=shape==3.?.063:shape==0.?.1:.075;
 coverage+=1.-step(radius+edge/ratio,length(local+offset));}}coverage*=.0625;}
 vec3 color=(shape==0.||shape==3.)?vec3(52.,58.,51.)/255.:vec3(83.,90.,79.)/255.;
 gl_FragColor=vec4(color,coverage*opacity);}`);
 gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);throw new Error('Particle program failed');}
 const quad=gl.createBuffer()!,instances=gl.createBuffer()!,texture=gl.createTexture()!;
 gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const corner=gl.getAttribLocation(program,'corner'),pose=gl.getAttribLocation(program,'pose'),kind=gl.getAttribLocation(program,'kind');
 gl.enableVertexAttribArray(corner);gl.vertexAttribPointer(corner,2,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,instances);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
 gl.enableVertexAttribArray(pose);gl.vertexAttribPointer(pose,4,gl.FLOAT,false,20,0);instancing.vertexAttribDivisorANGLE(pose,1);
 gl.enableVertexAttribArray(kind);gl.vertexAttribPointer(kind,1,gl.FLOAT,false,20,16);instancing.vertexAttribDivisorANGLE(kind,1);
 const ratio=gl.getUniformLocation(program,'ratio');gl.uniform1i(gl.getUniformLocation(program,'grain'),0);
 gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
 const add=(x:number,y:number,r:number,alpha:number,shape:number):void=>{
  if(count===capacity){capacity*=2;const expanded=new Float32Array(capacity*5);expanded.set(data);data=expanded;gl.bindBuffer(gl.ARRAY_BUFFER,instances);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);}
  const at=count++*5;data[at]=x;data[at+1]=y;data[at+2]=r;data[at+3]=alpha;data[at+4]=shape;
 };
 return {
  get active(){return active;},
  begin(width,height){
   count=0;active=valid&&!gl.isContextLost();
   if(active&&(canvas.width!==width||canvas.height!==height)){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
   return active;
  },
  circle(x,y,r,alpha,style='strand'){add(x,y,r,alpha,style==='globe'?3:style==='core'?2:0);},
  grain(x,y,r,alpha){add(x,y,r,alpha,1);},
  texture(source){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);},
  flush(ctx){
   ctx.canvas.dataset.particleRenderer=active?'webgl-instanced':'canvas2d';ctx.canvas.dataset.particlePrimitives=String(count);
   if(!active||!count)return;
   gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.uniform1f(ratio,canvas.width/1920);gl.bindBuffer(gl.ARRAY_BUFFER,instances);gl.bufferSubData(gl.ARRAY_BUFFER,0,data.subarray(0,count*5));
   instancing.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP,0,4,count);
   // One GPU-to-Canvas copy preserves the existing vignette and foreground order.
   ctx.globalAlpha=1;ctx.drawImage(canvas,0,0,1920,1080);
  },
  destroy(){valid=false;active=false;canvas.removeEventListener('webglcontextlost',lost);gl.deleteBuffer(quad);gl.deleteBuffer(instances);gl.deleteTexture(texture);gl.deleteProgram(program);canvas.width=canvas.height=0;gl.getExtension('WEBGL_lose_context')?.loseContext();}
 };
 }catch(error){gl.getExtension('WEBGL_lose_context')?.loseContext();throw error;}
}
