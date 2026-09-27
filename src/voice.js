/*!
 * @oryksa/react-native - the ORYKSA voice conversation (the same behaviour as the ORYKSA app and
 * every other ORYKSA channel): the microphone stays open even while she speaks; only a human voice
 * cuts her off and she stops on the word (the text stays in the chat); the last second before the cut
 * is kept; 700 ms of silence closes a sentence, 15 s is the longest; a whisper gets a whispered,
 * shorter answer; her voice is the ElevenLabs voice chosen in ORYKSA, and if it fails she stays
 * silent and the text is shown (never a robot voice).
 *
 * Audio goes through a small adapter (see createDefaultAudio). License: MIT
 */
"use strict";

const { Vad } = require("./vad");

const SR = 16000;
const PRE_ROLL_BYTES = SR * 2; // one second of 16 kHz PCM16

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** base64 -> Uint8Array (no atob needed). */
function fromBase64(str) {
  const clean = String(str).replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]), b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0 && o < out.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0 && o < out.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

/** Uint8Array -> base64. */
function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    s += B64[a >> 2] + B64[((a & 3) << 4) | ((b || 0) >> 4)];
    s += i + 1 < bytes.length ? B64[((b & 15) << 2) | ((c || 0) >> 6)] : "=";
    s += i + 2 < bytes.length ? B64[c & 63] : "=";
  }
  return s;
}

/** 16 kHz mono PCM16 WAV (what the server transcribes). */
function wav(pcm, sampleRate) {
  const sr = sampleRate || SR;
  const out = new Uint8Array(44 + pcm.length);
  const dv = new DataView(out.buffer);
  const tag = (o, t) => { for (let i = 0; i < 4; i++) out[o + i] = t.charCodeAt(i); };
  tag(0, "RIFF"); dv.setUint32(4, 36 + pcm.length, true); tag(8, "WAVE");
  tag(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  tag(36, "data"); dv.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

function concat(parts, total) {
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/**
 * The default audio adapter for bare React Native apps. Install the three libraries:
 *   npm install react-native-live-audio-stream react-native-sound react-native-fs
 * and add the microphone permission (Android RECORD_AUDIO, iOS NSMicrophoneUsageDescription).
 * Expo or another audio stack: pass your own adapter with the same four functions.
 *
 * Adapter contract:
 *   startMic(onChunk)  -> Promise<boolean>  onChunk(Uint8Array PCM16 LE mono 16 kHz)
 *   stopMic()          -> Promise<void>
 *   play(mp3Uint8)     -> Promise<void>     resolves when it finished or was stopped
 *   stopPlayback()     -> Promise<void>
 */
function createDefaultAudio() {
  let LiveAudioStream, Sound, RNFS, RN;
  try {
    LiveAudioStream = require("react-native-live-audio-stream").default || require("react-native-live-audio-stream");
    Sound = require("react-native-sound");
    RNFS = require("react-native-fs");
    RN = require("react-native");
  } catch (_) {
    return null; // libraries not installed: the chat hides the microphone
  }
  let sub = null;
  let current = null;
  let ended = null;
  return {
    async startMic(onChunk) {
      try {
        if (RN.Platform.OS === "android") {
          const P = RN.PermissionsAndroid;
          const r = await P.request(P.PERMISSIONS.RECORD_AUDIO);
          if (r !== P.RESULTS.GRANTED) return false;
        }
        LiveAudioStream.init({ sampleRate: SR, channels: 1, bitsPerSample: 16, audioSource: 7, bufferSize: 4096, wavFile: "" });
        sub = LiveAudioStream.on("data", (b64) => onChunk(fromBase64(b64)));
        LiveAudioStream.start();
        return true;
      } catch (_) {
        return false;
      }
    },
    async stopMic() {
      try { LiveAudioStream.stop(); } catch (_) { /* ignore */ }
      if (sub && sub.remove) sub.remove();
      sub = null;
    },
    async play(mp3) {
      const file = RNFS.CachesDirectoryPath + "/oryksa_voice_" + Date.now() + ".mp3";
      await RNFS.writeFile(file, toBase64(mp3), "base64");
      Sound.setCategory("PlayAndRecord", true);
      await new Promise((ok) => {
        ended = ok;
        const snd = new Sound(file, "", (err) => {
          if (err) { ok(); return; }
          current = snd;
          snd.play(() => { snd.release(); current = null; ok(); });
        });
      });
      RNFS.unlink(file).catch(() => {});
    },
    async stopPlayback() {
      if (current) { try { current.stop(); current.release(); } catch (_) { /* ignore */ } current = null; }
      if (ended) { ended(); ended = null; }
    },
  };
}

/**
 * The voice conversation. Phases: starting, listening, hearing, thinking, speaking, muted, micError,
 * noisy, notUnderstood (onPhase is called on every change).
 */
class OryksaVoiceController {
  /**
   * @param {{client: object, audio?: object, appContext?: () => object, onUserText?: (t: string) => void,
   *          onReply?: (t: string) => void, onPhase?: (phase: string, ctl: OryksaVoiceController) => void}} opts
   */
  constructor(opts) {
    const o = opts || {};
    this.client = o.client;
    this.audio = o.audio || createDefaultAudio();
    this.appContext = o.appContext || null;
    this.onUserText = o.onUserText || null;
    this.onReply = o.onReply || null;
    this.onPhase = o.onPhase || null;
    this.vad = new Vad(SR);
    this.phase = "starting";
    this.lastReply = "";
    this.lastHeard = "";
    this._pcm = [];
    this._pcmBytes = 0;
    this._before = [];
    this._beforeBytes = 0;
    this._running = false;
    this._closed = false;
    this._speaking = false;
    this._busy = false;
    this._cut = false;
    this._whispered = false;
    this._noise = 0;
    this._turn = 0;
    this._heard = false;
  }

  _set(p) {
    if (this._closed || this.phase === p) return;
    this.phase = p;
    if (this.onPhase) this.onPhase(p, this);
  }

  /** Opens the microphone and starts listening. */
  async start() {
    if (this._closed || this._running || this.phase === "muted") return;
    if (!this.audio) { this._set("micError"); return; }
    const ok = await this.audio.startMic((c) => this._onAudio(c));
    if (!ok) { this._set("micError"); return; }
    this._running = true;
    this.vad.reset();
    this._pcm = []; this._pcmBytes = 0;
    this._heard = false;
    this._set("listening");
    setTimeout(() => { if (!this._closed && !this._heard && this.phase !== "muted") this._set("micError"); }, 4000);
  }

  _onAudio(chunk) {
    if (this._closed || this.phase === "muted" || !chunk || chunk.length < 2) return;
    if (!this._heard && Vad.rmsOf(chunk) > 0.0005) this._heard = true;

    // While she SPEAKS the engine only decides whether she was cut off.
    if (this._speaking) {
      this._before.push(chunk);
      this._beforeBytes += chunk.length;
      while (this._beforeBytes > PRE_ROLL_BYTES && this._before.length > 1) this._beforeBytes -= this._before.shift().length;
      if (this.vad.feed(chunk, true).isBargeIn) this._bargeIn();
      return;
    }

    const step = this.vad.feed(chunk);
    if (step.isBargeIn) { this._bargeIn(); return; }
    if (step.isCapturing || this.vad.capturing) {
      this._pcm.push(chunk);
      this._pcmBytes += chunk.length;
      if (!this._busy) this._set("hearing");
    }
    if (!step.isDone) return;

    const raw = concat(this._pcm, this._pcmBytes);
    this._pcm = []; this._pcmBytes = 0;
    const whisper = this.vad.foiSussurro;
    const stats = this._stats(false, Math.floor(raw.length / 32));
    this.vad.newTurn();
    if (step.enough && raw.length > SR / 2) {
      this._noise = 0;
      this._handle(wav(raw), whisper, stats);
    } else if (step.isNoise) {
      if (++this._noise >= 2) this._set("noisy");
    } else if (!this._busy) {
      this._set("listening");
    }
  }

  /** The customer cut her off: stop the voice on the word, keep what he says. */
  _bargeIn() {
    this._turn++;
    this._speaking = false;
    this._busy = false;
    if (this.audio) this.audio.stopPlayback();
    this.vad.newTurn();
    this.vad.capturing = true;
    this._pcm = this._before.slice();
    this._pcmBytes = this._beforeBytes;
    this._before = []; this._beforeBytes = 0;
    this._cut = true;
    this._set("hearing");
  }

  /** Sends what was said right away (tap on the picture). */
  sendNow() {
    if (this._busy || this._speaking || !this.vad.capturing) return;
    const raw = concat(this._pcm, this._pcmBytes);
    const whisper = this.vad.foiSussurro;
    const stats = this._stats(false, Math.floor(raw.length / 32));
    this.vad.newTurn();
    this._pcm = []; this._pcmBytes = 0;
    if (raw.length > SR / 2) this._handle(wav(raw), whisper, stats);
  }

  /** Audio numbers of this turn, in the ORYKSA ecosystem format (quality report). */
  _stats(empty, durMs) {
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return { channel: "sdk_rn", peak: r3(this.vad.picoDaFrase), pitch: r3(this.vad.tomDaFrase), noise: r3(this.vad.base),
      floor: Vad.bargeFloor, cut: false, whisper: this.vad.foiSussurro, self_cut: this._cut, empty, dur_ms: durMs };
  }

  async _handle(wavBytes, whisper, stats) {
    const my = ++this._turn;
    this._whispered = whisper;
    this._busy = true;
    this._set("thinking");
    const text = await this.client.transcribe(wavBytes);
    if (this._closed || my !== this._turn) return;
    if (!text) {
      await this.client.voiceStats(Object.assign({}, stats, { empty: true }));
      this._busy = false;
      this._set(text === null ? "notUnderstood" : "listening");
      return;
    }
    this.lastHeard = text;
    if (this.onUserText) this.onUserText(text);
    let r = null;
    try {
      r = await this.client.sendAndWaitReply(text, { appContext: this.appContext ? this.appContext() : undefined, voice: true, whisper, voiceStats: stats });
    } catch (_) { r = null; }
    if (this._closed || my !== this._turn) return;
    const reply = String((r && r.reply) || "").trim();
    if (!reply) { this._busy = false; this._set("notUnderstood"); return; }
    this.lastReply = reply;
    if (this.onReply) this.onReply(reply);
    const speech = String((r && r.speech) || "").trim();
    await this._speak(speech || reply, my);
  }

  /** Speaks text with the AI's voice (for example a greeting). If the voice fails she stays silent. */
  say(text) { return this._speak(text, ++this._turn); }

  async _speak(text, my) {
    this._before = []; this._beforeBytes = 0;
    const done = () => {
      this._cut = false;
      this._speaking = false;
      this._busy = false;
      this.vad.newTurn();
      if (!this._closed && my === this._turn) this._set("listening");
    };
    const mp3 = await this.client.tts(text, { whisper: this._whispered });
    if (this._closed || my !== this._turn || !mp3 || !this.audio) { done(); return; } // never a robot voice
    this._speaking = true;
    this._set("speaking");
    try { await this.audio.play(mp3); } catch (_) { /* silence + text */ }
    if (my === this._turn) done();
  }

  /** Mute: she stops talking and listening. Nothing is lost: what she said stays in the chat. */
  async toggleMute() {
    if (this.phase === "muted") {
      this.phase = "starting";
      if (this.onPhase) this.onPhase("starting", this);
      await this.start();
      return;
    }
    this._turn++;
    this._speaking = false;
    this._busy = false;
    if (this.audio) { await this.audio.stopPlayback(); await this.audio.stopMic(); }
    this._running = false;
    this.vad.newTurn();
    this.phase = "muted";
    if (this.onPhase) this.onPhase("muted", this);
  }

  /** Closes the microphone and the player. */
  async close() {
    if (this._closed) return;
    this._closed = true;
    this._turn++;
    if (this.audio) { await this.audio.stopPlayback(); await this.audio.stopMic(); }
    this._running = false;
  }
}

module.exports = { OryksaVoiceController, createDefaultAudio, wav, fromBase64, toBase64 };
