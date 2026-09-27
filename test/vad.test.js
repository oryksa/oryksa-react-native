// The audio tests of the ORYKSA app (Dart), ported with the engine: node test/vad.test.js
// Real recordings (test/voice/*.wav) and synthetic sound: a bird, the TV, typing, a plane, her own
// echo must NOT cut her off; "Para" and "Espera" MUST.
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { Vad } = require("../src/vad");

let seed = 7;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

/** ms of sound at exactly `nivel` RMS (16 kHz PCM16). With `tom` it is periodic like a voice. */
function pedaco(nivel, opts) {
  const o = opts || {};
  const ms = o.ms || 100, tom = o.tom !== false, hz = o.hz || 120;
  const n = (16000 * ms) / 1000;
  const onda = new Float64Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    fase += (2 * Math.PI * hz) / 16000;
    onda[i] = tom ? Math.sin(fase) * 0.8 + Math.sin(fase * 2) * 0.2 + (rnd() - 0.5) * 0.05 : rnd() * 2 - 1;
  }
  let e = 0;
  for (const v of onda) e += v * v;
  const atual = Math.sqrt(e / n);
  const ganho = atual > 0 ? nivel / atual : 0;
  const out = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    const s = Math.round(Math.max(-1, Math.min(1, onda[i] * ganho)) * 32767);
    out[i * 2] = s & 0xff;
    out[i * 2 + 1] = (s >> 8) & 0xff;
  }
  return out;
}

function interrompe(som, tom) {
  const vad = new Vad(); vad.reset();
  for (const [nivel, ms] of som) {
    for (let t = 0; t < ms; t += 100) if (vad.feed(pedaco(nivel, { tom: tom !== false }), true).isBargeIn) return true;
  }
  return false;
}

function wav(nome) {
  const all = fs.readFileSync(path.join(__dirname, "voice", nome));
  return new Uint8Array(all.buffer, all.byteOffset + 44, all.length - 44).slice();
}
function chunks(pcm, size) {
  size = size || 2048;
  const out = [];
  for (let i = 0; i < pcm.length; i += size) out.push(pcm.subarray(i, Math.min(i + size, pcm.length)));
  return out;
}
const silencio = (ms) => new Uint8Array((16000 * 2 * (ms || 2000)) / 1000);

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// barge_in_test.dart
test("o passarinho NAO a cala", () => assert.ok(!interrompe([[0.0005, 500], [0.05, 300], [0.0005, 1000]], false)));
test("dois chilreios seguidos tambem nao", () => assert.ok(!interrompe([[0.0005, 300], [0.05, 250], [0.0005, 400], [0.05, 250], [0.0005, 600]], false)));
test("a televisao na sala nao a cala", () => assert.ok(!interrompe([[0.035, 4000]])));
test("o dono a falar CALA-A", () => assert.ok(interrompe([[0.0005, 200], [0.12, 900]])));
test("com pausas entre silabas cala-a na mesma", () => assert.ok(interrompe([[0.12, 300], [0.001, 100], [0.12, 300], [0.001, 100], [0.12, 300]])));
test("uma pausa LONGA desiste da interrupcao", () => assert.ok(!interrompe([[0.12, 100], [0.0005, 1000], [0.12, 100]])));
test("uma palavra curta de VOZ ja a cala", () => assert.ok(interrompe([[0.0005, 200], [0.12, 300]])));
test("UM AVIAO a passar nao a cala", () => assert.ok(!interrompe([[0.0005, 300], [0.18, 5000], [0.0005, 500]], false)));
test("secador, camiao, obra: nada disso a cala", () => assert.ok(!interrompe([[0.25, 8000]], false)));
test("um shhh NAO a cala (so voz)", () => assert.ok(!interrompe([[0.0005, 200], [0.18, 900]], false)));
test("silencio absoluto nunca a cala", () => assert.ok(!interrompe([[0, 5000]])));
test("ESCREVER NO TECLADO nao a cala", () => {
  const t = []; for (let i = 0; i < 30; i++) { t.push([0.18, 40]); t.push([0.0008, 160]); }
  assert.ok(!interrompe(t, false));
});
test("escrever DEPRESSA tambem nao a cala", () => {
  const t = []; for (let i = 0; i < 40; i++) { t.push([0.2, 60]); t.push([0.001, 60]); }
  assert.ok(!interrompe(t, false));
});
test("bater na mesa nao a cala", () => assert.ok(!interrompe([[0.0008, 300], [0.3, 80], [0.0008, 2000]], false)));
test("a propria voz dela no altifalante nao a cala", () => assert.ok(!interrompe([[0.05, 8000]])));
test("o eco dela um pouco mais alto tambem nao", () => assert.ok(!interrompe([[0.07, 6000]])));
test("com muito eco e preciso falar mais alto (mas da)", () => {
  const vad = new Vad(); vad.reset();
  for (let t = 0; t < 2000; t += 100) vad.feed(pedaco(0.05), true);
  let cortou = false;
  for (let t = 0; t < 900; t += 100) if (vad.feed(pedaco(0.25), true).isBargeIn) cortou = true;
  assert.ok(cortou);
});
// ambiente_test.dart
test("num cafe barulhento CONTINUA a ouvir", () => {
  seed = 5;
  const vad = new Vad(); vad.reset();
  for (let t = 0; t < 2000; t += 100) vad.feed(pedaco(0.055, { tom: false }));
  let ouviu = false;
  for (let t = 0; t < 1500; t += 100) if (vad.feed(pedaco(0.15)).isCapturing) ouviu = true;
  assert.ok(ouviu, "ficou surda com o barulho a volta");
});
test("a fasquia de ouvir nunca passa do teto", () => assert.ok(Vad.tetoOuvir <= 0.12));
test("o chao de interromper entre o eco e a voz", () => { assert.ok(Vad.bargeFloor > 0.06); assert.ok(Vad.bargeFloor < 0.12); });
// silencio_test.dart
function corre(f) {
  const vad = new Vad(); vad.reset();
  let fechos = 0, falaMs = 0;
  for (const c of chunks(wav(f)).concat(chunks(silencio()))) {
    const r = vad.feed(c);
    if (r.isDone) { fechos++; falaMs = r.spokeMs; vad.newTurn(); }
  }
  return { fechos, falaMs };
}
test("uma frase com pausas NAO e cortada em pedacos", () => {
  const r = corre("pausas.wav");
  assert.strictEqual(r.fechos, 1, "partida em " + r.fechos);
  assert.ok(r.falaMs > 2000, "so " + r.falaMs + " ms");
});
test("uma frase curta fecha uma vez", () => {
  const r = corre("curta.wav");
  assert.strictEqual(r.fechos, 1);
  assert.ok(r.falaMs >= Vad.minSpeechMs);
});
test("o silencio de fecho e o da constante", () => assert.ok(Vad.quietToCloseMs >= 600 && Vad.quietToCloseMs <= 900));
// vad_test.dart
test("uma frase falada e reconhecida e enviada", () => {
  const vad = new Vad();
  let end = null;
  for (const c of chunks(wav("fala.wav")).concat(chunks(silencio()))) { const r = vad.feed(c); if (r.isDone) { end = r; break; } }
  assert.ok(end, "nunca fechou a frase");
  assert.ok(end.enough, "descartada como too short");
  assert.ok(end.spokeMs > Vad.minSpeechMs);
});
test("so ruido de fundo nao e enviado", () => {
  const vad = new Vad();
  const noise = new Uint8Array(2048);
  for (let i = 0; i < noise.length; i += 2) noise[i] = 12;
  let end = null;
  for (let k = 0; k < 200; k++) { const r = vad.feed(noise); if (r.isDone) { end = r; break; } }
  assert.ok(!(end && end.enough));
});
test("uma pausa curta no meio nao fecha", () => {
  const vad = new Vad();
  const fala = chunks(wav("fala.wav"));
  const pausa = chunks(silencio(500));
  const all = fala.slice(0, 20).concat(pausa, fala.slice(20));
  let cedo = false;
  for (const c of all.slice(0, 20 + pausa.length + 5)) if (vad.feed(c).isDone) { cedo = true; break; }
  assert.ok(!cedo);
});
// voz_vs_ruido_test.dart
const tomMaximo = (f) => Math.max(0, ...chunks(wav(f)).filter((c) => Vad.rmsOf(c) > 0.02).map((c) => Vad.periodicidade(c)));
function cala(f) {
  const vad = new Vad(); vad.reset();
  for (const c of chunks(wav(f))) if (vad.feed(c, true).isBargeIn) return true;
  return false;
}
test("a voz TEM tom; o teclado nao", () => {
  for (const v of ["para.wav", "espera.wav", "curta.wav", "pausas.wav"]) assert.ok(tomMaximo(v) > Vad.bargeVozMin, v + " " + tomMaximo(v));
  assert.ok(tomMaximo("teclado.wav") < Vad.bargeVozMin);
});
test("Para CALA-A", () => assert.ok(cala("para.wav")));
test("Espera tambem a cala", () => assert.ok(cala("espera.wav")));
test("digitar nao a cala", () => assert.ok(!cala("teclado.wav")));
// whisper contract
test("sussurro: pico baixo e tom baixo", () => {
  const v = new Vad(); v.reset();
  for (let i = 0; i < 3; i++) v.feed(pedaco(0.001));
  for (let i = 0; i < 10; i++) v.feed(pedaco(0.06, { tom: false }));
  assert.ok(v.foiSussurro);
  const a = new Vad(); a.reset();
  for (let i = 0; i < 3; i++) a.feed(pedaco(0.001));
  for (let i = 0; i < 10; i++) a.feed(pedaco(0.15));
  assert.ok(!a.foiSussurro);
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log("ok   " + name); } catch (e) { failed++; console.log("FAIL " + name + ": " + e.message); }
}
console.log(tests.length - failed + "/" + tests.length + " passed");
if (failed) process.exit(1);
