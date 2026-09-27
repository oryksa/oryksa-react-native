// Swear word mask with the server list (test/profanity_br.json = GET /widget/profanity.json?lang=br): node test/profanity.test.js
"use strict";
const assert = require("assert");
const spec = require("./profanity_br.json");
const p = require("../src/profanity");
p.use("br", spec.pattern, spec.flags);
assert.strictEqual(p.mask("filha da puta", "br"), "filha da ****");
assert.strictEqual(p.mask("vai tomar no cu", "br"), "vai tomar ****"); // the list masks the whole expression "no cu"
assert.strictEqual(p.mask("Que PORRA é essa?", "br"), "Que ***** é essa?");
for (const t of ["Quero uma vela de lavanda.", "O curso de computador custa quanto?", "Cuidado com a entrega", "Olá, boa tarde!"]) assert.strictEqual(p.mask(t, "br"), t);
assert.strictEqual(p.mask("filha da puta", "es"), "filha da puta");
// engines without \p{...}: the fallback pattern gives the same result
const fb = spec.pattern.replace(/\\p\{L\}/g, "A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF").replace(/\\p\{N\}/g, "0-9");
p.use("pt", fb, "gi");
assert.strictEqual(p.mask("filha da puta", "pt"), "filha da ****");
assert.strictEqual(p.mask("Cuidado com a entrega", "pt"), "Cuidado com a entrega");
console.log("profanity: all tests passed");
