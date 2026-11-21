// The links of the AI's replies (no React Native needed): node test/links.test.js
"use strict";
const assert = require("assert");
const { linksIn, withoutLinks, richParts, cardTexts, openLink } = require("../src/links");
const { OryksaClient } = require("../src/client");

// The reply the TugaFreela app showed as plain text on 21/11/2026 (owner: "os links ainda não estão clicáveis").
const reply = "Sim, encontrei alguns webdesigners para criar sua landing page. Você pode conferir este serviço de " +
  "landing page profissional focada em conversões:\n" +
  "https://tugafreela.pt/wharakawa/criar-uma-landing-page-profissional-focada-em-conversoes\n" +
  "Se quiser ver mais opções, aqui está a lista: https://tugafreela.pt/servico/explorar/28.";
const first = "https://tugafreela.pt/wharakawa/criar-uma-landing-page-profissional-focada-em-conversoes";
const second = "https://tugafreela.pt/servico/explorar/28";

(async () => {
  // the links of a reply, in order, without the final dot
  assert.deepStrictEqual(linksIn(reply), [first, second]);
  assert.deepStrictEqual(linksIn("a https://x.pt/a, b https://x.pt/a! c https://y.pt/b; d https://z.pt/c? e https://w.pt/d"),
    ["https://x.pt/a", "https://y.pt/b", "https://z.pt/c"]);
  assert.deepStrictEqual(linksIn('(see https://x.pt/a) or "https://y.pt/b"…'), ["https://x.pt/a", "https://y.pt/b"]);
  assert.deepStrictEqual(linksIn("no links here, write to info@x.pt"), []);
  assert.deepStrictEqual(linksIn(reply), [first, second], "the same answer twice (no state kept between calls)");

  // the voice screen text has no addresses and no dangling colon
  const t = withoutLinks(reply);
  assert.ok(!t.includes("http"));
  assert.ok(!t.includes("conversões:"));
  assert.ok(t.includes("focada em conversões"));
  assert.ok(!t.endsWith(":"));
  assert.strictEqual(withoutLinks("See https://x.pt/a ."), "See.");

  // the text: bold stays, web links and e-mails are tappable parts
  const parts = richParts("**Snowboard** at " + first + ". Mail info@tugafreela.pt or " + second + ".");
  assert.strictEqual(parts.map((p) => p.text).join(""), "Snowboard at " + first + ". Mail info@tugafreela.pt or " + second + ".");
  assert.deepStrictEqual(parts.filter((p) => p.url).map((p) => [p.text, p.url]),
    [[first, first], ["info@tugafreela.pt", "mailto:info@tugafreela.pt"], [second, second]]);
  assert.deepStrictEqual(parts.filter((p) => p.bold).map((p) => p.text), ["Snowboard"]);

  // the card: the title of the page, or the host
  assert.deepStrictEqual(cardTexts("https://www.tugafreela.pt/x", null), { title: "tugafreela.pt", sub: "tugafreela.pt" });
  assert.deepStrictEqual(cardTexts(first, { title: "Landing page", site: "TugaFreela", price: "€150" }), { title: "Landing page", sub: "€150 · TugaFreela" });
  assert.deepStrictEqual(cardTexts(first, { title: "Landing page", site: "TugaFreela", price: "" }), { title: "Landing page", sub: "TugaFreela" });

  // the app's handler goes first: true = the app opened it
  const handled = [];
  openLink(first, (u) => { handled.push(u); return true; });
  assert.deepStrictEqual(handled, [first]);

  // the preview comes from the server once (same token as the other calls) and is kept
  const asked = [];
  let fail = false;
  const fakeFetch = async (url, init) => {
    asked.push({ url, auth: init.headers.Authorization });
    if (fail) return { ok: false, status: 500, json: async () => ({ error: { code: "boom", message: "no" } }) };
    const u = decodeURIComponent(url.split("?url=")[1]);
    return { ok: true, status: 200, json: async () => ({ object: "link_preview", url: u, title: "Eu vou criar uma landing page profissional focada em conversões", image: "", site: "tugafreela.pt", price: null }) };
  };
  const c = new OryksaClient({ token: "oryk_cs_test", fetch: fakeFetch });
  const p = await c.linkPreview(first);
  assert.strictEqual(p.title, "Eu vou criar uma landing page profissional focada em conversões");
  assert.strictEqual(p.site, "tugafreela.pt");
  assert.strictEqual(p.price, "");
  assert.strictEqual(asked.length, 1);
  assert.strictEqual(asked[0].url, "https://api.oryksa.com/v1/client/link-preview?url=" + encodeURIComponent(first));
  assert.strictEqual(asked[0].auth, "Bearer oryk_cs_test");
  assert.deepStrictEqual(await c.linkPreview(first), p);
  assert.strictEqual(asked.length, 1, "kept in memory");
  await c.linkPreview("https://shop.pt/p?id=5&c=a+b#top");
  assert.ok(asked[1].url.endsWith("?url=https%3A%2F%2Fshop.pt%2Fp%3Fid%3D5%26c%3Da%2Bb%23top"), "the whole address goes in the query");
  fail = true;
  assert.strictEqual(await c.linkPreview("https://tugafreela.pt/other"), null, "a failed preview is null, never an error");

  console.log("links tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
