// Owner 2026-11-21: the SDK lets the developer have the AI do what THEY want in the app,
// counted as ORYKSA interactions. Run: node test/ai.test.js
"use strict";
const assert = require("assert");
const { OryksaClient, aiBody, aiResult } = require("../src/client");

(async () => {
  let seen = null;
  const fakeFetch = async (url, init) => {
    seen = { url, body: JSON.parse(init.body) };
    return {
      ok: true, status: 200,
      json: async () => ({ object: "ai_result", text: '{"size":"205/55 R16 91V"}', json: { size: "205/55 R16 91V" },
        oryksa: { interactions_spent: 1, interactions_remaining: 99 } }),
    };
  };
  const c = new OryksaClient({ token: "oryk_cs_test", fetch: fakeFetch });
  const r = await c.ai({ instructions: "Read the tyre size. Never invent.", images: [{ base64: "AQID" }], schema: { type: "object" } });
  assert.ok(seen.url.endsWith("/client/ai"));
  assert.strictEqual(seen.body.instructions, "Read the tyre size. Never invent.");
  assert.deepStrictEqual(seen.body.images, [{ base64: "AQID", mime: "image/jpeg" }]);
  assert.deepStrictEqual(seen.body.schema, { type: "object" });
  assert.ok(!("message" in seen.body));
  assert.strictEqual(r.json.size, "205/55 R16 91V");
  assert.strictEqual(r.interactionsSpent, 1);
  assert.strictEqual(r.interactionsRemaining, 99);

  const t = aiResult({ object: "ai_result", text: "Lisboa.", json: null, oryksa: { interactions_spent: 1 } });
  assert.strictEqual(t.text, "Lisboa.");
  assert.strictEqual(t.json, null);
  assert.strictEqual(t.interactionsRemaining, null);

  assert.throws(() => aiBody({}), /needs/);
  const p = { base64: "AQ" };
  assert.throws(() => aiBody({ input: "x", images: [p, p, p, p, p] }), /at most 4/);
  console.log("ai tests ok");
})().catch((e) => { console.error(e); process.exit(1); });
