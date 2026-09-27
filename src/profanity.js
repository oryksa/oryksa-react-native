/*!
 * @oryksa/react-native - swear words the customer types show as asterisks (owner rule: every ORYKSA
 * chat). One list for all ORYKSA clients: GET https://app.oryksa.com/widget/profanity.json?lang=
 * (kept 24 hours). The AI's replies already come filtered from the server.   License: MIT
 */
"use strict";

const URL_BASE = "https://app.oryksa.com/widget/profanity.json";
const DAY = 24 * 3600 * 1000;
const RE = {};
const AT = {};

/** Language key of the list: pt, br, en or es. */
function key(lang) {
  const l = String(lang || "en");
  return l.indexOf("br") >= 0 ? "br" : l.slice(0, 2);
}

/**
 * Builds the regex. Some JavaScript engines do not know \p{L} / \p{N}: then the same pattern runs with
 * explicit letter ranges (Latin, accents, Greek, Cyrillic) and without the u flag.
 */
function compile(pattern, flags) {
  try {
    return new RegExp(pattern, flags || "giu");
  } catch (_) {
    const p = pattern.replace(/\\p\{L\}/g, "A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF").replace(/\\p\{N\}/g, "0-9");
    try { return new RegExp(p, String(flags || "gi").replace("u", "")); } catch (_e) { return null; }
  }
}

/** Uses a pattern directly (tests, or your own copy of the list). */
function use(lang, pattern, flags) {
  const k = key(lang);
  RE[k] = compile(pattern, flags);
  AT[k] = Date.now();
}

/** Loads (or refreshes after 24 h) the list for lang. Never throws. */
async function load(lang, fetchImpl) {
  const k = key(lang);
  if (AT[k] && Date.now() - AT[k] < DAY) return;
  try {
    const f = fetchImpl || globalThis.fetch;
    const r = await f(URL_BASE + "?lang=" + encodeURIComponent(k));
    if (!r.ok) return;
    const d = await r.json();
    if (d && d.pattern) use(k, d.pattern, d.flags);
  } catch (_) { /* the chat works without it */ }
}

/** text with the swear words replaced by asterisks (at least 3). Unchanged when the list is not loaded. */
function mask(text, lang) {
  const re = RE[key(lang)];
  if (!re || !text) return text;
  re.lastIndex = 0;
  return String(text).replace(re, (m, pre) => (pre || "") + "*".repeat(Math.max(3, m.slice((pre || "").length).replace(/\s/g, "").length)));
}

module.exports = { load, use, mask, key };
