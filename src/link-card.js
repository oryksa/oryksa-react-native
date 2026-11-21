/*!
 * @oryksa/react-native - the card under a reply for each link: the picture and title of the page
 * and an Open button.   License: MIT
 */
"use strict";

const React = require("react");
const RN = require("react-native");
const { cardTexts, openLink, linksIn } = require("./links");

const h = React.createElement;
const { View, Text, Image, Pressable, StyleSheet } = RN;

const COLORS = { accent: "#5B47E0", ink: "#1F2937", muted: "#6B7280", background: "#FFFFFF", line: "#E5E7EB" };

/** A link drawn with views (no icon font): two rounded rings, crossed. */
function LinkGlyph({ color }) {
  const ring = (left) => h(View, { style: { position: "absolute", top: 7, left, width: 12, height: 8, borderRadius: 4, borderWidth: 2, borderColor: color } });
  return h(View, { style: { width: 22, height: 22, transform: [{ rotate: "-45deg" }] } }, ring(1), ring(9));
}

/**
 * The card for one link of the AI's reply. Props: url, client, openLabel ("Open", "Abrir"), onLink
 * ((url) => boolean: true when your app opened it), onOpened (called when the card opens the link),
 * theme ({ accent, ink, muted, background, line }), style.
 * Only the pages of the business's own site get a title and a picture; other links show the address.
 */
function OryksaLinkCard(props) {
  const { url, client, openLabel = "Open", onLink, onOpened, theme, style } = props;
  const th = Object.assign({}, COLORS, theme || {});
  const [preview, setPreview] = React.useState(null);
  const [broken, setBroken] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    setPreview(null); setBroken(false);
    if (client && client.linkPreview) client.linkPreview(url).then((p) => { if (alive && p) setPreview(p); }).catch(() => {});
    return () => { alive = false; };
  }, [url, client]);
  const { title, sub } = cardTexts(url, preview);
  const img = (preview && preview.image) || "";
  const open = () => { if (onOpened) onOpened(); openLink(url, onLink); };
  return h(Pressable, {
    onPress: open, accessibilityRole: "button", accessibilityLabel: openLabel + ": " + title,
    style: [s.card, { backgroundColor: th.background, borderColor: th.line }, style],
  },
    h(View, { style: [s.pic, { backgroundColor: th.line }] },
      img && !broken
        ? h(Image, { source: { uri: img }, style: s.img, resizeMode: "cover", onError: () => setBroken(true) })
        : h(LinkGlyph, { color: th.muted })),
    h(View, { style: s.texts },
      h(Text, { style: [s.title, { color: th.ink }], numberOfLines: 2 }, title),
      sub ? h(Text, { style: [s.sub, { color: th.muted }], numberOfLines: 1 }, sub) : null),
    h(Pressable, { onPress: open, accessibilityRole: "button", accessibilityLabel: openLabel, style: [s.open, { backgroundColor: th.accent }] },
      h(Text, { style: s.openTxt }, openLabel)));
}

/** The cards for the links of text (at most 3), one under the other. */
function OryksaLinkCards(props) {
  const { text, style } = props;
  return linksIn(text).map((u) => h(OryksaLinkCard, Object.assign({}, props, { key: u, url: u, style })));
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", padding: 8, borderRadius: 14, borderWidth: 1 },
  pic: { width: 52, height: 52, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  img: { width: 52, height: 52 },
  texts: { flex: 1, marginLeft: 10, marginRight: 8 },
  title: { fontSize: 13.5, lineHeight: 17.5, fontWeight: "700" },
  sub: { fontSize: 11.5, marginTop: 1 },
  open: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  openTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

module.exports = { OryksaLinkCard, OryksaLinkCards };
