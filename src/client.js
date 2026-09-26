/*!
 * @oryksa/react-native - in-app client. Uses a short-lived session token (oryk_cs_...)
 * created by YOUR server with POST /v1/sessions. The secret API key never goes into the app.
 * Docs: https://developer.oryksa.com   License: MIT
 */
"use strict";

const DEFAULT_BASE = "https://api.oryksa.com/v1";
const VERSION = "1.0.0";

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

  /** Sends a message. status is "pending" when the AI needs a few more seconds: use sendAndWait. */
  send(message) { return this._req("POST", "/client/chat", { message }); }

  /** Messages of this conversation: { messages: [{ role, content }] }. */
  messages() { return this._req("GET", "/client/messages"); }

  /** Sends a message and waits for the reply text. */
  async sendAndWait(message, maxWaitMs) {
    const r = await this.send(message);
    if (!r || r.status !== "pending") return (r && r.reply) || null;
    const end = Date.now() + (maxWaitMs || 40000);
    while (Date.now() < end) {
      await new Promise((ok) => setTimeout(ok, 1500));
      const h = await this.messages();
      const last = ((h && h.messages) || []).slice(-1)[0];
      if (last && last.role === "assistant") return last.content;
    }
    return null;
  }
}

/** Picks the text for a language with fallbacks (br uses pt, then en). */
function pick(map, lang) {
  if (!map || typeof map !== "object") return undefined;
  return map[lang] || (lang === "br" ? map.pt : undefined) || map.en || Object.values(map)[0];
}

module.exports = { OryksaClient, OryksaError, pick, VERSION, DEFAULT_BASE };
