// CI screenshots: the SDK components themselves (src/), rendered in Chrome with React Native for Web.
// ?t=<client token>&screen=product|chat|theme&lang=en|pt
import React from "react";
import { AppRegistry, SafeAreaView, Text, View } from "react-native";
import { OryksaClient, OryksaChat, OryksaChatButton } from "../../src";

const p = new URLSearchParams(location.search);
const client = new OryksaClient({ token: p.get("t") });
const lang = p.get("lang") || "en";
const screen = p.get("screen") || "product";
const product = { name: "Sky Beginner Snowboard", price: "489.95" };
const appContext = () => ({ screen: "product", title: product.name + ", " + product.price, items: [product.name] });

// The "Colours and theme" code of the README
const theme = { accent: "#0E8A6B" };

function App() {
  if (screen === "chat" || screen === "theme") {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <OryksaChat client={client} lang={lang} theme={screen === "theme" ? theme : undefined} appContext={appContext} />
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FDFAFF" }}>
      <Text style={{ fontSize: 22, padding: 20 }}>{lang === "pt" ? "A minha loja" : "My store"}</Text>
      <View style={{ marginHorizontal: 20, height: 200, borderRadius: 16, backgroundColor: "#EFF3F8", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 80 }}>🏂</Text>
      </View>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>{product.name}</Text>
        <Text style={{ fontSize: 18 }}>{product.price}</Text>
      </View>
      <OryksaChatButton client={client} lang={lang} appContext={appContext} />
    </SafeAreaView>
  );
}

AppRegistry.registerComponent("demo", () => App);
AppRegistry.runApplication("demo", { rootTag: document.getElementById("root") });
