// Attachments in the chat (no React Native needed): node test/attach.test.js
"use strict";
const assert = require("assert");
const Module = require("module");
const { OryksaClient, chatBody } = require("../src/client");
const A = require("../src/attach");

const b64 = (n) => Buffer.alloc(n, 7).toString("base64");

(async () => {
  // the request body: a document goes as file_base64 / file_name / file_mime, a photo as image_base64 / image_mime
  const sent = [];
  const fakeFetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    return { ok: true, status: 200, json: async () => ({ status: "replied", reply: "Recebi o documento." }) };
  };
  const c = new OryksaClient({ token: "oryk_cs_test", fetch: fakeFetch });
  const pdf = Buffer.from("%PDF-1.4 orcamento").toString("base64");
  assert.strictEqual(await c.sendAndWait("Veja o orçamento", { file: { base64: pdf, name: "orcamento.pdf", mime: "application/pdf" } }), "Recebi o documento.");
  assert.strictEqual(sent[0].url, "https://api.oryksa.com/v1/client/chat");
  assert.strictEqual(sent[0].auth, "Bearer oryk_cs_test");
  assert.deepStrictEqual(sent[0].body, { message: "Veja o orçamento", file_base64: pdf, file_name: "orcamento.pdf", file_mime: "application/pdf" });
  await c.send("", { image: { base64: "/9j/AAA=", mime: "image/jpeg" } });
  assert.deepStrictEqual(sent[1].body, { message: "", image_base64: "/9j/AAA=", image_mime: "image/jpeg" });
  assert.deepStrictEqual(chatBody("Olá"), { message: "Olá" }, "no attachment, no attachment fields");
  console.log("  ok  request body: file_base64 / file_name / file_mime and image_base64 / image_mime");

  // the limits
  assert.strictEqual(A.MAX_PHOTO_BYTES, 2 * 1024 * 1024);
  assert.strictEqual(A.MAX_FILE_BYTES, 8 * 1024 * 1024);
  for (const n of [0, 1, 2, 3, 4, 1000, 1001, 1002]) assert.strictEqual(A.base64Bytes(b64(n)), n);
  assert.deepStrictEqual(A.photoAttachment({ base64: b64(A.MAX_PHOTO_BYTES + 1), mime: "image/jpeg" }), { error: "big" });
  assert.deepStrictEqual(A.photoAttachment({ base64: b64(10) }), { image: { base64: b64(10), mime: "image/jpeg" } });
  assert.deepStrictEqual(A.photoAttachment(null), { error: "failed" });
  assert.deepStrictEqual(A.documentAttachment({ base64: b64(A.MAX_FILE_BYTES + 1), name: "big.pdf" }), { error: "big" });
  assert.deepStrictEqual(A.documentAttachment({ tooBig: true, name: "big.pdf" }), { error: "big" });
  const ok8 = A.documentAttachment({ base64: b64(A.MAX_FILE_BYTES), name: "Contrato.PDF" });
  assert.strictEqual(ok8.file.mime, "application/pdf");
  assert.strictEqual(ok8.file.name, "Contrato.PDF");
  console.log("  ok  limits: photo 2 MB, document 8 MB");

  // a picture from the document picker: up to 2 MB a photo (the AI looks at it), larger a file
  assert.deepStrictEqual(A.documentAttachment({ base64: b64(1000), name: "foto.png" }), { image: { base64: b64(1000), mime: "image/png" } });
  assert.strictEqual(A.documentAttachment({ base64: b64(A.MAX_PHOTO_BYTES + 1), name: "foto.png" }).file.mime, "image/png");
  assert.strictEqual(A.mimeOf("a.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.strictEqual(A.mimeOf("lista.TXT"), "text/plain");
  assert.strictEqual(A.mimeOf("a.csv"), "text/csv");
  assert.strictEqual(A.mimeOf("a.zip"), "application/octet-stream");
  assert.strictEqual(A.documentAttachment({ base64: "", name: "notas", mime: "text/markdown" }).file.mime, "text/markdown");
  console.log("  ok  document types and pictures from the document picker");

  // without the picker libraries there is no picker (the attach button hides)
  assert.strictEqual(A.createDefaultPicker(), null);

  // with them: the photo is asked made smaller (1600 px, JPEG 80%, base64), documents are read and checked
  const asked = [];
  let docResult = [{ uri: "file:///tmp/orcamento%20final.pdf", name: "orcamento final.pdf", type: "application/pdf", size: 18 }];
  const fakes = {
    "react-native-image-picker": {
      launchImageLibrary: async (o) => { asked.push(["library", o]); return { assets: [{ base64: "/9j/AAA=", type: "image/jpeg", fileName: "a.jpg" }] }; },
      launchCamera: async (o) => { asked.push(["camera", o]); return { didCancel: true }; },
    },
    "@react-native-documents/picker": {
      types: { pdf: "application/pdf", doc: "application/msword", docx: "docx", plainText: "text/plain", csv: "text/csv", images: "image/*" },
      errorCodes: { OPERATION_CANCELED: "OPERATION_CANCELED" },
      isErrorWithCode: (e) => !!(e && e.code),
      pick: async (o) => { asked.push(["document", o]); if (docResult === "cancel") { const e = new Error("x"); e.code = "OPERATION_CANCELED"; throw e; } return docResult; },
    },
    "react-native-fs": { readFile: async (path, enc) => { asked.push(["read", path, enc]); return pdf; } },
  };
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function (req, ...rest) { return fakes[req] ? "fake:" + req : resolve.call(this, req, ...rest); };
  for (const k of Object.keys(fakes)) require.cache["fake:" + k] = { id: "fake:" + k, filename: "fake:" + k, loaded: true, exports: fakes[k] };
  try {
    const p = A.createDefaultPicker();
    assert.deepStrictEqual(await p.pickPhoto(), { base64: "/9j/AAA=", mime: "image/jpeg", name: "a.jpg" });
    assert.deepStrictEqual(asked[0][1], { mediaType: "photo", maxWidth: 1600, maxHeight: 1600, quality: 0.8, includeBase64: true, selectionLimit: 1, saveToPhotos: false });
    assert.strictEqual(await p.takePhoto(), null, "cancelled camera");
    assert.strictEqual(asked[1][0], "camera");
    assert.deepStrictEqual(await p.pickDocument(), { base64: pdf, name: "orcamento final.pdf", mime: "application/pdf" });
    assert.deepStrictEqual(asked[2][1].type, ["application/pdf", "application/msword", "docx", "text/plain", "text/csv", "image/*"]);
    assert.deepStrictEqual(asked[3], ["read", "/tmp/orcamento final.pdf", "base64"]);
    docResult = [{ uri: "content://x/1", name: "huge.pdf", type: "application/pdf", size: A.MAX_FILE_BYTES + 1 }];
    assert.deepStrictEqual(await p.pickDocument(), { tooBig: true, name: "huge.pdf" }, "too large: not even read");
    assert.strictEqual(asked.filter((x) => x[0] === "read").length, 1);
    docResult = "cancel";
    assert.strictEqual(await p.pickDocument(), null, "cancelled document");
  } finally {
    Module._resolveFilename = resolve;
    for (const k of Object.keys(fakes)) delete require.cache["fake:" + k];
  }
  console.log("  ok  default pickers: options, reading, size check and cancel");

  console.log("attach tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
