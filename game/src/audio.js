// Synthesized sound for Solmar: everything is generated with WebAudio, no assets.
// One job: effects and a light ambient music loop.
export function createAudio() {
  let ctx = null, master = null, musicGain = null, engineOsc = null, engineGain = null;
  let muted = false, musicOn = false, musicTimer = null, sirenOsc = null, sirenGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.14; musicGain.connect(master);
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
      engineOsc.connect(engineGain); engineOsc.start();
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0; sirenGain.connect(master);
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenOsc.connect(sirenGain); sirenOsc.start();
      return true;
    } catch (e) { return false; }
  }
  function unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  function noiseBurst(dur, filterFreq, gain) {
    if (!ensure()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function tone(freq, dur, type, gain, slideTo) {
    if (!ensure()) return;
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  // Simple sun-soaked loop: a lazy bassline over soft pads, A minor pentatonic.
  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 65.41];
  const PAD = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 220, 261.63]];
  let bar = 0;
  function musicStep() {
    if (!musicOn || !ctx) return;
    const t = ctx.currentTime;
    const bass = BASS[bar % BASS.length];
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = bass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.6);
    if (bar % 4 === 0) {
      const chord = PAD[(bar / 4 | 0) % PAD.length];
      for (const f of chord) {
        const p = ctx.createOscillator(); p.type = 'sine'; p.frequency.value = f;
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0.12, t); pg.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
        p.connect(pg); pg.connect(musicGain); p.start(t); p.stop(t + 2);
      }
    }
    bar += 1;
  }
  return {
    unlock,
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    startMusic() {
      if (musicOn || !ensure()) return;
      musicOn = true; bar = 0;
      musicTimer = window.setInterval(musicStep, 300);
    },
    stopMusic() { musicOn = false; if (musicTimer) window.clearInterval(musicTimer); musicTimer = null; },
    shoot() { noiseBurst(0.09, 2400, 0.5); tone(160, 0.08, 'square', 0.25, 60); },
    punch() { noiseBurst(0.06, 500, 0.4); },
    crash(intensity) { noiseBurst(0.25, 900, 0.35 + 0.4 * Math.min(1, intensity)); tone(70, 0.2, 'sawtooth', 0.3, 40); },
    explosion() { noiseBurst(0.7, 500, 0.9); tone(50, 0.6, 'sine', 0.7, 28); },
    pickup() { tone(660, 0.09, 'sine', 0.3); window.setTimeout(() => tone(990, 0.12, 'sine', 0.3), 90); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => tone(f, 0.18, 'triangle', 0.35), i * 110)); },
    missionFail() { [330, 262, 196].forEach((f, i) => window.setTimeout(() => tone(f, 0.25, 'triangle', 0.3), i * 140)); },
    siren(on) { if (sirenGain) sirenGain.gain.value = on ? 0.05 : 0; },
    setSirenTone(high) { if (sirenOsc) sirenOsc.frequency.value = high ? 950 : 700; },
    engine(speed01, on) {
      if (!engineGain) return;
      engineGain.gain.value = on ? 0.03 + 0.06 * speed01 : 0;
      if (engineOsc) engineOsc.frequency.value = 55 + 140 * speed01;
    },
    horn() { tone(370, 0.35, 'square', 0.2); tone(466, 0.35, 'square', 0.15); },
  };
}
