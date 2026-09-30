/*!
 * @oryksa/react-native - in-app client. Uses a short-lived session token (oryk_cs_...)
 * created by YOUR server with POST /v1/sessions. The secret API key never goes into the app.
 * Docs: https://developer.oryksa.com   License: MIT
 */
"use strict";

const DEFAULT_BASE = "https://api.oryksa.com/v1";
const VERSION = "1.1.1";

class OryksaError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.name = "OryksaError";
    this.status = status;
    this.code = code;
    Object.assign(this, extra || {});
  }
}

async function request(base, token, method, path, body, fetchImpl, timeoutMs) {
  const f = fetchImpl || globalThis.fetch;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await f(base + path, {
      method,
      headers: Object.assign(
        { Authorization: "Bearer " + token, Accept: "application/json", "X-ORYKSA-SDK": "react-native/" + VERSION },
        body !== undefined ? { "Content-Type": "application/json" } : {}
      ),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    });
  } catch (e) {
    throw new OryksaError(0, "network_error", "Could not reach ORYKSA: " + (e && e.message));
  } finally {
    if (timer) clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }
  if (!res.ok && res.status !== 202) {
    const e = (data && data.error) || {};
    const extra = Object.assign({}, e);
    delete extra.code; delete extra.message;
    throw new OryksaError(res.status, e.code || "http_" + res.status, e.message || "Request failed with HTTP " + res.status, extra);
  }
  return data || {};
}

/** One raw exchange (used for the voice: MP3 back, WAV up). Returns the Response. */
async function rawFetch(base, token, path, init, fetchImpl, timeoutMs) {
  const f = fetchImpl || globalThis.fetch;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res;
  try {
    res = await f(base + path, Object.assign({}, init, {
      headers: Object.assign({ Authorization: "Bearer " + token, "X-ORYKSA-SDK": "react-native/" + VERSION }, init.headers || {}),
      signal: ctrl ? ctrl.signal : undefined,
    }));
  } catch (e) {
    throw new OryksaError(0, "network_error", "Could not reach ORYKSA: " + (e && e.message));
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    const e = (data && data.error) || {};
    throw new OryksaError(res.status, e.code || "http_" + res.status, e.message || "Request failed with HTTP " + res.status);
  }
  return res;
}

function utf8(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
  const out = [];
  for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff); // ASCII only (multipart headers)
  return new Uint8Array(out);
}

/** multipart/form-data body with one file field `file` (built by hand: works in React Native and Node). */
function multipart(bytes, filename, type) {
  const boundary = "oryksa-" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const head = utf8("--" + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + filename + '"\r\nContent-Type: ' + type + "\r\n\r\n");
  const tail = utf8("\r\n--" + boundary + "--\r\n");
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return { body, contentType: "multipart/form-data; boundary=" + boundary };
}

class OryksaClient {
  /**
   * @param {{token?: string, getToken?: () => Promise<string>, baseUrl?: string, fetch?: Function, timeoutMs?: number}} opts
   */
  constructor(opts) {
    const o = opts || {};
    if (!o.token && !o.getToken) throw new Error("OryksaClient needs { token } or { getToken }.");
    if (o.token && String(o.token).startsWith("oryk_live_")) throw new Error("Never use the secret API key in an app. Use a session token (oryk_cs_...).");
    this._token = o.token || null;
    this._getToken = o.getToken || null;
    this._base = String(o.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    this._fetch = o.fetch;
    this._timeout = o.timeoutMs || 60000;
  }

  async _tok(force) {
    if ((!this._token || force) && this._getToken) this._token = await this._getToken();
    if (!this._token) throw new OryksaError(401, "no_token", "No session token.");
    return this._token;
  }

  async _req(method, path, body) {
    try {
      return await request(this._base, await this._tok(false), method, path, body, this._fetch, this._timeout);
    } catch (e) {
      if (e instanceof OryksaError && (e.code === "session_expired" || e.status === 401) && this._getToken) {
        return request(this._base, await this._tok(true), method, path, body, this._fetch, this._timeout);
      }
      throw e;
    }
  }

  /** Name, photo, greeting and suggestions of the AI employee. */
  agent() { return this._req("GET", "/client/agent"); }

  /**
   * Sends a message. status is "pending" when the AI needs a few more seconds: use sendAndWait.
   * @param {string} message
   * @param {{appContext?: {screen?: string, title?: string, items?: string[]}, voice?: boolean, whisper?: boolean, voiceStats?: object}} [opts]
   *   appContext: the screen the customer is on inside your app, so the AI answers about it.
   *   voice: the reply will be heard (it also carries a short `speech`). whisper: the customer whispered.
   */
  send(message, opts) {
    const o = opts || {};
    const body = { message };
    if (o.appContext) body.app_context = appContextJson(o.appContext);
    if (o.voice) body.voice = true;
    if (o.whisper) body.whisper = true;
    if (o.voiceStats) { body.platform = "rn"; body.voice_stats = o.voiceStats; }
    return this._req("POST", "/client/chat", body);
  }

  /** Like sendAndWait, but returns the whole reply object ({ status, reply, speech, whisper }). */
  async sendAndWaitReply(message, opts) {
    const o = opts || {};
    const r = await this.send(message, o);
    if (!r || r.status !== "pending") return r || {};
    const end = Date.now() + (o.maxWaitMs || 40000);
    while (Date.now() < end) {
      await new Promise((ok) => setTimeout(ok, 1500));
      const h = await this.messages();
      const last = ((h && h.messages) || []).slice(-1)[0];
      if (last && last.role === "assistant") return { status: "replied", reply: last.content, whisper: !!o.whisper };
    }
    return r;
  }

  async _raw(path, init) {
    try {
      return await rawFetch(this._base, await this._tok(false), path, init, this._fetch, this._timeout);
    } catch (e) {
      if (e instanceof OryksaError && (e.code === "session_expired" || e.status === 401) && this._getToken) {
        return rawFetch(this._base, await this._tok(true), path, init, this._fetch, this._timeout);
      }
      throw e;
    }
  }

  /**
   * The AI's voice (ElevenLabs, the voice chosen in ORYKSA) for one reply of this conversation, as MP3
   * bytes (Uint8Array). Resolves null when the voice is not available: then show the text only.
   */
  async tts(text, opts) {
    try {
      const body = { text };
      if (opts && opts.whisper) body.whisper = true;
      const res = await this._raw("/client/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const buf = new Uint8Array(await res.arrayBuffer());
      return buf.length ? buf : null;
    } catch (_) {
      return null;
    }
  }

  /** Customer voice to text. wav: Uint8Array, 16 kHz mono PCM16 WAV, up to 15 s. "" = nothing said, null = failed. */
  async transcribe(wav) {
    try {
      const mp = multipart(wav, "voice.wav", "audio/wav");
      const res = await this._raw("/client/transcribe", { method: "POST", headers: { "Content-Type": mp.contentType, Accept: "application/json" }, body: mp.body });
      const d = await res.json();
      return String((d && d.text) || "").trim();
    } catch (_) {
      return null;
    }
  }

  /** Reports a voice turn that produced no message (nothing heard, a cut with nothing said). */
  async voiceStats(stats) {
    try { await this._req("POST", "/client/voice-stats", { platform: "rn", voice_stats: stats }); } catch (_) { /* telemetry only */ }
  }

  /** Messages of this conversation: { messages: [{ role, content }] }. */
  messages() { return this._req("GET", "/client/messages"); }

  /** Sends a message and waits for the reply text. opts: { appContext } (or a number = maxWaitMs, as in 1.0). */
  async sendAndWait(message, opts) {
    const o = typeof opts === "number" ? { maxWaitMs: opts } : (opts || {});
    const r = await this.sendAndWaitReply(message, o);
    return (r && r.reply) || null;
  }
}

/** JSON of an app context: { screen, title, items (up to 20) }. */
function appContextJson(c) {
  const o = {};
  if (c.screen) o.screen = String(c.screen);
  if (c.title) o.title = String(c.title);
  if (Array.isArray(c.items) && c.items.length) o.items = c.items.slice(0, 20).map(String);
  return o;
}

/** Picks the text for a language with fallbacks (br uses pt, then en). */
function pick(map, lang) {
  if (!map || typeof map !== "object") return undefined;
  return map[lang] || (lang === "br" ? map.pt : undefined) || map.en || Object.values(map)[0];
}

module.exports = { OryksaClient, OryksaError, pick, appContextJson, multipart, VERSION, DEFAULT_BASE };
