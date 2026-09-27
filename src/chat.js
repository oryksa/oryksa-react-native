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
const profanity = require("./profanity");

const h = React.createElement;
const { View, Text, TextInput, Image, Pressable, FlatList, Modal, KeyboardAvoidingView, Platform, StyleSheet, SafeAreaView, useWindowDimensions } = RN;

const TX = {
  en: { talk: "Talk to", ph: "Type your question", send: "Send", err: "Sorry, something went wrong. Try again.", voice: "Talk by voice", copy: "Copy" },
  pt: { talk: "Falar com", ph: "Escreve a tua pergunta", send: "Enviar", err: "Desculpa, algo correu mal. Tenta de novo.", voice: "Falar por voz", copy: "Copiar" },
  br: { talk: "Falar com", ph: "Digite sua pergunta", send: "Enviar", err: "Desculpe, algo deu errado. Tente de novo.", voice: "Falar por voz", copy: "Copiar" },
  es: { talk: "Hablar con", ph: "Escribe tu pregunta", send: "Enviar", err: "Lo siento, algo salió mal. Inténtalo de nuevo.", voice: "Hablar por voz", copy: "Copiar" },
};
const DEFAULT_THEME = { accent: "#5B57E0", ink: "#161B3D", soft: "#EEEBFB", background: "#FFFFFF", muted: "#6B7280" };
const FALLBACK_AVATAR = "https://oryksa.com/assets/img/avatar_official_oryksa.png";
const L = (lang) => (TX[lang] ? lang : "en");

/** Text with **bold** parts (the server marks them, the app only draws them). */
function bold(text, style) {
  const parts = String(text).split("**");
  if (parts.length < 3) return text;
  return parts.map((p, i) => (p ? (i % 2 === 1 ? h(Text, { key: i, style: [style, { fontWeight: "700" }] }, p) : p) : null));
}

/**
 * The chat panel: header with the photo and name of the AI, messages, suggestions, input and (when
 * the plan has voice and an audio adapter is available) the microphone that opens the voice screen.
 * Props: client, lang, theme, onClose, appContext (() => ({ screen, title, items })), voice (default
 * true), audio (adapter; default: react-native-live-audio-stream + react-native-sound + react-native-fs).
 */
function OryksaChat(props) {
  const { client, lang = "en", theme, onClose, appContext, voice = true } = props;
  const audio = React.useMemo(() => props.audio || createDefaultAudio(), [props.audio]);
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

  const send = React.useCallback(async (value) => {
    const q = String(value || "").trim();
    if (!q || busy) return;
    setBusy(true); setSug([]); setText("");
    const id = String(Date.now());
    setMsgs((m) => m.concat([{ id: id + "u", role: "user", text: q }, { id: id + "t", role: "typing", text: "..." }]));
    let reply = null;
    try { reply = await client.sendAndWait(q, { appContext: appContext ? appContext() : undefined }); } catch (_) { reply = null; }
    setMsgs((m) => m.filter((x) => x.role !== "typing").concat([{ id: id + "a", role: "assistant", text: reply || tx.err }]));
    setBusy(false);
  }, [busy, client, tx]);

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
        const bubble = h(View, { style: [s.bubble, mine ? [s.me, { backgroundColor: th.accent }] : [s.ai, { backgroundColor: th.soft }], item.role === "typing" ? { opacity: 0.6 } : null] },
          h(Text, { selectable: true, style: { color: mine ? "#fff" : th.ink, fontSize: 14, lineHeight: 21 } }, bold(mine ? profanity.mask(item.text, L(lang)) : item.text, { color: mine ? "#fff" : th.ink })));
        if (mine || item.role === "typing" || !String(item.text || "").trim()) return bubble;
        // Copy button under each reply of the AI (same as the ORYKSA apps and extension).
        return h(View, null, bubble, h(CopyButton, { text: String(item.text).replace(/\*\*/g, ""), label: tx.copy, color: th.muted }));
      },
    }),
    sug.length ? h(View, { style: s.sug }, sug.map((q) =>
      h(Pressable, { key: q, onPress: () => send(q), style: s.chip }, h(Text, { style: { color: th.accent, fontSize: 12.5 } }, q)))) : null,
    h(View, { style: s.form },
      h(TextInput, {
        value: text, onChangeText: setText, placeholder: tx.ph, placeholderTextColor: "#9CA3AF", maxLength: 2000,
        style: [s.input, { color: th.ink }], returnKeyType: "send", onSubmitEditing: () => send(text),
      }),
      voice && audio && agent && agent.voice_replies && !text.trim()
        ? h(Pressable, { onPress: () => setVoiceOpen(true), disabled: busy, accessibilityRole: "button", accessibilityLabel: tx.voice, style: s.micBtn },
          h(MicIcon, { color: th.accent }))
        : null,
      h(Pressable, { onPress: () => send(text), disabled: busy, style: [s.sendBtn, { backgroundColor: th.accent, opacity: busy ? 0.6 : 1 }] },
        h(Text, { style: s.sendTxt }, tx.send.toUpperCase()))),
    h(Text, { style: s.pw }, "POWERED BY ", h(Text, { style: { color: th.accent, fontWeight: "800" } }, "ORYKSA")),
    voiceOpen ? h(OryksaVoiceScreen, {
      client, agent, visible: true, lang: L(lang), theme: th, appContext, audio,
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
  const { client, lang = "en", theme, position = "right", style, appContext, voice, audio } = props;
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
    h(OryksaChatModal, { client, lang, theme, appContext, voice, audio, visible: open, onClose: () => setOpen(false) }));
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
