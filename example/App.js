// Minimal ORYKSA chat in an Expo / React Native app.
// Your server returns {"token": "oryk_cs_..."} for the signed-in user (POST /v1/sessions with the secret key).
import React from "react";
import { SafeAreaView, Text, View } from "react-native";
import { OryksaClient, OryksaChatButton } from "@oryksa/react-native";

const TOKEN_URL = "https://your-server.example/oryksa-token";
const client = new OryksaClient({
  getToken: async () => (await fetch(TOKEN_URL).then((r) => r.json())).token,
});

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Your app content</Text>
      </View>
      <OryksaChatButton client={client} lang="en" />
    </SafeAreaView>
  );
}
