/*!
 * @oryksa/react-native - the links of the AI's replies: found in the text, taken out of what she
 * says on the voice screen, and opened by your app (onLink) or by the system.   License: MIT
 */
"use strict";

const URL_RE = /https?:\/\/[^\s<>"'\)\]]+/gi;
const MAIL_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

/** Every match of re in s (a fresh copy of the regular expression, so no state is shared). */
function allMatches(re, s) {
  const r = new RegExp(re.source, re.flags);
  const out = [];
  let m;
  while ((m = r.exec(s)) !== null) {
    out.push(m);
    if (m[0] === "") r.lastIndex++;
  }
  return out;
}

/** The address without the punctuation that ends the sentence (.,;:!?…). */
function trimEnd(u) { return u.replace(/[.,;:!?…]+$/, ""); }

/** The distinct web links of text, in order (at most max). */
function linksIn(text, max) {
  const limit = max === undefined ? 3 : max;
  const out = [];
  for (const m of allMatches(URL_RE, String(text || ""))) {
    const u = trimEnd(m[0]);
    if (!out.includes(u)) out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}

/** text without its web links (for the voice screen: the link is on the button). */
function withoutLinks(text) {
  return String(text || "")
    .replace(URL_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .replace(/:\s*$/gm, "")
    .trim();
}

/** The parts of s that are links: web addresses and e-mails (as mailto:), in order. */
function linkHits(s) {
  const hits = [];
  for (const m of allMatches(URL_RE, s)) {
    const u = trimEnd(m[0]);
    hits.push({ start: m.index, end: m.index + u.length, url: u });
  }
  for (const m of allMatches(MAIL_RE, s)) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (hits.some((x) => start < x.end && end > x.start)) continue;
    hits.push({ start, end, url: "mailto:" + m[0] });
  }
  return hits.sort((a, b) => a.start - b.start);
}

/**
 * A message as parts to draw: { text, bold, url } (url only on the links, web and e-mail).
 * **bold** parts stay bold.
 */
function richParts(text) {
  const out = [];
  const links = (s, bold) => {
    let at = 0;
    for (const x of linkHits(s)) {
      if (x.start < at) continue;
      if (x.start > at) out.push({ text: s.slice(at, x.start), bold, url: null });
      out.push({ text: s.slice(x.start, x.end), bold, url: x.url });
      at = x.end;
    }
    if (at < s.length) out.push({ text: s.slice(at), bold, url: null });
  };
  const t = String(text || "");
  const parts = t.split("**");
  if (parts.length < 3) { links(t, false); return out; }
  parts.forEach((p, i) => { if (p) links(p, i % 2 === 1); });
  return out;
}

/** The host of url without www. (what the card shows when it has no title). */
function hostOf(url) {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#:]+)/i.exec(String(url || ""));
  return m ? m[1].replace(/^www\./i, "") : "";
}

/** Title and sub line (price · site, or site, or host) of the card for url. */
function cardTexts(url, p) {
  const host = hostOf(url);
  const title = p && p.title ? p.title : host;
  const sub = p && p.price ? p.price + " · " + (p.site || "") : (p && p.site ? p.site : host);
  return { title, sub };
}

/**
 * Opens a link: your handler first (return true when your app opened it), then the system
 * (React Native Linking: the browser or the app that owns the address).
 */
function openLink(url, handler) {
  if (handler && handler(url) === true) return;
  try {
    const { Linking } = require("react-native");
    const p = Linking.openURL(url);
    if (p && p.catch) p.catch(() => {});
  } catch (_) { /* no way to open it */ }
}

module.exports = { linksIn, withoutLinks, linkHits, richParts, hostOf, cardTexts, openLink };
