// A tiny procedural soundtrack: soft pads, a few bells, footsteps and chimes.
// Everything is synthesized so the game stays a single self-contained folder.

const MUTE_KEY = 'tiny-messenger-muted-v1';

const CHORDS = [
  [130.81, 196.0, 246.94, 329.63], // Cmaj9
  [110.0, 164.81, 196.0, 246.94], // Am9
  [87.31, 130.81, 174.61, 261.63], // Fmaj7
  [98.0, 146.83, 196.0, 293.66], // G
];

const BELL_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.reverb = null;
    this.padGain = null;
    this.padVoices = [];
    this.started = false;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this.chordIndex = 0;
    this.chordTimer = null;
    this.bellTimer = null;
    this.noiseBuffer = null;
  }

  get isMuted() {
    return this.muted;
  }

  async start() {
    if (!this.ctx) this.build();
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Browsers can still refuse; the game works silently.
      }
    }
    this.started = true;
  }

  build() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.8, 2.4);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.5;
    this.reverb.connect(reverbGain);
    reverbGain.connect(this.master);

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.16;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 760;
    filter.Q.value = 0.4;
    this.padGain.connect(filter);
    filter.connect(this.master);
    filter.connect(this.reverb);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 240;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const chord = CHORDS[0];
    for (let i = 0; i < 4; i += 1) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = chord[i];
      osc.detune.value = (i % 2 ? 1 : -1) * 4;
      gain.gain.value = i === 0 ? 0.26 : 0.16;
      osc.connect(gain);
      gain.connect(this.padGain);
      osc.start();
      this.padVoices.push({ osc, gain });
    }

    this.noiseBuffer = this.makeNoiseBuffer(0.5);
    this.chordTimer = window.setInterval(() => this.nextChord(), 9000);
    this.scheduleBell();
  }

  nextChord() {
    if (!this.ctx) return;
    this.chordIndex = (this.chordIndex + 1) % CHORDS.length;
    const chord = CHORDS[this.chordIndex];
    const now = this.ctx.currentTime;
    this.padVoices.forEach((voice, index) => {
      voice.osc.frequency.cancelScheduledValues(now);
      voice.osc.frequency.setValueAtTime(voice.osc.frequency.value, now);
      voice.osc.frequency.linearRampToValueAtTime(chord[index], now + 3.2);
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(index === 0 ? 0.26 : 0.16, now + 1.6);
    });
  }

  scheduleBell() {
    const delay = 6500 + Math.random() * 9500;
    this.bellTimer = window.setTimeout(() => {
      this.bell();
      this.scheduleBell();
    }, delay);
  }

  bell() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + 0.05;
    const note = BELL_NOTES[Math.floor(Math.random() * BELL_NOTES.length)];
    for (const [frequency, level, offset] of [
      [note, 0.05, 0],
      [note * 2, 0.018, 0.02],
      [note * 2.997, 0.01, 0.03],
    ]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(level, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 2.8);
      osc.connect(gain);
      gain.connect(this.master);
      gain.connect(this.reverb);
      osc.start(now + offset);
      osc.stop(now + offset + 3);
    }
  }

  makeNoiseBuffer(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  makeImpulse(seconds, decay) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buffer;
  }

  tone(frequency, duration, { type = 'sine', volume = 0.08, delay = 0, reverb = false, glide = 0 } = {}) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, glide), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    if (reverb) gain.connect(this.reverb);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  step(water = false) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = water ? 'bandpass' : 'lowpass';
    filter.frequency.value = water ? 900 + Math.random() * 500 : 420 + Math.random() * 220;
    filter.Q.value = water ? 1.2 : 0.8;
    const gain = this.ctx.createGain();
    const volume = water ? 0.055 : 0.04;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (water ? 0.24 : 0.14));
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
    source.stop(now + 0.3);
    if (water) {
      this.tone(1500 + Math.random() * 800, 0.16, { type: 'sine', volume: 0.012, glide: 900 });
    }
  }

  click() {
    this.tone(920, 0.05, { type: 'triangle', volume: 0.022, glide: 640 });
  }

  emote(kind) {
    const base = { wave: 620, heart: 740, laugh: 860, note: 980, mail: 700, star: 1180 }[kind] || 760;
    this.tone(base, 0.18, { type: 'triangle', volume: 0.035, glide: base * 1.35 });
  }

  deliver() {
    [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => {
      this.tone(note, 0.7, { type: 'sine', volume: 0.045, delay: index * 0.09, reverb: true });
      this.tone(note * 2, 0.35, { type: 'triangle', volume: 0.01, delay: index * 0.09 + 0.01 });
    });
  }

  achievement() {
    [784, 987.77, 1174.66, 1567.98].forEach((note, index) => {
      this.tone(note, 0.9, { type: 'triangle', volume: 0.035, delay: index * 0.075, reverb: true });
    });
  }

  error() {
    this.tone(300, 0.23, { type: 'triangle', volume: 0.03, glide: 210 });
  }

  toggle() {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.55, now + 0.35);
    }
    return this.muted;
  }
}
