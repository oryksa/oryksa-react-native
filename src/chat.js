/*!
 * @oryksa/react-native - the ORYKSA chat for React Native, with the look of the
 * ORYKSA website chat (name and photo of the AI come from the ORYKSA account).
 * License: MIT
 */
"use strict";

const React = require("react");
const RN = require("react-native");
const { pick } = require("./client");

const h = React.createElement;
const { View, Text, TextInput, Image, Pressable, FlatList, Modal, KeyboardAvoidingView, Platform, StyleSheet, SafeAreaView, useWindowDimensions } = RN;

const TX = {
  en: { talk: "Talk to", ph: "Type your question", send: "Send", err: "Sorry, something went wrong. Try again." },
  pt: { talk: "Falar com", ph: "Escreve a tua pergunta", send: "Enviar", err: "Desculpa, algo correu mal. Tenta de novo." },
  br: { talk: "Falar com", ph: "Digite sua pergunta", send: "Enviar", err: "Desculpe, algo deu errado. Tente de novo." },
  es: { talk: "Hablar con", ph: "Escribe tu pregunta", send: "Enviar", err: "Lo siento, algo salió mal. Inténtalo de nuevo." },
};
const DEFAULT_THEME = { accent: "#5B57E0", ink: "#161B3D", soft: "#EEEBFB", background: "#FFFFFF", muted: "#6B7280" };
const FALLBACK_AVATAR = "https://oryksa.com/assets/img/avatar_official_oryksa.png";
const L = (lang) => (TX[lang] ? lang : "en");

/** The chat panel: header with the photo and name of the AI, messages, suggestions and the input. */
function OryksaChat(props) {
  const { client, lang = "en", theme, onClose } = props;
  const th = Object.assign({}, DEFAULT_THEME, theme || {});
  const tx = TX[L(lang)];
  const [agent, setAgent] = React.useState(null);
  const [msgs, setMsgs] = React.useState([]);
  const [sug, setSug] = React.useState([]);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const listRef = React.useRef(null);

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
    try { reply = await client.sendAndWait(q); } catch (_) { reply = null; }
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
        return h(View, { style: [s.bubble, mine ? [s.me, { backgroundColor: th.accent }] : [s.ai, { backgroundColor: th.soft }], item.role === "typing" ? { opacity: 0.6 } : null] },
          h(Text, { selectable: true, style: { color: mine ? "#fff" : th.ink, fontSize: 14, lineHeight: 21 } }, item.text));
      },
    }),
    sug.length ? h(View, { style: s.sug }, sug.map((q) =>
      h(Pressable, { key: q, onPress: () => send(q), style: s.chip }, h(Text, { style: { color: th.accent, fontSize: 12.5 } }, q)))) : null,
    h(View, { style: s.form },
      h(TextInput, {
        value: text, onChangeText: setText, placeholder: tx.ph, placeholderTextColor: "#9CA3AF", maxLength: 2000,
        style: [s.input, { color: th.ink }], returnKeyType: "send", onSubmitEditing: () => send(text),
      }),
      h(Pressable, { onPress: () => send(text), disabled: busy, style: [s.sendBtn, { backgroundColor: th.accent, opacity: busy ? 0.6 : 1 }] },
        h(Text, { style: s.sendTxt }, tx.send.toUpperCase()))),
    h(Text, { style: s.pw }, "POWERED BY ", h(Text, { style: { color: th.accent, fontWeight: "800" } }, "ORYKSA")));
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
  const { client, lang = "en", theme, position = "right", style } = props;
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
    h(OryksaChatModal, { client, lang, theme, visible: open, onClose: () => setOpen(false) }));
}

const s = StyleSheet.create({
  panel: { flex: 1 },
  hd: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#ECEEF6" },
  hdImg: { width: 46, height: 46, borderRadius: 23 },
  hdName: { fontSize: 14, fontWeight: "800", letterSpacing: 2 },
  hdSub: { fontSize: 12 },
  close: { fontSize: 26, paddingHorizontal: 6 },
  bubble: { maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, marginBottom: 10 },
  ai: { alignSelf: "flex-start", borderBottomLeftRadius: 6 },
  me: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  sug: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  chip: { borderWidth: 1, borderColor: "#DCDCF5", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#fff" },
  form: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#ECEEF6" },
  input: { flex: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14 },
  sendBtn: { justifyContent: "center", paddingHorizontal: 18 },
  sendTxt: { color: "#fff", fontWeight: "800", letterSpacing: 1.2 },
  pw: { textAlign: "center", fontSize: 10.5, letterSpacing: 1.3, color: "#9CA3AF", paddingTop: 6, paddingBottom: 8 },
  wideWrap: { flex: 1, alignItems: "flex-end", justifyContent: "flex-end", padding: 22, paddingBottom: 92 },
  wideCard: { width: 380, height: 560, borderRadius: 20, overflow: "hidden", backgroundColor: "#fff", elevation: 16, shadowColor: "#161B3D", shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 12 } },
  fab: { position: "absolute", bottom: 22, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 999, paddingLeft: 8, paddingRight: 18, paddingVertical: 8, elevation: 8, shadowColor: "#161B3D", shadowOpacity: 0.28, shadowRadius: 15, shadowOffset: { width: 0, height: 6 } },
  fabImg: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: "#fff" },
  fabTxt: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 1 },
});

module.exports = { OryksaChat, OryksaChatModal, OryksaChatButton, DEFAULT_THEME };
