import type { MusicStyle, SceneMood } from './types';

function midiToFreq(midi: number): number { return 440 * Math.pow(2, (midi - 69) / 12); }

type Layer = { chords: number[][]; tempo: number; scale: number[] };

const STYLES: Record<MusicStyle, Layer> = {
  none: { chords: [], tempo: 0, scale: [0, 2, 4, 5, 7, 9, 11] },
  cinematic: { chords: [[0, 3, 7, 10], [-5, 0, 3, 7], [-3, 0, 4, 7], [-7, -3, 0, 3]], tempo: 0.5, scale: [0, 2, 3, 5, 7, 8, 10] },
  ambient: { chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-5, -1, 2, 5], [-2, 2, 5, 9]], tempo: 0.35, scale: [0, 2, 4, 5, 7, 9, 11] },
  uplifting: { chords: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 17], [-3, 0, 4, 7]], tempo: 0.6, scale: [0, 2, 4, 5, 7, 9, 11] },
  lofi: { chords: [[0, 3, 7, 10], [-3, 0, 4, 7], [-5, -1, 2, 5], [-2, 2, 5, 9]], tempo: 0.4, scale: [0, 2, 3, 5, 7, 9, 10] },
  dramatic: { chords: [[0, 3, 7], [1, 4, 8], [0, 3, 7], [-4, -1, 3]], tempo: 0.55, scale: [0, 2, 3, 5, 7, 8, 10] },
};

const MOOD_MOD: Record<SceneMood, { oct: number; tempoMul: number; gain: number }> = {
  neutral: { oct: 0, tempoMul: 1, gain: 1 }, calm: { oct: -5, tempoMul: 0.8, gain: 0.85 },
  dramatic: { oct: 0, tempoMul: 1.3, gain: 1.2 }, happy: { oct: 5, tempoMul: 1.1, gain: 1.1 },
  tense: { oct: -2, tempoMul: 0.7, gain: 1.15 }, mysterious: { oct: -3, tempoMul: 0.85, gain: 0.95 },
};

function addPianoNote(ctx: OfflineAudioContext, dest: AudioNode, freq: number, start: number, dur: number, peak: number): void {
  for (const detune of [-4, 4]) {
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq; osc.detune.value = detune;
    const gain = ctx.createGain();
    const attack = 0.008; const decay = 0.3; const sustain = peak * 0.35; const release = Math.min(dur, 1.5);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.001), start + attack + decay);
    gain.gain.setValueAtTime(Math.max(sustain, 0.001), start + Math.max(attack + decay, dur - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain); gain.connect(dest); osc.start(start); osc.stop(start + dur + 0.05);
  }
}

function addPadNote(ctx: OfflineAudioContext, dest: AudioNode, freq: number, start: number, dur: number, peak: number): void {
  const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1200; filter.Q.value = 0.7;
  const gain = ctx.createGain();
  const attack = Math.min(1.5, dur * 0.3); const release = Math.min(2.0, dur * 0.4);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + attack);
  gain.gain.setValueAtTime(peak, Math.max(start + attack, start + dur - release));
  gain.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(filter); filter.connect(gain); gain.connect(dest); osc.start(start); osc.stop(start + dur + 0.1);
}

function addBassNote(ctx: OfflineAudioContext, dest: AudioNode, freq: number, start: number, dur: number, peak: number): void {
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
  const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = freq * 0.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain); osc2.connect(gain); gain.connect(dest); osc.start(start); osc.stop(start + dur + 0.05); osc2.start(start); osc2.stop(start + dur + 0.05);
}

function addKick(ctx: OfflineAudioContext, dest: AudioNode, start: number, peak: number): void {
  const osc = ctx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(120, start); osc.frequency.exponentialRampToValueAtTime(35, start + 0.12);
  const gain = ctx.createGain(); gain.gain.setValueAtTime(peak, start); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
  osc.connect(gain); gain.connect(dest); osc.start(start); osc.stop(start + 0.25);
}

function addHat(ctx: OfflineAudioContext, dest: AudioNode, start: number, peak: number): void {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 7000;
  const gain = ctx.createGain(); gain.gain.setValueAtTime(peak, start); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.05);
  src.connect(filter); filter.connect(gain); gain.connect(dest); src.start(start); src.stop(start + 0.1);
}

function makeReverb(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate; const length = Math.floor(rate * duration);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

export async function generateMusic(style: MusicStyle, totalDuration: number, volume: number, sampleRate: number, sceneDurations?: number[], moods?: SceneMood[], titleOffset?: number): Promise<AudioBuffer> {
  if (style === 'none' || volume <= 0) { const ctx = new OfflineAudioContext(1, 1, sampleRate); return ctx.createBuffer(1, 1, sampleRate); }
  const config = STYLES[style];
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  const ctx = new OfflineAudioContext(2, totalSamples, sampleRate);
  const master = ctx.createGain();
  master.gain.value = Math.min(0.95, Math.max(0.6, volume * 1.3));
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14; compressor.knee.value = 6; compressor.ratio.value = 4; compressor.attack.value = 0.005; compressor.release.value = 0.1;
  compressor.connect(ctx.destination); master.connect(compressor);
  const convolver = ctx.createConvolver(); convolver.buffer = makeReverb(ctx, 2.5, 2.5);
  const reverbGain = ctx.createGain(); reverbGain.gain.value = 0.35;
  convolver.connect(reverbGain); reverbGain.connect(master);
  const dryBus = ctx.createGain(); dryBus.gain.value = 0.7; dryBus.connect(master);
  const wetBus = ctx.createGain(); wetBus.gain.value = 0.4; wetBus.connect(convolver);
  const getMoodAt = (t: number): SceneMood => {
    if (!moods || !sceneDurations) return 'neutral';
    let start = titleOffset ?? 0;
    for (let i = 0; i < sceneDurations.length; i++) { if (t >= start && t < start + sceneDurations[i]) return moods[i] ?? 'neutral'; start += sceneDurations[i]; }
    return 'neutral';
  };
  const chordDur = (1 / config.tempo) * 8;
  let chordIdx = 0;
  for (let t = 0; t < totalDuration; t += chordDur) {
    const mood = getMoodAt(t + chordDur / 2); const mod = MOOD_MOD[mood];
    const chord = config.chords[chordIdx % config.chords.length]; chordIdx++;
    const dur = Math.min(chordDur * mod.tempoMul, totalDuration - t);
    for (const note of chord) { const freq = midiToFreq(note + 48 + mod.oct); addPadNote(ctx, dryBus, freq, t, dur, 0.08 * mod.gain); addPadNote(ctx, wetBus, freq, t, dur, 0.06 * mod.gain); }
  }
  if (style !== 'dramatic') {
    const noteDur = (1 / config.tempo) * 2; let idx = 0;
    for (let t = 0.5; t < totalDuration; t += noteDur) {
      const mood = getMoodAt(t); const mod = MOOD_MOD[mood]; const scale = config.scale;
      const degree = scale[idx % scale.length]; const oct = 60 + (idx % 14 < 7 ? 0 : 12) + mod.oct;
      const freq = midiToFreq(degree + oct); idx++;
      addPianoNote(ctx, dryBus, freq, t, noteDur * 0.8, 0.12 * mod.gain);
      addPianoNote(ctx, wetBus, freq, t, noteDur * 0.8, 0.04 * mod.gain);
    }
  }
  const bassDur = (1 / config.tempo) * 4; let bassIdx = 0;
  for (let t = 0; t < totalDuration; t += bassDur) {
    const mood = getMoodAt(t); const mod = MOOD_MOD[mood];
    const chord = config.chords[bassIdx % config.chords.length]; bassIdx++;
    const root = chord[0]; const freq = midiToFreq(root + 36 + mod.oct);
    addBassNote(ctx, dryBus, freq, t, bassDur * 0.9, 0.18 * mod.gain);
  }
  if (style === 'lofi' || style === 'dramatic') {
    const beat = style === 'lofi' ? 0.5 : 0.45; let beatIdx = 0;
    for (let t = 0.5; t < totalDuration; t += beat) {
      const mood = getMoodAt(t); const mod = MOOD_MOD[mood];
      if (beatIdx % 2 === 0) addKick(ctx, dryBus, t, 0.3 * mod.gain);
      addHat(ctx, dryBus, t + beat * 0.5, 0.06 * mod.gain); beatIdx++;
    }
  }
  if (style === 'uplifting') {
    const beat = 0.3; let beatIdx = 0;
    for (let t = 1.0; t < totalDuration; t += beat) {
      const mood = getMoodAt(t); const mod = MOOD_MOD[mood];
      const chord = config.chords[Math.floor(beatIdx / 4) % config.chords.length];
      const note = chord[beatIdx % chord.length]; const freq = midiToFreq(note + 72 + mod.oct);
      addPianoNote(ctx, dryBus, freq, t, beat * 0.7, 0.08 * mod.gain);
      addHat(ctx, dryBus, t, 0.04 * mod.gain); beatIdx++;
    }
  }
  return await ctx.startRendering();
}

let previewCtx: AudioContext | null = null;
let previewMaster: GainNode | null = null;
let previewNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let previewTimer: number | null = null;

export async function playPreviewMusic(style: MusicStyle, volume: number): Promise<void> {
  stopPreviewMusic();
  if (style === 'none' || volume <= 0) return;
  const config = STYLES[style]; if (!config || config.chords.length === 0) return;
  previewCtx = new AudioContext();
  previewMaster = previewCtx.createGain();
  previewMaster.gain.value = Math.min(0.7, volume * 0.85);
  previewMaster.connect(previewCtx.destination);
  const convolver = previewCtx.createConvolver(); convolver.buffer = makeReverb(previewCtx, 2.0, 2.5);
  const reverbGain = previewCtx.createGain(); reverbGain.gain.value = 0.3;
  convolver.connect(reverbGain); reverbGain.connect(previewMaster);
  let chordIdx = 0;
  const playChord = () => {
    if (!previewCtx || !previewMaster) return;
    const chord = config.chords[chordIdx % config.chords.length]; chordIdx++;
    const chordDur = (1 / config.tempo) * 8; const now = previewCtx.currentTime;
    for (const note of chord) {
      const freq = midiToFreq(note + 48);
      const osc = previewCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = freq;
      const filter = previewCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1200;
      const gain = previewCtx.createGain();
      const attack = Math.min(1.5, chordDur * 0.3); const release = Math.min(2.0, chordDur * 0.4);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + attack);
      gain.gain.setValueAtTime(0.1, now + Math.max(attack, chordDur - release));
      gain.gain.linearRampToValueAtTime(0, now + chordDur);
      osc.connect(filter); filter.connect(gain); gain.connect(previewMaster); gain.connect(convolver);
      osc.start(now); osc.stop(now + chordDur + 0.1);
      previewNodes.push({ osc, gain });
      const noteDur = (1 / config.tempo) * 2;
      for (let j = 0; j < 4; j++) {
        const pOsc = previewCtx.createOscillator(); pOsc.type = 'triangle'; pOsc.frequency.value = midiToFreq(note + 60 + (j % 2) * 12);
        const pGain = previewCtx.createGain(); const pStart = now + j * noteDur;
        pGain.gain.setValueAtTime(0, pStart);
        pGain.gain.linearRampToValueAtTime(0.08, pStart + 0.008);
        pGain.gain.exponentialRampToValueAtTime(0.001, pStart + noteDur * 0.8);
        pOsc.connect(pGain); pGain.connect(previewMaster); pGain.connect(convolver);
        pOsc.start(pStart); pOsc.stop(pStart + noteDur + 0.05);
        previewNodes.push({ osc: pOsc, gain: pGain });
      }
    }
    const bassFreq = midiToFreq(chord[0] + 36);
    const bOsc = previewCtx.createOscillator(); bOsc.type = 'sine'; bOsc.frequency.value = bassFreq;
    const bGain = previewCtx.createGain();
    bGain.gain.setValueAtTime(0.12, now); bGain.gain.exponentialRampToValueAtTime(0.001, now + chordDur * 0.9);
    bOsc.connect(bGain); bGain.connect(previewMaster); bOsc.start(now); bOsc.stop(now + chordDur + 0.05);
    previewNodes.push({ osc: bOsc, gain: bGain });
    previewTimer = window.setTimeout(playChord, chordDur * 1000);
  };
  playChord();
}

export function stopPreviewMusic(): void {
  if (previewTimer) { window.clearTimeout(previewTimer); previewTimer = null; }
  for (const { osc, gain } of previewNodes) { try { osc.stop(); } catch { /* noop */ } try { gain.disconnect(); } catch { /* noop */ } }
  previewNodes = [];
  if (previewMaster) { try { previewMaster.disconnect(); } catch { /* noop */ } previewMaster = null; }
  if (previewCtx) { try { previewCtx.close(); } catch { /* noop */ } previewCtx = null; }
}
