// Unit tests of the client (no React Native needed): node test/client.test.js
"use strict";
const assert = require("assert");
const { OryksaClient, pick } = require("../src/client");

(async () => {
  assert.throws(() => new OryksaClient({ token: "oryk_live_x" }), /secret API key/);
  assert.throws(() => new OryksaClient({}), /needs/);
  assert.strictEqual(pick({ en: "Hi", pt: "Olá" }, "br"), "Olá");
  assert.strictEqual(pick({ en: "Hi" }, "es"), "Hi");

  // token refresh on 401 + pending reply resolved from messages()
  let calls = 0;
  const fakeFetch = async (url, init) => {
    calls++;
    const auth = init.headers.Authorization;
    if (auth === "Bearer old") return { ok: false, status: 401, json: async () => ({ error: { code: "session_expired", message: "expired" } }) };
    if (url.endsWith("/client/chat")) return { ok: true, status: 202, json: async () => ({ status: "pending", reply: null }) };
    if (url.endsWith("/client/messages")) return { ok: true, status: 200, json: async () => ({ messages: [{ role: "user", content: "q" }, { role: "assistant", content: "answer" }] }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  let n = 0;
  const c = new OryksaClient({ token: "old", getToken: async () => (++n, "new"), fetch: fakeFetch });
  const reply = await c.sendAndWait("q", 5000);
  assert.strictEqual(reply, "answer");
  assert.strictEqual(n, 1);
  assert.ok(calls >= 3);
  console.log("all tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
