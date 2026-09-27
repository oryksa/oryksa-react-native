/*!
 * @oryksa/react-native - the voice screen, the same as the ORYKSA app: the photo of the AI with a
 * halo, "I'm listening" / her answer, Mute and Close.   License: MIT
 */
"use strict";

const React = require("react");
const RN = require("react-native");
const { OryksaVoiceController } = require("./voice");

const h = React.createElement;
const { View, Text, Image, Pressable, Modal, SafeAreaView, StyleSheet, Animated, Easing } = RN;

const VX = {
  en: { listening: "I'm listening", listeningSub: "Speak to me. You can cut me off any time.", hearing: "Go on, I am listening.",
    thinking: "One moment...", muted: "Paused", mutedSub: "Tap the mic to talk again.",
    micError: "Microphone unavailable", micErrorSub: "Allow microphone access, or close other apps using it.",
    noisy: "Too much background noise", noisySub: "I cannot tell your voice from the noise. Move somewhere quieter, or type to me.",
    notUnderstood: "I could not understand", notUnderstoodSub: "Say it again, please.",
    tapToSend: "Tap the picture to send what you said.", mute: "Mute", unmute: "Unmute", close: "Close" },
  pt: { listening: "Estou a ouvir", listeningSub: "Fala comigo. Podes interromper-me quando quiseres.", hearing: "Continua, estou a ouvir.",
    thinking: "Um momento...", muted: "Em pausa", mutedSub: "Toca no microfone para voltar a falar.",
    micError: "Microfone indisponível", micErrorSub: "Permite o acesso ao microfone, ou fecha outras apps que o estejam a usar.",
    noisy: "Demasiado barulho", noisySub: "Não consigo distinguir a tua voz do barulho. Vai para um sítio mais calmo, ou escreve-me.",
    notUnderstood: "Não percebi", notUnderstoodSub: "Diz outra vez, por favor.",
    tapToSend: "Toca na imagem para enviar o que disseste.", mute: "Silenciar", unmute: "Ativar som", close: "Fechar" },
  br: { listening: "Estou ouvindo", listeningSub: "Fale comigo. Você pode me interromper quando quiser.", hearing: "Continue, estou ouvindo.",
    thinking: "Um momento...", muted: "Em pausa", mutedSub: "Toque no microfone para voltar a falar.",
    micError: "Microfone indisponível", micErrorSub: "Permita o acesso ao microfone, ou feche outros apps que estejam usando.",
    noisy: "Barulho demais", noisySub: "Não consigo separar sua voz do barulho. Vá para um lugar mais calmo, ou digite para mim.",
    notUnderstood: "Não entendi", notUnderstoodSub: "Fale de novo, por favor.",
    tapToSend: "Toque na imagem para enviar o que você disse.", mute: "Silenciar", unmute: "Ativar som", close: "Fechar" },
  es: { listening: "Te escucho", listeningSub: "Háblame. Puedes interrumpirme cuando quieras.", hearing: "Sigue, te escucho.",
    thinking: "Un momento...", muted: "En pausa", mutedSub: "Toca el micrófono para volver a hablar.",
    micError: "Micrófono no disponible", micErrorSub: "Permite el acceso al micrófono, o cierra otras apps que lo estén usando.",
    noisy: "Demasiado ruido", noisySub: "No distingo tu voz del ruido. Ve a un sitio más tranquilo, o escríbeme.",
    notUnderstood: "No te entendí", notUnderstoodSub: "Dilo otra vez, por favor.",
    tapToSend: "Toca la imagen para enviar lo que dijiste.", mute: "Silenciar", unmute: "Activar sonido", close: "Cerrar" },
};

const FALLBACK_AVATAR = "https://oryksa.com/assets/img/avatar_official_oryksa.png";

/**
 * Full-screen voice conversation. Props: client, agent ({ name, avatar, business }), visible, onClose,
 * lang, theme, appContext (() => ({ screen, title, items })), onUserText, onReply, audio (adapter).
 */
function OryksaVoiceScreen(props) {
  const { client, agent, visible, onClose, lang = "en", theme, appContext, onUserText, onReply, audio } = props;
  const th = Object.assign({ accent: "#5B57E0", ink: "#161B3D", soft: "#EEEBFB", background: "#FFFFFF", muted: "#6B7280" }, theme || {});
  const t = VX[lang] || VX.en;
  const [phase, setPhase] = React.useState("starting");
  const ctlRef = React.useRef(null);
  const pulse = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!visible) return undefined;
    const ctl = new OryksaVoiceController({ client, audio, appContext, onUserText, onReply, onPhase: (p) => setPhase(p) });
    ctlRef.current = ctl;
    ctl.start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.07, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); ctl.close(); ctlRef.current = null; };
  }, [visible, client]);

  const ctl = ctlRef.current;
  const pick = {
    starting: [t.listening, t.listeningSub], listening: [t.listening, t.listeningSub], hearing: [t.listening, t.hearing],
    thinking: [(ctl && ctl.lastHeard) || "...", t.thinking], speaking: [(agent && agent.name) || "ORYKSA", (ctl && ctl.lastReply) || ""],
    muted: [t.muted, t.mutedSub], micError: [t.micError, t.micErrorSub], noisy: [t.noisy, t.noisySub],
    notUnderstood: [t.notUnderstood, t.notUnderstoodSub],
  }[phase] || [t.listening, t.listeningSub];
  const active = phase === "hearing" || phase === "speaking";
  const photo = (agent && agent.avatar) || FALLBACK_AVATAR;
  const close = () => { if (ctlRef.current) ctlRef.current.close(); if (onClose) onClose(); };
  const ring = (size, alpha) => h(Animated.View, {
    key: size, style: [st.ring, { width: size, height: size, borderRadius: size / 2, backgroundColor: th.accent, opacity: alpha,
      transform: [{ scale: active ? pulse : 1 }] }] });

  return h(Modal, { visible: !!visible, animationType: "slide", onRequestClose: close },
    h(SafeAreaView, { style: [st.screen, { backgroundColor: th.background }] },
      h(View, { style: st.hd },
        h(Image, { source: { uri: photo }, style: st.hdImg }),
        h(View, { style: { flex: 1 } },
          h(Text, { style: [st.hdName, { color: th.ink }] }, (agent && agent.name) || "ORYKSA"),
          agent && agent.business ? h(Text, { style: { fontSize: 11, color: th.muted }, numberOfLines: 1 }, agent.business) : null),
        h(Pressable, { onPress: close, accessibilityRole: "button", accessibilityLabel: t.close, hitSlop: 10 },
          h(Text, { style: { fontSize: 26, color: th.muted, paddingHorizontal: 6 } }, "×"))),
      h(View, { style: st.center },
        h(Pressable, { onPress: () => ctlRef.current && ctlRef.current.sendNow(), style: st.halo },
          ring(236, 0.06), ring(184, 0.09), ring(136, 0.13),
          h(Image, { source: { uri: photo }, style: st.photo })),
        h(Text, { style: [st.title, { color: th.ink }] }, pick[0]),
        h(Text, { style: [st.sub, { color: th.muted }] }, pick[1]),
        phase === "hearing" ? h(Text, { style: st.tap }, t.tapToSend) : null,
        h(View, { style: st.row },
          btn(phase === "muted" ? "🔇" : "🎙️", phase === "muted" ? t.unmute : t.mute, false, () => ctlRef.current && ctlRef.current.toggleMute(), th),
          btn("×", t.close, true, close, th))),
      h(Text, { style: st.pw }, "POWERED BY ", h(Text, { style: { color: th.accent, fontWeight: "800" } }, "ORYKSA"))));
}

function btn(icon, label, cancel, onPress, th) {
  const red = "#E05A52";
  return h(Pressable, { onPress, accessibilityRole: "button", accessibilityLabel: label, style: { alignItems: "center" } },
    h(View, { style: [st.cbtn, { backgroundColor: cancel ? "#FDF0EF" : th.background, borderColor: cancel ? "#F3C0BE" : "#ECECF6" }] },
      h(Text, { style: { fontSize: 22, color: cancel ? red : th.muted } }, icon)),
    h(Text, { style: { marginTop: 8, fontSize: 12, color: cancel ? red : th.muted } }, label));
}

const st = StyleSheet.create({
  screen: { flex: 1 },
  hd: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  hdImg: { width: 38, height: 38, borderRadius: 19 },
  hdName: { fontSize: 14.5, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  halo: { width: 250, height: 250, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute" },
  photo: { width: 124, height: 124, borderRadius: 62 },
  title: { marginTop: 14, fontSize: 22, fontWeight: "700", textAlign: "center" },
  sub: { marginTop: 8, fontSize: 13.5, lineHeight: 20, textAlign: "center" },
  tap: { marginTop: 10, fontSize: 11.5, color: "#AAB0CC" },
  row: { flexDirection: "row", gap: 46, marginTop: 20 },
  cbtn: { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pw: { textAlign: "center", fontSize: 10.5, letterSpacing: 1.3, color: "#9CA3AF", paddingBottom: 22 },
});

module.exports = { OryksaVoiceScreen, VOICE_TEXTS: VX };
