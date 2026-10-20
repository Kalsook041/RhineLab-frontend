import { gsap } from 'gsap';
import { createNativeBackground, type NativeBackground } from '../renderers/nativeBackground';
import { createNativeInterface } from '../renderers/nativeInterface';
import { createSourceAudio, type AudioSnapshot } from '../audio/sourceAudio';
export const SOURCE_TIMING = { fps: 30, holdFrame: 144, lastFrame: 545, hold: 4.8, end: 545 / 30 } as const;
type PlaybackState = 'loading' | 'ready' | 'intro' | 'waiting' | 'playing' | 'welcome';
type FidelityAPI = { seek(time: number): Promise<void>; getTime(): number; getState(): PlaybackState; getAudioState(): AudioSnapshot; restart(): Promise<void> };
declare global { interface Window { __tangent: FidelityAPI } }
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const clampTime = (value: number) => Math.max(0, Math.min(SOURCE_TIMING.end, value));
export function createSceneController(): { destroy(): void } {
  const stage = el('stage'), plane = el('coordinate-plane'), cardPlane=el('card-plane'), interactionPlane=el('interaction-plane'), power = el<HTMLButtonElement>('power');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), sample = { time: 0 };
  const credentials = el<HTMLFormElement>('credentials'), account = el<HTMLInputElement>('account'), password = el<HTMLInputElement>('password'), credentialError = el('credential-error');
  const audio = createSourceAudio(stage, el('sound'), () => sample.time);
  let state: PlaybackState = 'loading', disposed = false, backgroundMotion = !reduced.matches, visibleResume = false;
  let startup=true,starting=false,initialized=false;
  let generation = 0, lastFrame = -1, frozenBackground = 0, background: NativeBackground | undefined;
  let ambientHold=false,ambientOffset=0,ambientTick:number|undefined;
  let cornerIdleOffset=0;
  let foreground: ReturnType<typeof createNativeInterface> | undefined, clock: gsap.core.Timeline | undefined;
  const cleanups: Array<() => void> = [];
  function setState(): void {
    state = startup ? 'ready' : sample.time >= SOURCE_TIMING.end - .0001 ? 'welcome' : sample.time > SOURCE_TIMING.hold + .0001 ? 'playing' : sample.time >= SOURCE_TIMING.hold - .0001 ? 'waiting' : 'intro';
    stage.dataset.state = state;
    el<HTMLButtonElement>('start').hidden=!startup;
    el<HTMLButtonElement>('start').disabled=!initialized||starting;
    const phase = sample.time < 2.4 ? 'access' : sample.time < 7.8 ? 'identity' : sample.time < 10 ? 'request' : sample.time < 12.67 ? 'processing' : sample.time < 15.4 ? 'authorized' : sample.time < 16.367 ? 'reveal' : 'welcome';
    if (stage.dataset.phase !== phase) {
      stage.dataset.phase = phase;
      el('scene-description').textContent = ({ access: 'ACCESS PERMISSION REQUIRED，需要访问许可', identity: 'ID CONFIRMED，身份信息确认中', request: 'REQUEST RECEIVED，正在接收访问需求', processing: 'START PROCESSING，开始读取权限', authorized: 'PERMISION AUTHORIZED，读取完毕，核验通过', reveal: '界面展开中', welcome: 'WELCOME，2022' })[phase];
    }
    power.disabled = state !== 'waiting' || Boolean(clock); power.hidden = power.disabled;
    credentials.hidden = power.disabled;
    account.disabled = password.disabled = power.disabled;
    el('welcome-title').hidden = sample.time < 491 / 30;
    stage.dataset.sourceTime = sample.time.toFixed(4);
  }
  function render(settle = false): void {
    const frame = Math.floor(clampTime(sample.time) * 30 + .001);
    const motionFrame=Math.max(frame,clampTime(sample.time)*30);
    setState();
    if (settle || frame !== lastFrame) {
      // Each field begins on the source phase. Discard the ready-globe delay
      // in f61–71's empty interval, never while either spiral is visible.
      // The curve phase survives the power wait until its f303 disappearance.
      if((frame>=61&&lastFrame<61)||(frame>=303&&lastFrame<303))ambientOffset=0;
      lastFrame = frame;
    }
    // Source frames still gate cuts and text. Geometry follows every refresh.
    foreground?.render(frame,motionFrame/30+cornerIdleOffset,reduced.matches,motionFrame);
    paintBackground(frame,settle,motionFrame);
    audio.sync();
  }
  function paintBackground(frame:number,settle=false,motionFrame=frame):void {
    if(backgroundMotion||settle)frozenBackground=motionFrame/30+ambientOffset;
    background?.render(frame,frozenBackground,motionFrame);
  }
  const ambient=(time:number)=>{
    const previous=ambientTick;ambientTick=time;
    if(previous===undefined||!ambientHold||reduced.matches||document.hidden||disposed)return;
    const delta=Math.min(.1,Math.max(0,time-previous));if(backgroundMotion)ambientOffset+=delta;
    if(lastFrame>=121&&lastFrame<305)cornerIdleOffset+=delta;
    if(backgroundMotion)paintBackground(lastFrame);
    foreground?.renderBrand(lastFrame,lastFrame/30+cornerIdleOffset,reduced.matches);
  };
  gsap.ticker.add(ambient);cleanups.push(()=>gsap.ticker.remove(ambient));
  function stop(): void { clock?.kill(); clock = undefined; audio.pause(); ambientHold=false;ambientTick=undefined; stage.dataset.paused = 'true'; }
  async function seek(time: number, keepAudio=false, preserveMotion=false): Promise<void> {
    startup=false;
    const id = ++generation;
    if(keepAudio){clock?.kill();clock=undefined;stage.dataset.paused='false';}
    else{stop();audio.reset();}
    // Explicit debug seeks reset to the source pose. Natural endpoints are
    // holds on the existing field, so neither background nor corner may rewind.
    if(!preserveMotion){ambientOffset=0;cornerIdleOffset=0;}
    sample.time = clampTime(time); render(true);
    // Debug seeks wait for paint; natural holds must keep the particle ticker
    // running immediately instead of freezing it for two presentation frames.
    if(!preserveMotion)await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (id !== generation || disposed) return;
    if (state === 'welcome') el('welcome-title').focus({ preventScroll: true });
  }
  async function play(): Promise<void> {
    if (disposed || clock || document.hidden) return;
    if(state==='welcome'){audio.play();ambientHold=true;ambientTick=undefined;stage.dataset.paused='false';return;}
    ambientHold=false;ambientTick=undefined;
    const id = ++generation, target = sample.time < SOURCE_TIMING.hold - .0001 ? SOURCE_TIMING.hold : SOURCE_TIMING.end;
    const startTime=sample.time;
    stage.dataset.paused = 'false';
    audio.play();
    const complete=() => {
      if (id !== generation || disposed) return;
      const completed=generation+1;
      if(target===SOURCE_TIMING.end)audio.finish();
      void seek(target,target===SOURCE_TIMING.end,true).then(() => {
        if(disposed||generation!==completed)return;
        ambientHold=true;
        el('announcer').textContent = target === SOURCE_TIMING.hold ? '电源已就绪，请输入账户和密码，点击电源或按 Enter 登录。' : 'WELCOME。按 R 重新播放。';
      });
    };
    clock = gsap.timeline({ defaults: { ease: 'none' }, onComplete: complete });
    clock.addLabel(target === SOURCE_TIMING.hold ? 'intro-to-power' : 'power-to-welcome', 0);
    clock.to(sample, { time: target, duration: target - sample.time, onUpdate: () => {
      // Let the actual device output lead; catch up the visual
      // clock instead of stopping/restarting a word after a long render frame.
      const audible=audio.playbackTime();
      if(audible!==undefined){
        sample.time=Math.min(target,audible);
        if(audible>=target){complete();return;}
        clock?.time(sample.time-startTime,true);
      }
      render();
    } });
    setState();
  }
  async function begin():Promise<void>{
    if(!startup||starting||disposed||!initialized)return;
    starting=true;setState();audio.unlock();
    const id=++generation;await audio.prepared();
    if(disposed||generation!==id){starting=false;return;}
    if(document.hidden){starting=false;render();return;}
    startup=false;starting=false;
    if(reduced.matches){await seek(SOURCE_TIMING.hold);return;}
    // Preserve the sphere's orientation at the click; source time still starts
    // at zero, so the complete ACCESS voice plays before the power hold.
    sample.time=0;render();await play();
  }
  function clearCredentialError(): void {
    credentialError.hidden = true; credentialError.textContent = ''; el('credential-hint').hidden = false;
    account.removeAttribute('aria-invalid'); password.removeAttribute('aria-invalid');
  }
  async function restart(): Promise<void> { credentials.reset(); clearCredentialError(); const started = generation + 1; await seek(reduced.matches ? SOURCE_TIMING.hold : 0); if (generation === started && !reduced.matches) await play(); }
  async function clickPower(): Promise<void> {
    if (state !== 'waiting') return;
    const id=generation;await audio.prepared();
    if(disposed||generation!==id||state!=='waiting')return;
    if (reduced.matches) await seek(SOURCE_TIMING.end); else await play();
  }
  function submitCredentials(event: SubmitEvent): void {
    event.preventDefault();
    if (state !== 'waiting' || clock || disposed) return;
    const validAccount = account.value.trim() === 'admin', validPassword = password.value === '123456';
    if (!validAccount || !validPassword) {
      account.setAttribute('aria-invalid', String(!validAccount)); password.setAttribute('aria-invalid', String(!validPassword));
      credentialError.textContent = !account.value.trim() ? '请输入账户。' : !password.value ? '请输入密码。' : '账户或密码不正确。';
      credentialError.hidden = false; el('credential-hint').hidden = true;
      (!validAccount ? account : password).focus({ preventScroll:true });
      return;
    }
    clearCredentialError(); account.blur(); password.blur(); audio.unlock(); void clickPower();
  }
  credentials.addEventListener('submit', submitCredentials); credentials.addEventListener('input', clearCredentialError);
  cleanups.push(() => { credentials.removeEventListener('submit', submitCredentials); credentials.removeEventListener('input', clearCredentialError); });
  function toggleBackground(): void {
    if (reduced.matches) return;
    backgroundMotion = !backgroundMotion; el('motion').setAttribute('aria-checked', String(backgroundMotion));
    if (backgroundMotion) render(true);
  }
  const onClick = (node: HTMLElement, callback: () => void) => { node.addEventListener('click', callback); cleanups.push(() => node.removeEventListener('click', callback)); };
  onClick(el('start'),()=>{void begin();});
  onClick(el('restart'), () => { audio.unlock(); void restart(); }); onClick(el('motion'), toggleBackground);
  onClick(el('sound'), () => { audio.unlock(); audio.toggleMuted(); });
  const keydown = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if(startup&&(event.code==='Space'||event.key==='Enter')){event.preventDefault();void begin();return;}
    const controlFocused = document.activeElement instanceof HTMLButtonElement;
    if (event.key === 'Tab') stage.classList.add('keyboard');
    if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); audio.unlock(); void restart(); }
    if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleBackground(); }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); audio.unlock(); audio.toggleMuted(); }
    if (event.code === 'Space' && !controlFocused) {
      event.preventDefault();
      if(state==='waiting'&&!clock){ambientHold=!ambientHold;ambientTick=undefined;stage.dataset.paused=String(!ambientHold);return;}
      audio.unlock();if (clock || state==='welcome'&&['playing','muted'].includes(audio.snapshot().state)) { ++generation; stop(); } else void play();
    }
    if (event.key === 'Enter' && state === 'waiting' && !controlFocused) { event.preventDefault(); credentials.requestSubmit(power); }
  };
  document.addEventListener('keydown', keydown); cleanups.push(() => document.removeEventListener('keydown', keydown));
  const visibility = () => { ambientTick=undefined;if (document.hidden) { visibleResume = Boolean(clock)||state==='welcome'&&['playing','muted'].includes(audio.snapshot().state); if (visibleResume) { ++generation; stop(); } } else if (visibleResume) { visibleResume = false; void play(); } };
  document.addEventListener('visibilitychange', visibility); cleanups.push(() => document.removeEventListener('visibilitychange', visibility));
  const resize = () => {
    const width=stage.clientWidth,height=stage.clientHeight;
    const scale=Math.min(width/1920,height/1080),cover=Math.max(width/1920,height/1080);
    stage.style.setProperty('--ui-scale',String(scale));
    // The background fills every pixel; the live interface keeps its proportions.
    plane.style.transform=`translate(${(width-1920*cover)/2}px,${(height-1080*cover)/2}px) scale(${cover})`;
    for(const target of [cardPlane,interactionPlane]) {
      target.style.transform=`translate(${(width-1920*scale)/2}px,${(height-1080*scale)/2}px) scale(${scale})`;
      target.style.setProperty('--scale',String(scale));
    }
    foreground?.resize(width,height);background?.resize(cover);render(true);
  };
  const observer = new ResizeObserver(resize); observer.observe(stage);
  const preferenceChange = () => { if (reduced.matches) { backgroundMotion = false; el('motion').setAttribute('aria-checked', 'false'); void seek(sample.time > SOURCE_TIMING.hold ? SOURCE_TIMING.end : SOURCE_TIMING.hold); } };
  reduced.addEventListener('change', preferenceChange); cleanups.push(() => reduced.removeEventListener('change', preferenceChange));
  const api: FidelityAPI = { seek, getTime: () => sample.time, getState: () => state, getAudioState: audio.snapshot, restart };
  const bg = createNativeBackground(el<HTMLCanvasElement>('background'), () => { el('visual-error').hidden = false; });
  const fonts = Promise.all(['TangentSans','TangentAccess','TangentThin','TangentBrand','TangentImpact','TangentSerif'].map((family) => document.fonts.load(`100px ${family}`, family === 'TangentSerif' ? '身份信息确认中0123456789' : family==='TangentAccess'?'ACCESS PERMISSION REQUIRED':'WELCOME PORTFOLIO')));
  void Promise.all([bg, fonts]).then(async ([renderer]) => {
    if (disposed) { renderer.destroy(); return; }
    background = renderer; foreground = createNativeInterface(); initialized=true;resize();
    el('motion').setAttribute('aria-checked', String(backgroundMotion));
    sample.time=0;render(true);ambientHold=true;ambientTick=undefined;
    if (!disposed) window.__tangent = api;
  });
  return { destroy() { disposed = true; ++generation; stop(); audio.destroy(); observer.disconnect(); for (const cleanup of cleanups) cleanup(); background?.destroy(); } };
}
