// The voice conversation end to end with a fake microphone (real recordings) and a fake server:
// node test/voice.test.js
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { OryksaVoiceController, wav, fromBase64, toBase64 } = require("../src/voice");

const rec = (f) => { const b = fs.readFileSync(path.join(__dirname, "voice", f)); return new Uint8Array(b.buffer, b.byteOffset + 44, b.length - 44).slice(); };
const chunks = (pcm, size = 2048) => { const o = []; for (let i = 0; i < pcm.length; i += size) o.push(pcm.subarray(i, Math.min(i + size, pcm.length))); return o; };
const silence = (ms) => new Uint8Array((16000 * 2 * ms) / 1000);
const tick = () => new Promise((ok) => setTimeout(ok, 0));

function fakeAudio() {
  const a = { feed: null, played: [], stopped: 0, finish: null };
  a.startMic = async (onChunk) => { a.feed = onChunk; return true; };
  a.stopMic = async () => { a.feed = null; };
  a.play = (mp3) => new Promise((ok) => { a.played.push(mp3); a.finish = ok; });
  a.stopPlayback = async () => { a.stopped++; if (a.finish) { a.finish(); a.finish = null; } };
  return a;
}

function fakeClient() {
  const c = { sent: [], spoken: [], transcribed: 0, stats: [] };
  c.transcribe = async (w) => { c.transcribed++; assert.strictEqual(String.fromCharCode(...w.subarray(0, 4)), "RIFF"); return "Quanto custa a vela?"; };
  c.sendAndWaitReply = async (text, o) => { c.sent.push({ text, o }); return { status: "replied", reply: "**A vela** custa 59,90. Queres que a ponha no carrinho?", speech: "A vela custa 59,90." }; };
  c.tts = async (text, o) => { c.spoken.push({ text, o }); return new Uint8Array([1, 2, 3]); };
  c.voiceStats = async (s) => { c.stats.push(s); };
  return c;
}

(async () => {
  // base64 round trip (the microphone library delivers base64)
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253]);
  assert.deepStrictEqual(Array.from(fromBase64(toBase64(bytes))), Array.from(bytes));
  // wav header
  const w = wav(new Uint8Array(32000));
  const dv = new DataView(w.buffer);
  assert.strictEqual(dv.getUint32(24, true), 16000);
  assert.strictEqual(dv.getUint16(34, true), 16);
  assert.strictEqual(w.length, 44 + 32000);

  // 1) a full turn: speak -> transcribe -> voice reply -> she speaks the short version
  const audio = fakeAudio();
  const client = fakeClient();
  const heard = [], replies = [], phases = [];
  const ctl = new OryksaVoiceController({ client, audio, appContext: () => ({ screen: "product", title: "Vela" }),
    onUserText: (t) => heard.push(t), onReply: (t) => replies.push(t), onPhase: (p) => phases.push(p) });
  await ctl.start();
  for (const c of chunks(rec("fala.wav")).concat(chunks(silence(2000)))) audio.feed(c);
  for (let i = 0; i < 10; i++) await tick();
  assert.strictEqual(client.transcribed, 1, "one sentence, one transcription");
  assert.deepStrictEqual(heard, ["Quanto custa a vela?"]);
  assert.strictEqual(client.sent[0].o.voice, true);
  assert.strictEqual(client.sent[0].o.appContext.screen, "product");
  assert.strictEqual(client.sent[0].o.voiceStats.channel, "sdk_rn");
  assert.ok(replies[0].startsWith("**A vela**"), "the whole reply goes to the chat");
  assert.strictEqual(client.spoken[0].text, "A vela custa 59,90.", "she speaks the short version");
  assert.strictEqual(ctl.phase, "speaking");
  assert.ok(phases.includes("hearing") && phases.includes("thinking"));

  // 2) while she speaks, typing does NOT cut her off
  for (const c of chunks(rec("teclado.wav"))) audio.feed(c);
  await tick();
  assert.strictEqual(audio.stopped, 0, "typing cut her off");
  assert.strictEqual(ctl.phase, "speaking");

  // 3) "Para" cuts her off on the word, and what he says is kept
  for (const c of chunks(rec("para.wav"))) audio.feed(c);
  await tick();
  assert.strictEqual(audio.stopped, 1, "Para did not cut her off");
  assert.strictEqual(ctl.phase, "hearing");
  assert.ok(ctl._pcmBytes > 0, "the start of the sentence that cut her was lost");

  // 4) mute: nothing more is heard; close releases the microphone
  await ctl.toggleMute();
  assert.strictEqual(ctl.phase, "muted");
  assert.strictEqual(audio.feed, null);
  await ctl.close();

  // 5) the voice fails: silence + text (no robot voice), back to listening
  const audio2 = fakeAudio();
  const client2 = fakeClient();
  client2.tts = async () => null;
  const ctl2 = new OryksaVoiceController({ client: client2, audio: audio2 });
  await ctl2.start();
  for (const c of chunks(rec("fala.wav")).concat(chunks(silence(2000)))) audio2.feed(c);
  for (let i = 0; i < 10; i++) await tick();
  assert.strictEqual(audio2.played.length, 0);
  assert.strictEqual(ctl2.phase, "listening");
  await ctl2.close();

  // 6) nothing understood: the turn is reported (voice-stats) and she keeps listening
  const audio3 = fakeAudio();
  const client3 = fakeClient();
  client3.transcribe = async () => "";
  const ctl3 = new OryksaVoiceController({ client: client3, audio: audio3 });
  await ctl3.start();
  for (const c of chunks(rec("fala.wav")).concat(chunks(silence(2000)))) audio3.feed(c);
  for (let i = 0; i < 10; i++) await tick();
  assert.strictEqual(client3.stats.length, 1);
  assert.strictEqual(client3.stats[0].empty, true);
  assert.strictEqual(ctl3.phase, "listening");
  await ctl3.close();

  console.log("voice: all tests passed");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
