export type AudioSnapshot = {
  state: 'locked' | 'loading' | 'ready' | 'playing' | 'muted' | 'unavailable';
  contextState: AudioContextState | 'not-created';
  muted: boolean;
  sourceTime: number;
  duration: number;
  rms: number;
  drift: number;
  corrections: number;
  volume: number;
};

// Active sound leads the scene via the device output clock; WELCOME holds the
// foreground while the same source continues through its independently timed tail.
export function createSourceAudio(stage: HTMLElement, control: HTMLElement, sceneTime: () => number) {
  const request = new AbortController();
  let context: AudioContext | undefined, buffer: AudioBuffer | undefined;
  let gain: GainNode | undefined, analyser: AnalyserNode | undefined, source: AudioBufferSourceNode | undefined;
  let offset = 0, startedAt = 0, wantsPlayback = false, muted = false, unavailable = false, disposed = false;
  const corrections = 0;
  let finishing = false, tailPosition = 0;
  const samples = new Float32Array(1024);
  const fadeStart=545/30+4.5,fadeEnd=545/30+6;
  const level=(time:number)=>Math.max(0,Math.min(1,(fadeEnd-time)/(fadeEnd-fadeStart)))**2;
  function scheduleGain(time:number,at:number,smooth=false):void {
    if(!gain||!context)return;
    gain.gain.cancelScheduledValues(context.currentTime);
    const begin=at+(smooth?.025:0),initial=muted?0:level(time+(begin-at));
    if(smooth){gain.gain.setValueAtTime(gain.gain.value,at);gain.gain.linearRampToValueAtTime(initial,begin);}
    else gain.gain.setValueAtTime(initial,begin);
    if(muted)return;
    if(time<fadeStart)gain.gain.setValueAtTime(1,at+fadeStart-time);
    const start=Math.max(time+(begin-at),fadeStart);
    for(let i=1;i<=48;i++){const t=start+(fadeEnd-start)*i/48;if(t>time)gain.gain.linearRampToValueAtTime(level(t),at+t-time);}
  }

  function outputTime(): number {
    if (!context) return 0;
    const stamp = context.getOutputTimestamp?.();
    // The render clock describes pixels now; currentTime describes samples still
    // queued for the device. Compare against the output clock when available.
    if (stamp?.contextTime !== undefined && stamp.performanceTime) {
      return Math.min(context.currentTime, stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000);
    }
    return Math.max(0, context.currentTime - context.baseLatency - (context.outputLatency || 0));
  }
  function position(): number {
    return source && context ? Math.max(offset,Math.min(fadeEnd, offset + outputTime() - startedAt)) : finishing ? tailPosition : sceneTime();
  }
  function state(): AudioSnapshot['state'] {
    if (unavailable) return 'unavailable';
    if (!context) return 'locked';
    if (!buffer) return 'loading';
    return source ? muted ? 'muted' : 'playing' : 'ready';
  }
  function publish(): void {
    stage.dataset.audioState = state();
    stage.dataset.audioTime = position().toFixed(4);
    control.setAttribute('aria-checked', String(!muted));
  }
  function stopSource(): void {
    const previous = source;
    source = undefined;
    if (previous) { previous.onended = null; previous.stop(); previous.disconnect(); }
  }
  function startSource(): void {
    if (disposed || !wantsPlayback || document.hidden || !buffer || !context || context.state !== 'running' || !gain) return;
    const base=finishing ? tailPosition : sceneTime();
    // Never skip the opening phoneme to compensate for a newly opened device.
    const time = base;
    if (time >= Math.min(fadeEnd,buffer.duration)) return;
    stopSource();
    const next = context.createBufferSource();
    next.buffer = buffer;
    next.connect(gain);
    offset = time; startedAt = context.currentTime;
    scheduleGain(offset,startedAt);
    source = next;
    next.onended = () => { if (source === next) { tailPosition=fadeEnd; wantsPlayback=false; next.disconnect(); source = undefined; publish(); } };
    next.start(startedAt, offset,Math.min(fadeEnd,buffer.duration)-offset);
    publish();
  }
  function fail(): void {
    if (disposed) return;
    unavailable = true; stopSource(); publish();
  }
  const prepared=fetch(`${import.meta.env.BASE_URL}assets/audio/interactive-cycle.m4a`, { signal: request.signal })
    .then((response) => { if (!response.ok) throw new Error('Soundtrack unavailable'); return response.arrayBuffer(); })
    .then(async (data) => {
      if (disposed) return;
      // Decode before the click without creating an audible/autoplay context.
      // With the asset ready, the power gesture can start immediately.
      const decoded = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(data);
      if (disposed) return;
      buffer = decoded; startSource(); publish();
    }).catch(fail);

  function unlock(): void {
    if (disposed || unavailable) return;
    try {
      // Create and resume inside the real click/key event to satisfy autoplay policy.
      if (!context) {
        context = new AudioContext({ latencyHint: 'interactive' });
        gain = context.createGain(); gain.gain.value = muted ? 0 : level(sceneTime());
        analyser = context.createAnalyser(); analyser.fftSize = samples.length;
        gain.connect(analyser); analyser.connect(context.destination);
        context.onstatechange = () => { if (!disposed) publish(); };
      }
      const current = context;
      void current.resume().then(() => { if (!source) startSource(); publish(); }).catch(fail);
      publish();
    } catch { fail(); }
  }
  function sync(): void {
    // The scene follows the device output while audio is active. There is no
    // need to jump the soundtrack forward, including in later spoken cues.
    publish();
  }
  publish();
  return {
    unlock,
    async prepared() { await prepared;if(context?.state==='suspended')await context.resume().catch(fail); },
    playbackTime() { return source&&!finishing ? position() : undefined; },
    play() { wantsPlayback = true; if(!source)startSource(); publish(); },
    pause() { if(finishing)tailPosition=position(); wantsPlayback = false; stopSource(); publish(); },
    reset() { finishing=false;tailPosition=0;wantsPlayback=false;stopSource();publish(); },
    finish() { finishing=true;tailPosition=sceneTime();if(!source)startSource();publish(); },
    sync,
    toggleMuted() {
      muted = !muted;
      if (gain && context) scheduleGain(position(),context.currentTime,true);
      publish();
    },
    snapshot(): AudioSnapshot {
      analyser?.getFloatTimeDomainData(samples);
      const rms = analyser ? Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length) : 0;
      return { state: state(), contextState: context?.state ?? 'not-created', muted, sourceTime: position(), duration: buffer?.duration ?? 0, rms, drift: source&&!finishing ? position() - sceneTime() : 0, corrections,volume:gain?.gain.value??0 };
    },
    destroy() {
      disposed = true; wantsPlayback = false; request.abort(); stopSource();
      if (context) { context.onstatechange = null; void context.close().catch(() => {}); }
    },
  };
}
