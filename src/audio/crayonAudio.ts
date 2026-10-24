// Studio Sample-Based & Physical PCM Audio Engine for Volleyball & Gun Fight!
// Loads and plays 44.1kHz 16-bit PCM WAV SFX from /sfx/*.wav with instant in-memory PCM sample buffers
// for zero-latency shooter firearms, human hurt/death vocalizations, and realistic leather volleyball impacts.

import { createMenuMusic } from './menuMusic';
import type { AudioScene } from './audioScene';

type SfxSampleKey =
  | 'assault_rifle'
  | 'shotgun_blast'
  | 'bullet_hit'
  | 'male_hurt'
  | 'female_hurt'
  | 'player_hurt'
  | 'player_death'
  | 'female_death'
  | 'kaun_hai_re'
  | 'birds_forest_nature'
  | 'ball_bump'
  | 'ball_spike'
  | 'ball_bounce';

const FEMALE_CHARACTER_IDS = new Set([
  'strawberry_kid', // BERRY
  'purple_shades',  // MAYA
  'pink_visor',     // MOCHI
  'astro_bean',     // NOVA
]);

class CrayonAudioEngine {
  private ctx: AudioContext | null = null;
  private sfxInput: BiquadFilterNode | null = null;
  private sfxOutput: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private sampleBuffers: Map<SfxSampleKey, AudioBuffer> = new Map();
  private rawArrayBuffers: Map<SfxSampleKey, ArrayBuffer> = new Map();
  private fetching = new Set<SfxSampleKey>();
  private decoding = new Set<SfxSampleKey>();
  private wavFetchStarted: boolean = false;
  public muted: boolean = false;
  public sfxVolume: number = 0.8;
  public musicVolume: number = 0.3;
  private menuMusic: ReturnType<typeof createMenuMusic> | null = null;
  private musicWanted = false;
  private lastFootstepTime: number = 0;
  private lastHurtTime: number = 0;
  private lastEnemyHurtTime: number = 0;
  private lastDeathSoundTime: number = 0;
  private lastKaunHaiReTime: number = 0;
  private kaunHaiRePlayedCount: number = 0;
  private kaunHaiReMaxPerMatch: number = 2;
  private playerDeathsInMatch: number = 0;
  private lastAiGunTime: number = 0;
  private lastFlameTime: number = 0;
  private lastHitMarkerTime: number = 0;
  private activeHurtSources: Set<AudioBufferSourceNode> = new Set();

  // The original forest recording is the only background loop during matches.
  private natureAmbienceWanted: boolean = false;
  private natureSourceNode: AudioBufferSourceNode | null = null;
  private natureGainNode: GainNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Pre-fetch raw WAV bytes immediately on app startup so real studio recordings are ready on first click
      this.prefetchRawWavBytes();
      // Unlock and decode in the menu, before the first combat action.
      const unlock = () => { this.getContext(); };
      window.addEventListener('pointerdown', unlock, { once: true, passive: true });
      window.addEventListener('keydown', unlock, { once: true });
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.syncVolleyballNatureAmbienceVolume());
    }
  }

  /**
   * Resets per-match voice counters at the start of a Gun Fight match so "Kaun hai re?!" plays 1 to 3 times max!
   */
  public resetGunMatchVoiceState() {
    this.kaunHaiRePlayedCount = 0;
    this.kaunHaiReMaxPerMatch = 1 + Math.floor(Math.random() * 3); // 1 to 3 times max in the whole match
    this.playerDeathsInMatch = 0;
    this.lastKaunHaiReTime = 0;
  }

  public isFemaleCharacter(charId?: string): boolean {
    if (!charId) return false;
    return FEMALE_CHARACTER_IDS.has(charId);
  }

  private prefetchRawWavBytes() {
    const keys: SfxSampleKey[] = [
      'assault_rifle',
      'shotgun_blast',
      'bullet_hit',
      'male_hurt',
      'female_hurt',
      'player_hurt',
      'player_death',
      'female_death',
      'kaun_hai_re',
      'birds_forest_nature',
      'ball_bump',
      'ball_spike',
      'ball_bounce',
    ];
    keys.forEach((key) => {
      if (this.fetching.has(key)) return;
      this.fetching.add(key);
      fetch(`/sfx/${key}.wav`)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
        .then((buf) => {
          this.rawArrayBuffers.set(key, buf);
          if (this.ctx) {
            this.decodeSingleWav(this.ctx, key, buf);
          }
        })
        .catch(() => { this.fetching.delete(key); });
    });
  }

  private decodeSingleWav(ctx: AudioContext, key: SfxSampleKey, rawBuf: ArrayBuffer) {
    if (this.decoding.has(key)) return;
    this.decoding.add(key);
    ctx
      .decodeAudioData(rawBuf.slice(0))
      .then((decoded) => {
        this.sampleBuffers.set(key, decoded);
        if (key === 'birds_forest_nature' && this.natureAmbienceWanted && this.ctx) {
          this.syncNatureAmbience();
        }
      })
      .catch(() => { this.decoding.delete(key); });
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx({ latencyHint: 'interactive' });
        this.initSfxMix(this.ctx);
        this.initInstantPcmSamples(this.ctx);
        this.preloadWavFiles(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.syncVolleyballNatureAmbienceVolume();
    return this.ctx;
  }

  public setAudioScene(scene: AudioScene) {
    this.musicWanted = scene === 'menu';
    this.natureAmbienceWanted = scene === 'game';
    this.syncVolleyballNatureAmbienceVolume();
  }

  public syncBackgroundMusic() {
    if (!this.ctx) return; // Starts only after the existing user-gesture audio unlock.
    this.menuMusic ??= createMenuMusic(this.ctx);
    this.menuMusic.set(this.musicWanted && !this.muted && !(typeof document !== 'undefined' && document.hidden), this.musicVolume);
  }

  private initSfxMix(ctx: AudioContext) {
    const rumble = ctx.createBiquadFilter();
    rumble.type = 'highpass'; rumble.frequency.value = 35; rumble.Q.value = .5;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking'; presence.frequency.value = 2800; presence.Q.value = .7; presence.gain.value = -4.5;
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass'; air.frequency.value = 9000; air.Q.value = .5;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16; compressor.knee.value = 18; compressor.ratio.value = 4;
    compressor.attack.value = .004; compressor.release.value = .12;
    const output = ctx.createGain();
    output.gain.value = this.muted ? 0 : this.sfxVolume * .78;
    rumble.connect(presence); presence.connect(air); air.connect(compressor);
    compressor.connect(output); output.connect(ctx.destination);
    this.sfxInput = rumble; this.sfxOutput = output;
  }

  /**
   * Decodes all pre-fetched or remaining 44.1kHz WAV files from /sfx/*.wav into Web Audio API AudioBuffers
   */
  private preloadWavFiles(ctx: AudioContext) {
    if (this.wavFetchStarted) return;
    this.wavFetchStarted = true;
    const keys: SfxSampleKey[] = [
      'assault_rifle',
      'shotgun_blast',
      'bullet_hit',
      'male_hurt',
      'female_hurt',
      'player_hurt',
      'player_death',
      'female_death',
      'kaun_hai_re',
      'birds_forest_nature',
      'ball_bump',
      'ball_spike',
      'ball_bounce',
    ];
    keys.forEach((key) => {
      const cachedRaw = this.rawArrayBuffers.get(key);
      if (cachedRaw) {
        this.decodeSingleWav(ctx, key, cachedRaw);
      } else if (!this.fetching.has(key)) {
        this.fetching.add(key);
        fetch(`/sfx/${key}.wav`)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
          .then((buf) => {
            this.rawArrayBuffers.set(key, buf);
            this.decodeSingleWav(ctx, key, buf);
          })
          .catch(() => { this.fetching.delete(key); });
      }
    });
  }

  /**
   * Biquad filter helper for building instant non-vocal impact buffers before async WAV decode finishes
   */
  private filterPcm(
    input: Float32Array,
    sr: number,
    type: 'bandpass' | 'lowpass',
    freq: number,
    q: number
  ): Float32Array {
    const out = new Float32Array(input.length);
    const w0 = (2 * Math.PI * freq) / sr;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * q);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    const a0 = 1 + alpha;
    const a1 = (-2 * cosw0) / a0;
    const a2 = (1 - alpha) / a0;
    if (type === 'bandpass') {
      b0 = alpha / a0;
      b1 = 0;
      b2 = -alpha / a0;
    } else {
      b0 = (1 - cosw0) / 2 / a0;
      b1 = (1 - cosw0) / a0;
      b2 = (1 - cosw0) / 2 / a0;
    }
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0;
    for (let i = 0; i < input.length; i++) {
      const x0 = input[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      out[i] = y0;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }
    return out;
  }

  /**
   * Builds only non-vocal physical impact fallbacks (gunshots, bullet hit, ball hits) for the first 10ms before WAV decode.
   * Hurt and death vocalizations NEVER use synthetic oscillators — they exclusively play the real recorded WAV files!
   */
  private initInstantPcmSamples(ctx: AudioContext) {
    const sr = ctx.sampleRate;

    // A cold or failed asset load still gives immediate firing feedback.
    for (const key of ['assault_rifle', 'shotgun_blast'] as const) {
      const buffer = ctx.createBuffer(1, Math.floor(sr * .18), sr);
      const out = buffer.getChannelData(0);
      const raw = new Float32Array(out.length);
      for (let i = 0; i < raw.length; i++) raw[i] = Math.random() * 2 - 1;
      const body = this.filterPcm(raw, sr, 'lowpass', 3200, .5);
      for (let i = 0; i < out.length; i++) {
        const t = i / sr;
        out[i] = (body[i] * .5 + Math.sin(t * 2 * Math.PI * 95) * .35)
          * Math.min(1, t / .002) * Math.exp(-t * (key === 'shotgun_blast' ? 28 : 42));
      }
      this.sampleBuffers.set(key, buffer);
    }

    // 1. Crisp Bullet Impact Hit Marker
    {
      const N = Math.floor(sr * 0.08);
      const buf = ctx.createBuffer(1, N, sr);
      const raw = new Float32Array(N);
      for (let i = 0; i < N; i++) raw[i] = Math.random() * 2 - 1;
      const fleshSnap = this.filterPcm(raw, sr, 'bandpass', 1650, 1.5);
      const bodyThud = this.filterPcm(raw, sr, 'lowpass', 260, 0.9);
      const out = buf.getChannelData(0);
      for (let i = 0; i < N; i++) {
        const t = i / sr;
        const env = Math.min(1, t / 0.001) * Math.exp(-t * 68);
        const punch =
          Math.sin(2 * Math.PI * (90 + 130 * Math.exp(-t * 110)) * t) *
          Math.exp(-t * 60) *
          0.6;
        out[i] =
          Math.tanh((punch + fleshSnap[i] * env * 0.7 + bodyThud[i] * env * 0.8) * 1.4) *
          0.8;
      }
      if (!this.sampleBuffers.has('bullet_hit')) {
        this.sampleBuffers.set('bullet_hit', buf);
      }
    }

    // 2. Warm Volleyball Bump / Pass PCM Buffer
    {
      const N = Math.floor(sr * 0.15);
      const buf = ctx.createBuffer(1, N, sr);
      const raw = new Float32Array(N);
      for (let i = 0; i < N; i++) raw[i] = Math.random() * 2 - 1;
      const warmLeather = this.filterPcm(raw, sr, 'bandpass', 820, 2.0);
      const out = buf.getChannelData(0);
      let pFund = 0,
        pCavity = 0,
        pSub = 0;
      for (let i = 0; i < N; i++) {
        const t = i / sr;
        const attack = Math.min(1, t / 0.002);
        const fFund = 110 + 90 * Math.exp(-t * 62);
        const fCavity = 270 + 52 * Math.exp(-t * 75);
        const fSub = 68 + 42 * Math.exp(-t * 50);
        pFund += (2 * Math.PI * fFund) / sr;
        pCavity += (2 * Math.PI * fCavity) / sr;
        pSub += (2 * Math.PI * fSub) / sr;
        const body = Math.sin(pFund) * Math.exp(-t * 34) * 0.58;
        const cavity = Math.sin(pCavity) * Math.exp(-t * 52) * 0.25;
        const sub = Math.sin(pSub) * Math.exp(-t * 42) * 0.32;
        const touch = warmLeather[i] * Math.exp(-t * 110) * 0.2;
        out[i] = Math.tanh(attack * (body + cavity + sub + touch) * 1.25) * 0.8;
      }
      if (!this.sampleBuffers.has('ball_bump')) {
        this.sampleBuffers.set('ball_bump', buf);
      }
    }

    // 3. Volleyball Spike PCM Buffer
    {
      const N = Math.floor(sr * 0.2);
      const buf = ctx.createBuffer(1, N, sr);
      const raw = new Float32Array(N);
      for (let i = 0; i < N; i++) raw[i] = Math.random() * 2 - 1;
      const palmSnap = this.filterPcm(raw, sr, 'bandpass', 1120, 1.8);
      const out = buf.getChannelData(0);
      let pSub = 0,
        pBody = 0;
      for (let i = 0; i < N; i++) {
        const t = i / sr;
        const attack = Math.min(1, t / 0.002);
        const fSub = 66 + 115 * Math.exp(-t * 52);
        const fBody = 130 + 110 * Math.exp(-t * 60);
        pSub += (2 * Math.PI * fSub) / sr;
        pBody += (2 * Math.PI * fBody) / sr;
        const subBoom = Math.sin(pSub) * Math.exp(-t * 28) * 0.55;
        const midPunch = Math.sin(pBody) * Math.exp(-t * 36) * 0.44;
        const snap = palmSnap[i] * Math.exp(-t * 90) * 0.3;
        out[i] = Math.tanh(attack * (subBoom + midPunch + snap) * 1.3) * 0.82;
      }
      if (!this.sampleBuffers.has('ball_spike')) {
        this.sampleBuffers.set('ball_spike', buf);
      }
    }

    // 4. Court / Sand Bounce PCM Buffer
    {
      const N = Math.floor(sr * 0.14);
      const buf = ctx.createBuffer(1, N, sr);
      const raw = new Float32Array(N);
      for (let i = 0; i < N; i++) raw[i] = Math.random() * 2 - 1;
      const softSand = this.filterPcm(raw, sr, 'lowpass', 540, 0.9);
      const out = buf.getChannelData(0);
      let pThud = 0;
      for (let i = 0; i < N; i++) {
        const t = i / sr;
        const attack = Math.min(1, t / 0.0025);
        const fThud = 60 + 80 * Math.exp(-t * 52);
        pThud += (2 * Math.PI * fThud) / sr;
        const thud = Math.sin(pThud) * Math.exp(-t * 34) * 0.58;
        const sand = softSand[i] * Math.exp(-t * 65) * 0.2;
        out[i] = Math.tanh(attack * (thud + sand) * 1.25) * 0.78;
      }
      if (!this.sampleBuffers.has('ball_bounce')) {
        this.sampleBuffers.set('ball_bounce', buf);
      }
    }
  }

  /**
   * Applies sliders/mute to the current scene and to already-playing effects.
   */
  public syncVolleyballNatureAmbienceVolume() {
    this.syncBackgroundMusic();
    this.syncNatureAmbience();
    if (this.ctx && this.sfxOutput) {
      this.sfxOutput.gain.setTargetAtTime(this.muted ? 0 : Math.max(0, Math.min(1, this.sfxVolume)) * .78, this.ctx.currentTime, .025);
    }
  }

  private natureVolume() {
    // Default 30% slider restores the original 5%; higher settings never amplify it.
    return .05 * Math.min(1, Math.max(0, this.musicVolume / .3));
  }

  private syncNatureAmbience() {
    if (this.muted || !this.natureAmbienceWanted || this.musicVolume <= 0 || (typeof document !== 'undefined' && document.hidden)) {
      this.stopNatureLoopInternal();
      return;
    }
    if (!this.ctx) return;
    this.startNatureLoopInternal(this.ctx);
    if (this.natureGainNode && this.ctx) {
      this.natureGainNode.gain.setTargetAtTime(
        this.natureVolume(),
        this.ctx.currentTime,
        0.15
      );
    }
  }

  private startNatureLoopInternal(ctx: AudioContext) {
    if (this.natureSourceNode) return;
    const buffer = this.sampleBuffers.get('birds_forest_nature');
    if (!buffer) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setTargetAtTime(this.natureVolume(), ctx.currentTime, 0.15);

    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime);

    this.natureSourceNode = src;
    this.natureGainNode = gain;
  }

  private stopNatureLoopInternal() {
    if (this.natureSourceNode) {
      try {
        this.natureSourceNode.stop();
        this.natureSourceNode.disconnect();
      } catch {
        // ignore if already stopped
      }
      this.natureSourceNode = null;
    }
    if (this.natureGainNode) {
      try {
        this.natureGainNode.disconnect();
      } catch {
        // ignore
      }
      this.natureGainNode = null;
    }
  }

  /**
   * Plays a preloaded real WAV sample buffer
   */
  private playSample(
    key: SfxSampleKey,
    volume: number = 0.5,
    playbackRate: number = 1.0,
    trackAsHurt: boolean = false
  ): boolean {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= 0.01) return false;
    const buffer = this.sampleBuffers.get(key);
    if (!buffer) return false;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(playbackRate, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.scaleGain(volume), ctx.currentTime);

    src.connect(gain);
    gain.connect(this.sfxInput!);
    if (trackAsHurt) {
      this.activeHurtSources.add(src);
    }
    src.onended = () => {
      this.activeHurtSources.delete(src);
      src.disconnect();
      gain.disconnect();
    };
    src.start(ctx.currentTime);
    return true;
  }

  private stopActiveHurtSounds() {
    this.activeHurtSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeHurtSources.clear();
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const bufferSize = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private scaleGain(base: number): number {
    // Effects volume is applied once, after compression, including live voices.
    return Math.max(0.0001, base);
  }

  /**
   * VOLLEYBALL: Warm Leather Volleyball Bump / Pass
   */
  public playBallPop(_rallyCount: number = 1, isSweetSpot: boolean = false) {
    if (isSweetSpot) {
      this.playRainbowSmash();
      return;
    }
    const rate = 0.96 + Math.random() * 0.08;
    this.playSample('ball_bump', 0.48, rate);
  }

  /**
   * VOLLEYBALL: Overhead Serve Hit
   */
  public playServeHit() {
    const rate = 0.94 + Math.random() * 0.07;
    this.playSample('ball_spike', 0.56, rate);
  }

  /**
   * VOLLEYBALL: Finger-Set Pop
   */
  public playSetLift() {
    const rate = 1.14 + Math.random() * 0.07;
    this.playSample('ball_bump', 0.42, rate);
  }

  /**
   * VOLLEYBALL & DODGEBALL: Court Floor Bounce
   */
  public playBallFloorBounce(intensity: number = 1.0) {
    const vol = Math.min(1, Math.max(0.35, intensity));
    const rate = 0.95 + Math.random() * 0.08;
    this.playSample('ball_bounce', 0.48 * vol, rate);
  }

  public playBallBounce(intensity: number = 1.0) {
    this.playBallFloorBounce(intensity);
  }

  /**
   * VOLLEYBALL: Power Spike
   */
  public playRainbowSmash() {
    const rate = 0.97 + Math.random() * 0.06;
    this.playSample('ball_spike', 0.65, rate);
  }

  public playSpikeHit(isSuper: boolean = false, _isSweet: boolean = false) {
    const rate = isSuper ? 0.92 : 0.98 + Math.random() * 0.06;
    this.playSample('ball_spike', isSuper ? 0.72 : 0.58, rate);
  }

  /**
   * DODGEBALL: High-Velocity Throw Whoosh & Leather Snap
   */
  public playDodgeballThrow(isSuper: boolean = false) {
    const rate = isSuper ? 0.9 : 1.02 + Math.random() * 0.06;
    this.playSample('ball_spike', isSuper ? 0.72 : 0.56, rate);
  }

  /**
   * DODGEBALL: Heavy Rubber Ball Body Smack + Guaranteed Hurt/KO Voice
   */
  public playDodgeballHit(
    victimCharId?: string,
    isSuper: boolean = false,
    isKo: boolean = false
  ) {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= 0.01) return;

    // 1. Punchy ball smack + flesh hit marker
    this.playSample('bullet_hit', isSuper ? 0.32 : 0.24, 0.94 + Math.random() * 0.08);
    this.playSample('ball_spike', isSuper ? 0.48 : 0.36, 0.88 + Math.random() * 0.08);

    // 2. Guaranteed Hurt or KO Voice so every Dodgeball hit feels impactful!
    const isFemale = this.isFemaleCharacter(victimCharId);
    if (isKo) {
      this.stopActiveHurtSounds();
      this.playSample(
        isFemale ? 'female_death' : 'player_death',
        0.58,
        0.98 + Math.random() * 0.04
      );
    } else {
      const sampleKey: SfxSampleKey = isFemale ? 'female_hurt' : 'male_hurt';
      this.playSample(sampleKey, 0.4, 0.98 + Math.random() * 0.05, true);
    }
  }

  /**
   * DODGEBALL: Crisp Mid-Air Catch Pop & Reflex Chime
   */
  public playDodgeballCatch() {
    this.playSample('ball_bump', 0.48, 1.12);
    this.playSoftAccent([659.25, 987.77], .085, .16);
  }

  /**
   * BOTH GAMES: Soft Jump Thud (No high-pitched "souun" sine sweep!)
   */
  public playJump() {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.055);

    gain.gain.setValueAtTime(.0001, now);
    gain.gain.linearRampToValueAtTime(this.scaleGain(0.14), now + .004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxInput!);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playJumpBoing() {
    this.playJump();
  }

  /**
   * BOTH GAMES: Subtle Soft Footstep Tap (Rate-limited so it never spams)
   */
  public playFootstep() {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= 0.01) return;

    const now = ctx.currentTime;
    if (now - this.lastFootstepTime < 0.3) return;
    this.lastFootstepTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const pitch = 95 + Math.random() * 18;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.038);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.linearRampToValueAtTime(this.scaleGain(0.09), now + .004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
    osc.connect(gain);
    gain.connect(this.sfxInput!);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(now);
    osc.stop(now + 0.045);
  }

  /**
   * GUN FIGHT: Subtle Jump Pad Thump
   */
  public playSpringPadBoing() {
    this.playJump();
  }

  /**
   * GUN FIGHT: Medkit Health Pickup Chime (+HP)
   */
  public playMedkitPickup() {
    this.playSoftAccent([392, 493.88], .09, .16);
  }

  /**
   * BOTH GAMES: Dash / Dive Impact
   */
  public playDive() {
    this.playSample('ball_bounce', 0.22, 1.15);
    this.playSoftAccent([110, 73.42], .055, .09);
  }

  /**
   * VOLLEYBALL: Elastic Net-Cord Thump
   */
  public playNetTouch() {
    this.playSample('ball_bounce', 0.18, 0.85);
    this.playSoftAccent([146.83, 220], .075, .19);
  }

  private playSoftAccent(notes: number[], volume: number, duration: number) {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= .01) return;
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + index * .035;
      osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.linearRampToValueAtTime(this.scaleGain(volume), start + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      osc.connect(gain); gain.connect(this.sfxInput!);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      osc.start(start); osc.stop(start + duration + .01);
    });
  }

  public playPointScored(playerWonPoint: boolean) {
    this.playSoftAccent(playerWonPoint ? [392, 493.88, 587.33] : [329.63, 293.66, 261.63], .08, .2);
  }

  public playStarCollect() {
    this.playMedkitPickup();
  }

  public playButtonClick() {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= 0.01) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.03);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.linearRampToValueAtTime(this.scaleGain(0.09), now + .004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
    osc.connect(gain);
    gain.connect(this.sfxInput!);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    osc.start(now);
    osc.stop(now + 0.042);
  }

  public playMenuClick() {
    this.playButtonClick();
  }

  public playScoreCheer() {
    this.playPointScored(true);
  }

  /**
   * VOLLEYBALL: Referee Whistle on Serve
   */
  public playServeWhistle() {
    this.playSoftAccent([784], .055, .12);
  }

  public playSpikeBoom() {
    this.playRainbowSmash();
  }

  /**
   * GUN FIGHT: Real Studio Recorded Firearm Gun Shot (/sfx/assault_rifle.wav — lowered so it's comfortable and never masks voices!)
   */
  public playGunShot(isPlayer: boolean = true) {
    const ctx = this.getContext();
    if (!ctx) return;
    if (!isPlayer) {
      if (ctx.currentTime - this.lastAiGunTime < 0.11) return;
      this.lastAiGunTime = ctx.currentTime;
    }
    const volScale = isPlayer ? 0.24 : 0.075;
    const rate = 0.96 + Math.random() * 0.07;
    this.playSample('assault_rifle', volScale, rate);
  }

  /**
   * GUN FIGHT: Real Studio Recorded Pump Shotgun Blast (/sfx/shotgun_blast.wav — lowered so it's comfortable!)
   */
  public playShotgunBlast(isPlayer: boolean = true) {
    const ctx = this.getContext();
    if (!ctx) return;
    if (!isPlayer) {
      if (ctx.currentTime - this.lastAiGunTime < 0.14) return;
      this.lastAiGunTime = ctx.currentTime;
    }
    const volScale = isPlayer ? 0.28 : 0.095;
    const rate = 0.96 + Math.random() * 0.06;
    this.playSample('shotgun_blast', volScale, rate);
  }

  /**
   * GUN FIGHT: Clean Non-Sweeping Flamethrower Air Burst
   */
  public playFlamethrowerWhoosh(isPlayer: boolean = true) {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= 0.01) return;

    const now = ctx.currentTime;
    if (now - this.lastFlameTime < 0.12) return;
    this.lastFlameTime = now;

    const volScale = isPlayer ? 0.1 : 0.04;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.Q.setValueAtTime(0.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.linearRampToValueAtTime(this.scaleGain(volScale), now + .004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    noiseSrc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxInput!);
    noiseSrc.onended = () => { noiseSrc.disconnect(); filter.disconnect(); gain.disconnect(); };
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.1);
  }

  /**
   * GUN FIGHT: Tactical Weapon Crate Pickup
   */
  public playWeaponPickup() {
    this.playMedkitPickup();
  }

  /**
   * GUN FIGHT: Crisp Bullet Impact Hit Marker (/sfx/bullet_hit.wav)
   */
  public playHitMarker() {
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.currentTime - this.lastHitMarkerTime < 0.065) return;
    this.lastHitMarkerTime = ctx.currentTime;
    const rate = 0.96 + Math.random() * 0.08;
    this.playSample('bullet_hit', 0.26, rate);
  }

  /**
   * GUN FIGHT: Occasional Human Hurt Vocalization (Not on every hit — 3.5s cooldown & 32% chance!)
   */
  public playPlayerHurt(charId?: string) {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= 0.01) return;

    const now = ctx.currentTime;
    if (now - this.lastHurtTime < 3.5) return;
    if (Math.random() > 0.32) return;
    this.lastHurtTime = now;

    const sampleKey: SfxSampleKey = this.isFemaleCharacter(charId)
      ? 'female_hurt'
      : 'male_hurt';
    const rate = 0.98 + Math.random() * 0.04;
    this.playSample(sampleKey, 0.4, rate, true);
  }

  /**
   * GUN FIGHT: Occasional Enemy Hurt Vocalization (Not on every hit — 4.2s cooldown & 28% chance!)
   */
  public playEnemyHurt(charId?: string) {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= 0.01) return;

    const now = ctx.currentTime;
    if (now - this.lastEnemyHurtTime < 4.2) return;
    if (Math.random() > 0.28) return;
    this.lastEnemyHurtTime = now;

    const sampleKey: SfxSampleKey = this.isFemaleCharacter(charId)
      ? 'female_hurt'
      : 'male_hurt';
    const rate = 0.98 + Math.random() * 0.05;
    this.playSample(sampleKey, 0.28, rate, true);
  }

  /**
   * GUN FIGHT: Human Death / KO Sound & "Kaun hai re?!" (1 to 3 times max per Gun Fight match when player gets killed!)
   * Also rate-limited so death sounds don't trigger on every single elimination constantly.
   */
  public playDeathSound(
    isPlayerVictim: boolean = false,
    isPlayerKiller: boolean = false,
    charId?: string
  ) {
    const ctx = this.getContext();
    if (!ctx || this.sfxVolume <= 0.01) return;

    const now = ctx.currentTime;

    // 1. When YOU (the player) get killed: play "Kaun hai re?!" 1 to 3 times max across the whole Gun Fight match!
    if (isPlayerVictim) {
      this.stopActiveHurtSounds();
      this.playerDeathsInMatch += 1;

      const canPlayKaunHaiRe =
        this.kaunHaiRePlayedCount < this.kaunHaiReMaxPerMatch &&
        (this.lastKaunHaiReTime === 0 || now - this.lastKaunHaiReTime > 10.0) &&
        (this.playerDeathsInMatch === 1 || Math.random() < 0.55);

      if (canPlayKaunHaiRe && this.sampleBuffers.has('kaun_hai_re')) {
        this.kaunHaiRePlayedCount += 1;
        this.lastKaunHaiReTime = now;
        this.lastDeathSoundTime = now;
        this.playSample('kaun_hai_re', 0.7, 1.0);
        return;
      }

      // Every local death receives feedback on the elimination frame.
      this.lastDeathSoundTime = now;
      const isFemale = this.isFemaleCharacter(charId);
      this.playSample(
        isFemale ? 'female_death' : 'player_death',
        0.6,
        0.98 + Math.random() * 0.04
      );
      return;
    }

    // Keep simultaneous kills from stacking voices, without dropping ordinary kills.
    if (!isPlayerKiller) return;
    if (now - this.lastDeathSoundTime < .12) return;

    this.stopActiveHurtSounds();
    this.lastDeathSoundTime = now;

    const isFemale = this.isFemaleCharacter(charId);
    const sampleKey: SfxSampleKey = isFemale ? 'female_death' : 'player_death';
    this.playSample(sampleKey, 0.58, 0.98 + Math.random() * 0.05);
  }

  /**
   * GUN FIGHT: Legacy alias that calls the real KO sound
   */
  public playElimination(isPlayerKill: boolean = true, charId?: string) {
    this.playDeathSound(!isPlayerKill, isPlayerKill, charId);
  }

  /**
   * GUN FIGHT: Respawn Sound (Subtle soft chime)
   */
  public playRespawnSound() {
    this.playButtonClick();
  }

  /**
   * GUN FIGHT: Wall Ricochet (Silenced so missed bullets never make annoying 'souun' sweeps!)
   */
  public playWallRicochet() {
    // Intentionally silent so stray bullets hitting walls never create repetitive sine sweeps
  }

  /**
   * GUN FIGHT: Gentle 3-2-1 Countdown Beep & "FIGHT!" / Overtime Chord
   */
  public playCountdownBeep(isFinalGo: boolean = false) {
    this.playSoftAccent(isFinalGo ? [392, 493.88, 587.33] : [392], .09, isFinalGo ? .22 : .1);
  }

  public playVictoryFanfare() {
    this.playSoftAccent([392, 493.88, 587.33, 784], .085, .26);
  }

  public playLoseStinger() {
    this.playPointScored(false);
  }

  public playExplosionBoom() {
    this.playShotgunBlast(false);
  }

  public playSuperUltimate() {
    this.playMedkitPickup();
  }
}

export const crayonAudio = new CrayonAudioEngine();
