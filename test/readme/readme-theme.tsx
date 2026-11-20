// The "Colours and theme" code of the README, word for word, type-checked by CI (tsc, strict) against src/index.d.ts.
import * as React from "react";
import { OryksaClient, OryksaChat, OryksaChatButton, OryksaChatModal, DEFAULT_THEME } from "../../src";

const client = new OryksaClient({ getToken: async () => "oryk_cs_from_your_server" });

const theme = { accent: "#0E8A6B" };

export const button = <OryksaChatButton client={client} lang="en" theme={theme} />;

// The same theme on the other two components, and the defaults that are exported.
export const panel = <OryksaChat client={client} theme={theme} />;
export const modal = <OryksaChatModal client={client} theme={theme} visible onClose={() => {}} />;
export const defaultAccent: string = DEFAULT_THEME.accent;
