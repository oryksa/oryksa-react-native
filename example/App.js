// ORYKSA chat + voice in a React Native app.
// Your server returns {"token": "oryk_cs_..."} for the signed-in user (POST /v1/sessions with the secret key).
//
// Voice (bare React Native): npm install react-native-live-audio-stream react-native-sound react-native-fs
// and add the microphone permission: Android RECORD_AUDIO, iOS NSMicrophoneUsageDescription.
// Expo or another audio stack: pass your own `audio` adapter (see OryksaAudio in the types).
import React from "react";
import { SafeAreaView, Text, View } from "react-native";
import { OryksaClient, OryksaChatButton } from "@oryksa/react-native";

const TOKEN_URL = "https://your-server.example/oryksa-token";
const client = new OryksaClient({
  getToken: async () => (await fetch(TOKEN_URL).then((r) => r.json())).token,
});

// A product page of your app: the chat knows the customer is looking at it.
const product = { name: "Sky Beginner Snowboard", price: "489.95" };

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>{product.name}</Text>
        <Text>{product.price}</Text>
      </View>
      <OryksaChatButton
        client={client}
        lang="en"
        appContext={() => ({ screen: "product", title: product.name + ", " + product.price, items: [product.name] })}
      />
    </SafeAreaView>
  );
}
