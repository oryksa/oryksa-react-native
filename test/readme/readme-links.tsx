// The "Links with an Open button" code of the README, word for word, type-checked by CI (tsc, strict) against src/index.d.ts.
import * as React from "react";
import {
  OryksaClient, OryksaChat, OryksaChatButton, OryksaChatModal, OryksaVoiceScreen, OryksaLinkCard, OryksaLinkHandler,
  OryksaLinkPreview, OryksaVoiceController, linksIn, withoutLinks, openLink,
} from "../../src";

const client = new OryksaClient({ getToken: async () => "oryk_cs_from_your_server" });

// What the app around the README code has.
declare function myProductIdOf(url: string): string | null;
declare const navigation: { navigate(screen: string, params: { id: string }): void };

export const button = <OryksaChatButton client={client} lang="en"
  onLink={(url) => {
    const id = myProductIdOf(url); // your routes
    if (!id) return false;
    navigation.navigate("Product", { id });
    return true;
  }} />;

// The same handler on the other components, and the helpers that are exported.
const onLink: OryksaLinkHandler = (url) => url.startsWith("https://your-shop.example/");
export const panel = <OryksaChat client={client} onLink={onLink} />;
export const modal = <OryksaChatModal client={client} visible onClose={() => {}} onLink={onLink} />;
export const voice = <OryksaVoiceScreen client={client} agent={{ name: "ORYKSA", avatar: "" }} visible onClose={() => {}} onLink={onLink} />;
export const card = <OryksaLinkCard url="https://your-shop.example/p/1" client={client} openLabel="Open" onLink={onLink} />;
export const links: string[] = linksIn("See https://your-shop.example/p/1.");
export const said: string = withoutLinks("See https://your-shop.example/p/1.");
export const preview: Promise<OryksaLinkPreview | null> = client.linkPreview("https://your-shop.example/p/1");
export function lastSpoken(c: OryksaVoiceController): string { return c.lastSpoken; }
openLink("https://your-shop.example/p/1", onLink);
