/*!
 * @oryksa/react-native - the ORYKSA chat for React Native: name and photo of the AI from
 * the ORYKSA account, with voice (the same behaviour as the ORYKSA app).
 * License: MIT
 */
"use strict";

const React = require("react");
const RN = require("react-native");
const { pick } = require("./client");
const { OryksaVoiceScreen, MicIcon } = require("./voice-screen");
const { createDefaultAudio } = require("./voice");
const { richParts, openLink } = require("./links");
const { OryksaLinkCards } = require("./link-card");
const { createDefaultPicker, photoAttachment, documentAttachment } = require("./attach");
const profanity = require("./profanity");

const h = React.createElement;
const { View, Text, TextInput, Image, Pressable, FlatList, Modal, KeyboardAvoidingView, Platform, StyleSheet, SafeAreaView, useWindowDimensions } = RN;

const TX = {
  en: { talk: "Talk to", ph: "Type your question", send: "Send", err: "Sorry, something went wrong. Try again.", voice: "Talk by voice", copy: "Copy", open: "Open", attach: "Attach", gallery: "Photo library", camera: "Camera", document: "Document", big: "The file is too large (max 8 MB).", attachErr: "Could not attach the file." },
  pt: { talk: "Falar com", ph: "Escreve a tua pergunta", send: "Enviar", err: "Desculpa, algo correu mal. Tenta de novo.", voice: "Falar por voz", copy: "Copiar", open: "Abrir", attach: "Anexar", gallery: "Foto da galeria", camera: "Câmara", document: "Documento", big: "O ficheiro é demasiado grande (máx. 8 MB).", attachErr: "Não foi possível anexar o ficheiro." },
  br: { talk: "Falar com", ph: "Digite sua pergunta", send: "Enviar", err: "Desculpe, algo deu errado. Tente de novo.", voice: "Falar por voz", copy: "Copiar", open: "Abrir", attach: "Anexar", gallery: "Foto da galeria", camera: "Câmera", document: "Documento", big: "O arquivo é grande demais (máx. 8 MB).", attachErr: "Não foi possível anexar o arquivo." },
  es: { talk: "Hablar con", ph: "Escribe tu pregunta", send: "Enviar", err: "Lo siento, algo salió mal. Inténtalo de nuevo.", voice: "Hablar por voz", copy: "Copiar", open: "Abrir", attach: "Adjuntar", gallery: "Foto de la galería", camera: "Cámara", document: "Documento", big: "El archivo es demasiado grande (máx. 8 MB).", attachErr: "No se pudo adjuntar el archivo." },
};
const DEFAULT_THEME = { accent: "#5B57E0", ink: "#161B3D", soft: "#EEEBFB", background: "#FFFFFF", muted: "#6B7280" };
const FALLBACK_AVATAR = "https://oryksa.com/assets/img/avatar_official_oryksa.png";
const L = (lang) => (TX[lang] ? lang : "en");

/**
 * Text with **bold** parts (the server marks them, the app only draws them) and links (web and
 * e-mail) the customer can tap: underlined, in linkColor; onLink first, then the system opens them.
 */
function rich(text, style, linkColor, onLink) {
  return richParts(text).map((p, i) => {
    const b = p.bold ? { fontWeight: "700" } : null;
    if (p.url) {
      const url = p.url;
      return h(Text, { key: i, onPress: () => openLink(url, onLink), accessibilityRole: "link",
        style: [style, b, { color: linkColor, textDecorationLine: "underline" }] }, p.text);
    }
    return b ? h(Text, { key: i, style: [style, b] }, p.text) : p.text;
  });
}

/**
 * The chat panel: header with the photo and name of the AI, messages, suggestions, input and (when
 * the plan has voice and an audio adapter is available) the microphone that opens the voice screen.
 * Props: client, lang, theme, onClose, appContext (() => ({ screen, title, items })), voice (default
 * true), audio (adapter; default: react-native-live-audio-stream + react-native-sound + react-native-fs),
 * onLink ((url) => boolean: true when your app opened a link the AI gave; otherwise the system opens it),
 * attachments (default true: the attach button, photo library, camera, document), picker (adapter;
 * default: react-native-image-picker + @react-native-documents/picker, see createDefaultPicker).
 */
function OryksaChat(props) {
  const { client, lang = "en", theme, onClose, appContext, voice = true, onLink, attachments = true } = props;
  const audio = React.useMemo(() => props.audio || createDefaultAudio(), [props.audio]);
  const picker = React.useMemo(() => (attachments ? props.picker || createDefaultPicker() : null), [props.picker, attachments]);
  const [menu, setMenu] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const th = Object.assign({}, DEFAULT_THEME, theme || {});
  const tx = TX[L(lang)];
  const [agent, setAgent] = React.useState(null);
  const [msgs, setMsgs] = React.useState([]);
  const [sug, setSug] = React.useState([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const listRef = React.useRef(null);

  const [, setProfReady] = React.useState(0);
  React.useEffect(() => {
    // Swear words the customer types show as asterisks (one list for every ORYKSA chat).
    profanity.load(L(lang)).then(() => setProfReady((n) => n + 1));
  }, [lang]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const a = await client.agent();
        const hist = await client.messages().catch(() => ({ messages: [] }));
        if (!alive) return;
        setAgent(a);
        const past = (hist && hist.messages) || [];
        if (past.length) {
          setMsgs(past.map((m, i) => ({ id: "h" + i, role: m.role === "user" ? "user" : "assistant", text: m.content })));
        } else {
          const g = pick(a.greeting, L(lang));
          if (g) setMsgs([{ id: "g", role: "assistant", text: g }]);
          setSug((pick(a.suggestions, L(lang)) || []).slice(0, 4));
        }
      } catch (_) {
        if (alive) setAgent({ name: "ORYKSA", avatar: FALLBACK_AVATAR });
      }
    })();
    return () => { alive = false; };
  }, [client, lang]);

  React.useEffect(() => { if (!note) return undefined; const t = setTimeout(() => setNote(""), 3500); return () => clearTimeout(t); }, [note]);

  // att: { image: { base64, mime } } or { file: { base64, name, mime } } (the attach button).
  const send = React.useCallback(async (value, att) => {
    const q = String(value || "").trim();
    const a = att || {};
    if ((!q && !a.image && !a.file) || busy) return;
    setBusy(true); setSug([]); setText("");
    const id = String(Date.now());
    setMsgs((m) => m.concat([{ id: id + "u", role: "user", text: q, image: a.image || null, fileName: a.file ? a.file.name : null },
      { id: id + "t", role: "typing", text: "..." }]));
    let reply = null;
    try { reply = await client.sendAndWait(q, { appContext: appContext ? appContext() : undefined, image: a.image, file: a.file }); } catch (_) { reply = null; }
    setMsgs((m) => m.filter((x) => x.role !== "typing").concat([{ id: id + "a", role: "assistant", text: reply || tx.err }]));
    setBusy(false);
  }, [busy, client, tx]);

  // The attach menu: photo library, camera (not on the web), document; a note when too large or unreadable.
  const attach = async (kind) => {
    setMenu(false);
    try {
      const got = await picker[kind]();
      if (!got) return;
      const r = kind === "pickDocument" ? documentAttachment(got) : photoAttachment(got);
      if (r.error) { setNote(r.error === "big" ? tx.big : tx.attachErr); return; }
      await send(text, r);
    } catch (_) {
      setNote(tx.attachErr);
    }
  };
  const choices = picker ? [
    picker.pickPhoto ? ["pickPhoto", tx.gallery] : null,
    picker.takePhoto && Platform.OS !== "web" ? ["takePhoto", tx.camera] : null,
    picker.pickDocument ? ["pickDocument", tx.document] : null,
  ].filter(Boolean) : [];

  const name = (agent && agent.name) || "";
  const sub = agent ? (pick(agent.subtitle, L(lang)) || agent.business || "") : "";

  return h(View, { style: [s.panel, { backgroundColor: th.background }] },
    h(View, { style: s.hd },
      h(Image, { source: { uri: (agent && agent.avatar) || FALLBACK_AVATAR }, style: s.hdImg }),
      h(View, { style: { flex: 1 } },
        h(Text, { style: [s.hdName, { color: th.ink }], numberOfLines: 1 }, name.toUpperCase()),
        sub ? h(Text, { style: [s.hdSub, { color: th.muted }], numberOfLines: 1 }, sub) : null),
      onClose ? h(Pressable, { onPress: onClose, accessibilityRole: "button", accessibilityLabel: "close", hitSlop: 10 },
        h(Text, { style: [s.close, { color: th.muted }] }, "×")) : null),
    h(FlatList, {
      ref: listRef,
      data: msgs,
      keyExtractor: (m) => m.id,
      contentContainerStyle: { padding: 16 },
      onContentSizeChange: () => listRef.current && listRef.current.scrollToEnd({ animated: true }),
      renderItem: ({ item }) => {
        const mine = item.role === "user";
        const hasText = !!item.text || (!item.image && !item.fileName);
        const bubble = h(View, { style: [s.bubble, mine ? [s.me, { backgroundColor: th.accent }] : [s.ai, { backgroundColor: th.soft }], item.role === "typing" ? { opacity: 0.6 } : null] },
          item.image ? h(Image, { source: { uri: "data:" + (item.image.mime || "image/jpeg") + ";base64," + item.image.base64 },
            style: [s.photo, hasText || item.fileName ? { marginBottom: 8 } : null], accessibilityLabel: tx.gallery }) : null,
          item.fileName ? h(View, { style: [s.fileRow, hasText ? { marginBottom: 8 } : null] },
            h(DocGlyph, { color: mine ? "#fff" : th.accent }),
            h(Text, { style: [s.fileName, { color: mine ? "#fff" : th.ink }], numberOfLines: 2 }, item.fileName)) : null,
          hasText ? h(Text, { selectable: true, style: { color: mine ? "#fff" : th.ink, fontSize: 14, lineHeight: 21 } },
            rich(mine ? profanity.mask(item.text, L(lang)) : item.text, { color: mine ? "#fff" : th.ink }, mine ? "#fff" : th.accent, onLink)) : null);
        if (mine || item.role === "typing" || !String(item.text || "").trim()) return bubble;
        // A card with an Open button for each link of the reply (owner 2026-11-21: the links were plain text),
        // then the copy button (same as the ORYKSA apps and extension).
        return h(View, null, bubble,
          h(OryksaLinkCards, { text: item.text, client, openLabel: tx.open, onLink, theme: th, style: s.card }),
          h(CopyButton, { text: String(item.text).replace(/\*\*/g, ""), label: tx.copy, color: th.muted }));
      },
    }),
    sug.length ? h(View, { style: s.sug }, sug.map((q) =>
      h(Pressable, { key: q, onPress: () => send(q), style: s.chip }, h(Text, { style: { color: th.accent, fontSize: 12.5 } }, q)))) : null,
    note ? h(Text, { style: [s.note, { backgroundColor: th.ink }], accessibilityLiveRegion: "polite" }, note) : null,
    menu && choices.length ? h(View, { style: [s.menu, { backgroundColor: th.background }] }, choices.map(([kind, label]) =>
      h(Pressable, { key: kind, onPress: () => attach(kind), accessibilityRole: "button", style: s.menuItem },
        h(Text, { style: { color: th.ink, fontSize: 14 } }, label)))) : null,
    h(View, { style: s.form },
      h(TextInput, {
        value: text, onChangeText: setText, placeholder: tx.ph, placeholderTextColor: "#9CA3AF", maxLength: 2000,
        style: [s.input, { color: th.ink }], returnKeyType: "send", onSubmitEditing: () => send(text),
      }),
      choices.length
        ? h(Pressable, { onPress: () => setMenu((v) => !v), disabled: busy, accessibilityRole: "button", accessibilityLabel: tx.attach, style: s.micBtn },
          h(ClipGlyph, { color: th.accent }))
        : null,
      voice && audio && agent && agent.voice_replies && !text.trim()
        ? h(Pressable, { onPress: () => setVoiceOpen(true), disabled: busy, accessibilityRole: "button", accessibilityLabel: tx.voice, style: s.micBtn },
          h(MicIcon, { color: th.accent }))
        : null,
      h(Pressable, { onPress: () => send(text), disabled: busy, style: [s.sendBtn, { backgroundColor: th.accent, opacity: busy ? 0.6 : 1 }] },
        h(Text, { style: s.sendTxt }, tx.send.toUpperCase()))),
    h(Text, { style: s.pw }, "POWERED BY ", h(Text, { style: { color: th.accent, fontWeight: "800" } }, "ORYKSA")),
    voiceOpen ? h(OryksaVoiceScreen, {
      client, agent, visible: true, lang: L(lang), theme: th, appContext, audio, onLink,
      onClose: () => setVoiceOpen(false),
      onUserText: (t) => { setSug([]); setMsgs((m) => m.concat([{ id: "v" + Date.now() + "u", role: "user", text: t }])); },
      onReply: (t) => setMsgs((m) => m.concat([{ id: "v" + Date.now() + "a", role: "assistant", text: t }])),
    }) : null);
}

/** Full-screen (phone) or floating (tablet) modal with the chat. */
function OryksaChatModal(props) {
  const { visible, onClose } = props;
  const { width } = useWindowDimensions();
  const wide = width >= 600;
  return h(Modal, { visible: !!visible, animationType: "slide", transparent: wide, onRequestClose: onClose },
    h(KeyboardAvoidingView, { style: wide ? s.wideWrap : { flex: 1 }, behavior: Platform.OS === "ios" ? "padding" : undefined },
      h(SafeAreaView, { style: wide ? s.wideCard : { flex: 1 } }, h(OryksaChat, Object.assign({}, props, { onClose })))));
}

/** Floating "Talk to name" button with the photo of the AI. Opens the chat. */
function OryksaChatButton(props) {
  const { client, lang = "en", theme, position = "right", style, appContext, voice, audio, onLink, attachments, picker } = props;
  const th = Object.assign({}, DEFAULT_THEME, theme || {});
  const [agent, setAgent] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    client.agent().then((a) => { if (alive) setAgent(a); }).catch(() => {});
    return () => { alive = false; };
  }, [client]);
  const tx = TX[L(lang)];
  return h(React.Fragment, null,
    h(Pressable, {
      onPress: () => setOpen(true), accessibilityRole: "button",
      style: [s.fab, position === "left" ? { left: 18 } : { right: 18 }, { backgroundColor: th.accent }, style],
    },
      h(Image, { source: { uri: (agent && agent.avatar) || FALLBACK_AVATAR }, style: s.fabImg }),
      h(Text, { style: s.fabTxt }, (tx.talk + " " + ((agent && agent.name) || "ORYKSA")).toUpperCase())),
    h(OryksaChatModal, { client, lang, theme, appContext, voice, audio, onLink, attachments, picker, visible: open, onClose: () => setOpen(false) }));
}

/** A paperclip drawn with views (no icon font): two rounded loops, turned. */
function ClipGlyph({ color }) {
  return h(View, { style: { width: 22, height: 22, alignItems: "center", justifyContent: "center", transform: [{ rotate: "40deg" }] } },
    h(View, { style: { width: 9, height: 19, borderRadius: 4.5, borderWidth: 1.8, borderColor: color } }),
    h(View, { style: { position: "absolute", top: 5, width: 4, height: 10, borderRadius: 2, borderWidth: 1.6, borderColor: color, borderTopWidth: 0 } }));
}

/** A document drawn with views: a page with two lines. */
function DocGlyph({ color }) {
  return h(View, { style: { width: 14, height: 18, borderRadius: 2, borderWidth: 1.6, borderColor: color, alignItems: "center", justifyContent: "center" } },
    h(View, { style: { width: 7, height: 1.6, backgroundColor: color, marginBottom: 2.5 } }),
    h(View, { style: { width: 7, height: 1.6, backgroundColor: color } }));
}

/** Copies text: @react-native-clipboard/clipboard when installed, else the Clipboard of older React Native. */
function copyText(t) {
  try { const C = require("@react-native-clipboard/clipboard"); (C.default || C).setString(t); return true; } catch (e) {}
  try { if (RN.Clipboard && RN.Clipboard.setString) { RN.Clipboard.setString(t); return true; } } catch (e) {}
  return false;
}

/** Copy icon drawn with views (no icon font): two rounded squares; a check after copying. */
function CopyGlyph({ color, done }) {
  if (done) return h(View, { style: { width: 14, height: 14, alignItems: "center", justifyContent: "center" } },
    h(View, { style: { width: 11, height: 6, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: color, transform: [{ rotate: "-45deg" }], marginTop: -3 } }));
  return h(View, { style: { width: 14, height: 14 } },
    h(View, { style: { position: "absolute", left: 0, top: 0, width: 9, height: 9, borderWidth: 1.6, borderColor: color, borderRadius: 2, borderRightWidth: 0, borderBottomWidth: 0 } }),
    h(View, { style: { position: "absolute", left: 4, top: 4, width: 10, height: 10, borderWidth: 1.6, borderColor: color, borderRadius: 2 } }));
}

/** Small copy button under a reply: copies the text and shows a check for a moment. */
function CopyButton({ text, label, color }) {
  const [done, setDone] = React.useState(false);
  React.useEffect(() => { if (!done) return undefined; const t = setTimeout(() => setDone(false), 1200); return () => clearTimeout(t); }, [done]);
  return h(Pressable, { onPress: () => { if (copyText(text)) setDone(true); }, accessibilityRole: "button", accessibilityLabel: label, hitSlop: 8, style: s.copy },
    h(CopyGlyph, { color, done }));
}

const s = StyleSheet.create({
  panel: { flex: 1 },
  hd: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#ECEEF6" },
  hdImg: { width: 46, height: 46, borderRadius: 23 },
  hdName: { fontSize: 14, fontWeight: "800", letterSpacing: 2 },
  hdSub: { fontSize: 12 },
  close: { fontSize: 26, paddingHorizontal: 6 },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, marginBottom: 10 },
  copy: { alignSelf: "flex-start", padding: 6, marginTop: -6, marginBottom: 6, borderRadius: 7 },
  card: { width: "86%", marginTop: -4, marginBottom: 10 },
  photo: { width: 200, height: 160, borderRadius: 12 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  fileName: { flexShrink: 1, fontSize: 13, fontWeight: "600" },
  note: { alignSelf: "center", color: "#fff", fontSize: 12.5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginBottom: 8, overflow: "hidden" },
  menu: { borderTopWidth: 1, borderTopColor: "#ECEEF6", paddingVertical: 4 },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  ai: { alignSelf: "flex-start", borderBottomLeftRadius: 6 },
  me: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  sug: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  chip: { borderWidth: 1, borderColor: "#DCDCF5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#fff" },
  form: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#ECEEF6" },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14 },
  sendBtn: { justifyContent: "center", paddingHorizontal: 18 },
  sendTxt: { color: "#fff", fontWeight: "800", letterSpacing: 1.2 },
  micBtn: { justifyContent: "center", paddingHorizontal: 12 },
  pw: { textAlign: "center", fontSize: 10.5, letterSpacing: 1.3, color: "#9CA3AF", paddingTop: 6, paddingBottom: 8 },
  wideWrap: { flex: 1, alignItems: "flex-end", justifyContent: "flex-end", padding: 22, paddingBottom: 92 },
  wideCard: { width: 380, height: 560, borderRadius: 20, overflow: "hidden", backgroundColor: "#fff", elevation: 16, shadowColor: "#161B3D", shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 12 } },
  fab: { position: "absolute", bottom: 22, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, paddingLeft: 8, paddingRight: 18, paddingVertical: 8, elevation: 8, shadowColor: "#161B3D", shadowOpacity: 0.28, shadowRadius: 15, shadowOffset: { width: 0, height: 6 } },
  fabImg: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: "#fff" },
  fabTxt: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 1 },
});

module.exports = { OryksaChat, OryksaChatModal, OryksaChatButton, DEFAULT_THEME };
