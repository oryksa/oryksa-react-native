/*!
 * @oryksa/react-native - attachments in the chat: a photo (the AI looks at it) or a document (the AI
 * reads it). The pickers come from a small adapter (see createDefaultPicker), like the audio.
 * License: MIT
 */
"use strict";

/** The largest photo the chat sends (after it is made smaller): 2 MB. */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
/** The largest document the chat sends: 8 MB. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** The longest side of a photo the chat sends, in pixels, and its JPEG quality. */
const PHOTO_MAX_SIDE = 1600;
const PHOTO_QUALITY = 0.8;

const DOC_MIME = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const extOf = (name) => { const m = /\.([^./\\]+)$/.exec(String(name || "")); return m ? m[1].toLowerCase() : ""; };

/** The type of a file from its name ("application/octet-stream" when it is not a known one). */
function mimeOf(name) { return DOC_MIME[extOf(name)] || "application/octet-stream"; }

/** How many bytes a base64 text holds. */
function base64Bytes(b64) {
  const s = String(b64 || "").replace(/\s+/g, "");
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((s.length * 3) / 4) - pad);
}

/**
 * A photo from the picker ({ base64, mime }) as what the chat sends: { image } or { error: "big" }
 * (larger than 2 MB) or { error: "failed" } (nothing could be read).
 */
function photoAttachment(p) {
  if (!p || typeof p.base64 !== "string" || !p.base64) return { error: "failed" };
  if (base64Bytes(p.base64) > MAX_PHOTO_BYTES) return { error: "big" };
  return { image: { base64: p.base64, mime: p.mime || "image/jpeg" } };
}

/**
 * A document from the picker ({ base64, name, mime } or { tooBig: true }) as what the chat sends:
 * pictures up to 2 MB go as { image } (the AI looks at it), the rest as { file } up to 8 MB;
 * { error: "big" } or { error: "failed" } otherwise.
 */
function documentAttachment(d) {
  if (!d) return { error: "failed" };
  if (d.tooBig) return { error: "big" };
  if (typeof d.base64 !== "string") return { error: "failed" };
  const size = base64Bytes(d.base64);
  if (size > MAX_FILE_BYTES) return { error: "big" };
  const name = d.name || "file";
  const mime = DOC_MIME[extOf(name)] || d.mime || "application/octet-stream";
  if (mime.startsWith("image/") && size <= MAX_PHOTO_BYTES) return { image: { base64: d.base64, mime } };
  return { file: { base64: d.base64, name, mime } };
}

/** Reads a local file (file:// or content://) as base64: react-native-fs when installed, else fetch + FileReader. */
async function readBase64(uri) {
  try {
    const RNFS = require("react-native-fs");
    const fs = RNFS.default || RNFS;
    if (fs && fs.readFile) {
      const path = String(uri).startsWith("file://") ? decodeURIComponent(String(uri).slice(7)) : String(uri);
      return await fs.readFile(path, "base64");
    }
  } catch (_) { /* no react-native-fs: read it with fetch */ }
  const blob = await (await fetch(uri)).blob();
  return await new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || "").replace(/^data:[^,]*,/, ""));
    r.onerror = () => fail(r.error || new Error("read failed"));
    r.readAsDataURL(blob);
  });
}

/**
 * The default picker adapter, from two optional libraries your app installs:
 *   react-native-image-picker         photo library and camera (made smaller to 1600 px, JPEG 80%)
 *   @react-native-documents/picker    documents (PDF, Word, text, CSV, pictures)
 * Each choice shows only when its library is installed; null when neither is (no attach button).
 * Expo or another stack: pass your own { pickPhoto, takePhoto, pickDocument } as `picker`.
 */
function createDefaultPicker() {
  let IP = null;
  let DP = null;
  try { IP = require("react-native-image-picker"); } catch (_) { IP = null; }
  try { DP = require("@react-native-documents/picker"); } catch (_) { DP = null; }
  if (!IP && !DP) return null;
  const photo = async (launch) => {
    const r = await launch({ mediaType: "photo", maxWidth: PHOTO_MAX_SIDE, maxHeight: PHOTO_MAX_SIDE, quality: PHOTO_QUALITY,
      includeBase64: true, selectionLimit: 1, saveToPhotos: false });
    if (!r || r.didCancel) return null;
    if (r.errorCode) throw new Error(r.errorMessage || r.errorCode);
    const a = r.assets && r.assets[0];
    if (!a || !a.base64) throw new Error("no picture");
    return { base64: a.base64, mime: a.type || "image/jpeg", name: a.fileName || "photo.jpg" };
  };
  const pickDocument = async () => {
    const t = DP.types || {};
    let res;
    try {
      [res] = await DP.pick({ type: [t.pdf, t.doc, t.docx, t.plainText, t.csv, t.images].filter(Boolean) });
    } catch (e) {
      const cancelled = DP.isErrorWithCode && DP.errorCodes && DP.isErrorWithCode(e) && e.code === DP.errorCodes.OPERATION_CANCELED;
      if (cancelled) return null;
      throw e;
    }
    if (!res) return null;
    const name = res.name || "file";
    if (res.size && res.size > MAX_FILE_BYTES) return { tooBig: true, name };
    return { base64: await readBase64(res.uri), name, mime: res.type || mimeOf(name) };
  };
  return {
    pickPhoto: IP ? () => photo(IP.launchImageLibrary) : null,
    takePhoto: IP ? () => photo(IP.launchCamera) : null,
    pickDocument: DP ? pickDocument : null,
  };
}

module.exports = {
  MAX_PHOTO_BYTES, MAX_FILE_BYTES, PHOTO_MAX_SIDE, PHOTO_QUALITY,
  mimeOf, base64Bytes, photoAttachment, documentAttachment, readBase64, createDefaultPicker,
};
