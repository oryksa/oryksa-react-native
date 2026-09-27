/*!
 * @oryksa/react-native - the ORYKSA voice engine.
 * Decides WHEN someone started and stopped speaking, and whether a sound while she speaks is a human
 * voice that cuts her off. Line by line port of lib/vad.dart of the ORYKSA app (the one engine of the
 * whole ecosystem): every number is the same and has the same reason. Do not change one without running
 * test/vad.test.js with new real recordings.
 * Input: PCM16 little-endian mono chunks (Uint8Array) at 16 kHz.   License: MIT
 */
"use strict";

function sample(b, index) {
  const v = b[index * 2] | (b[index * 2 + 1] << 8);
  return v >= 0x8000 ? v - 0x10000 : v;
}

class VadStep {
  constructor(o) {
    this.isCapturing = !!o.isCapturing;
    this.isDone = !!o.isDone;
    this.isBargeIn = !!o.isBargeIn;
    this.spokeMs = o.spokeMs || 0;
    /** Spoke enough to be worth sending? */
    this.enough = !!o.enough;
    /** Not a voice: endless background noise. The reference silence went up. */
    this.isNoise = !!o.isNoise;
    /** Average level of what was recorded. */
    this.level = o.level || 0;
  }
  static done(spokeMs, enough, isNoise, level) {
    return new VadStep({ isDone: true, spokeMs, enough, isNoise: !!isNoise, level: level || 0 });
  }
}
VadStep.IDLE = new VadStep({});
VadStep.CAPTURING = new VadStep({ isCapturing: true });
VadStep.BARGE_IN = new VadStep({ isBargeIn: true });

class Vad {
  constructor(sampleRate) {
    this.sampleRate = sampleRate || 16000;
    this._corrida = 0;
    this._maiorCorrida = 0;
    this._vozHaMs = 99999;
    /** Levels heard in the interruption attempt (for diagnosis). */
    this.perfil = [];
    /** Peak and pitch of the sentence just recorded (whisper detection and quality report). */
    this.picoDaFrase = 0;
    this.tomDaFrase = 0;
    /** Loudest sound while she spoke, and the highest pitch in the interruption attempt. */
    this.maxEnquantoFala = 0;
    this.tomDaInterrupcao = 0;
    this.base = 0;
    this.frames = 0;
    this.speechMs = 0;
    this.quietMs = 0;
    this.capturing = false;
    this._sum = 0;
    this._min = 1;
    this._max = 0;
    this._n = 0;
  }

  /** A whisper: voice without vocal folds, low and almost without pitch. Contract: peak < 0.09 and pitch < 0.45. */
  get foiSussurro() { return this.picoDaFrase > 0 && this.picoDaFrase < 0.09 && this.tomDaFrase < 0.45; }

  /**
   * Is this a human VOICE or a noise? Voice is periodic (vocal folds at 70 to 350 Hz); a key, a clap,
   * a door are clicks with no repetition. Normalised autocorrelation at 8 kHz (every other sample),
   * lags 23 (350 Hz) to 114 (70 Hz).
   */
  static periodicidade(chunk) {
    const n = chunk.length >> 1;
    if (n < 512) return 0;
    const m = n >> 1;
    const x = new Float64Array(m);
    let media = 0;
    for (let i = 0; i < m; i++) {
      x[i] = sample(chunk, i * 2) / 32768;
      media += x[i];
    }
    media /= m;
    let energia = 0;
    for (let i = 0; i < m; i++) {
      x[i] -= media;
      energia += x[i] * x[i];
    }
    if (energia <= 0) return 0;
    const lagMin = 23;
    const lagMax = 114;
    let melhor = 0;
    for (let lag = lagMin; lag <= lagMax && lag < m; lag++) {
      let soma = 0;
      for (let i = 0; i + lag < m; i++) soma += x[i] * x[i + lag];
      const r = soma / energia;
      if (r > melhor) melhor = r;
    }
    return melhor;
  }

  /** Level of this chunk (0 to 1). */
  static rmsOf(chunk) {
    const n = chunk.length >> 1;
    if (n === 0) return 0;
    let sum = 0;
    for (let k = 0; k < n; k++) {
      const v = sample(chunk, k) / 32768;
      sum += v * v;
    }
    return Math.sqrt(sum / n);
  }

  _noise() {
    const nivel = this._n > 0 ? this._sum / this._n : this.base;
    this.base = Math.min(Math.max(this.base, nivel), Vad.maxNoiseBase);
    return VadStep.done(this.speechMs, false, true, nivel);
  }

  /** Start from zero, forgetting the learnt silence. Only when a voice session starts. */
  reset() {
    this.base = 0;
    this.frames = 0;
    this.newTurn();
  }

  /** Ready for the next sentence, KEEPING the learnt silence (the room does not change between sentences). */
  newTurn() {
    this._corrida = 0;
    this._maiorCorrida = 0;
    this._vozHaMs = 99999;
    this.picoDaFrase = 0;
    this.tomDaFrase = 0;
    this.tomDaInterrupcao = 0;
    this.maxEnquantoFala = 0;
    this.perfil.length = 0;
    this.speechMs = 0;
    this.quietMs = 0;
    this.capturing = false;
    this._sum = 0;
    this._min = 1;
    this._max = 0;
    this._n = 0;
  }

  /** Feeds one chunk (Uint8Array, PCM16 LE). Returns what to do next. */
  feed(chunk, speaking) {
    speaking = !!speaking;
    const n = chunk.length >> 1;
    if (n === 0) return VadStep.IDLE;
    const rms = Vad.rmsOf(chunk);
    const ms = Math.floor((n * 1000) / this.sampleRate);
    this.frames++;

    // First chunks: learn this place's silence, never above maxBase.
    if (this.frames <= 3 && !speaking) {
      this.base = this.base === 0 ? Math.min(rms, Vad.maxBase) : Math.min(this.base, rms);
    }
    // THE TWO THRESHOLDS, different on purpose. CUTTING: the measured floor, not the room noise.
    // LISTENING: follows the noise, WITH a ceiling (0.10), or she is deaf in a cafe.
    const speakThr = speaking
      ? Math.max(this.base * 2.0, Vad.bargeFloor)
      : Math.min(Math.max(this.base * 3.2, 0.014), Vad.tetoOuvir);
    const quietThr = Math.max(this.base * 1.8, 0.008);

    // Room noise: goes down fast, up slowly, never learns from a voice-level sound.
    if (!this.capturing && !speaking) {
      if (rms < this.base) this.base = this.base * 0.8 + rms * 0.2;
      else if (rms < speakThr) this.base = this.base * 0.98 + rms * 0.02;
    }

    if (speaking) {
      const thr = speakThr;
      if (this.perfil.length < 40) this.perfil.push(rms);
      // Only VOICE interrupts. A key click is loud but has no pitch.
      const alto = rms > thr;
      if (rms > this.maxEnquantoFala) this.maxEnquantoFala = rms;
      const tom = alto ? Vad.periodicidade(chunk) : 0;
      if (tom > this.tomDaInterrupcao) this.tomDaInterrupcao = tom;
      if (tom >= Vad.bargeVozMin) this._vozHaMs = 0;
      else this._vozHaMs += ms;
      const ehVoz = alto && this._vozHaMs <= Vad.vozValeMs;
      if (ehVoz) {
        this.speechMs += ms;
        this.quietMs = 0;
        this._corrida += ms;
        if (this._corrida > this._maiorCorrida) this._maiorCorrida = this._corrida;
        if (this.speechMs >= Vad.bargeMs && this._maiorCorrida >= Vad.bargeRunMs) return VadStep.BARGE_IN;
      } else {
        this._corrida = 0;
        this.quietMs += ms;
        if (this.quietMs > Vad.bargeGapMs) {
          this.speechMs = 0;
          this.quietMs = 0;
          this._maiorCorrida = 0;
        }
      }
      return VadStep.IDLE;
    }

    if (rms > speakThr) {
      this.capturing = true;
      this.speechMs += ms;
      this.quietMs = 0;
      if (rms > this.picoDaFrase) this.picoDaFrase = rms;
      const tf = Vad.periodicidade(chunk);
      if (tf > this.tomDaFrase) this.tomDaFrase = tf;
    } else if (this.capturing) {
      if (rms < quietThr) this.quietMs += ms;
    }
    if (this.capturing) {
      this._sum += rms;
      if (rms < this._min) this._min = rms;
      if (rms > this._max) this._max = rms;
      this._n++;
    }

    if (!this.capturing) return VadStep.IDLE;

    // Background noise caught early: seconds without a pause AND always at the same level.
    const plano = this._min > 0 && this._max < this._min * Vad.flatRatio;
    if (this.speechMs > Vad.noiseAfterMs && this.quietMs === 0 && plano) return this._noise();

    if (this.quietMs <= Vad.quietToCloseMs && this.speechMs <= Vad.maxSpeechMs) return VadStep.CAPTURING;

    const spoke = this.speechMs;
    const nivel = this._n > 0 ? this._sum / this._n : 0;

    // Fifteen seconds without ONE pause is not a person: it is constant noise.
    if (spoke > Vad.maxSpeechMs && this.quietMs < 200) return this._noise();

    return VadStep.done(spoke, spoke >= Vad.minSpeechMs, false, nivel);
  }
}

/** Silence that closes a sentence (450 cut sentences, 900 was too slow; 700 is proven by the tests). */
Vad.quietToCloseMs = 700;
/** Minimum speech worth sending. Below this it is a cough or a door. */
Vad.minSpeechMs = 500;
/** Minimum recorded audio for the server to have something to hear. */
Vad.minAudioMs = 700;
/** Closes the sentence after this, even if the person goes on. */
Vad.maxSpeechMs = 15000;
/** VOICE time over her speech needed to silence her (two voiced slices). The pitch test does the heavy work. */
Vad.bargeMs = 130;
/** A pause long enough to give up an interruption (typing is ~5 keys a second: 200 ms apart). */
Vad.bargeGapMs = 130;
/** Continuous sound, without a single gap, so a loose slice does not count. */
Vad.bargeRunMs = 64;
/** How periodic a sound must be to count as voice (keyboard <= 0.20, human voice 0.50 to 0.93). */
Vad.bargeVozMin = 0.35;
/** How long the confidence lasts after the last voiced slice (the rest of the word counts). */
Vad.vozValeMs = 300;
/** Minimum level to count as an interruption, MEASURED LIVE (her echo 0.05, the person 0.12 to 0.25). Fixed. */
Vad.bargeFloor = 0.09;
/** Highest the LISTEN threshold can go, however noisy (without it she is deaf in a cafe). */
Vad.tetoOuvir = 0.1;
/** Highest level that can be taken as the room's silence. */
Vad.maxBase = 0.015;
/** Recording time without a pause after which we suspect it is noise. */
Vad.noiseAfterMs = 4000;
/** Voice goes up and down much more than this between chunks; background noise does not. */
Vad.flatRatio = 2.5;
/** Ceiling of the reference silence. */
Vad.maxNoiseBase = 0.12;

module.exports = { Vad, VadStep };
