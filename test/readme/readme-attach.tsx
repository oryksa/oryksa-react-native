// The "Attach a photo or a document" code of the README, word for word, type-checked by CI (tsc, strict) against src/index.d.ts.
import * as React from "react";
import { OryksaClient, OryksaChat, OryksaChatButton, OryksaPicker, createDefaultPicker, documentAttachment, MAX_FILE_BYTES } from "../../src";

const client = new OryksaClient({ getToken: async () => "oryk_cs_from_your_server" });

// What the app around the README code has.
declare function myPhotoPicker(): Promise<{ base64: string; mime: string } | null>;
declare function myDocumentPicker(): Promise<{ base64: string; name: string; mime: string } | null>;

export const noButton = <OryksaChatButton client={client} lang="en" attachments={false} />; // no attach button

// Expo or another stack: your own pickers (a missing one hides that choice)
const picker: OryksaPicker = {
  pickPhoto: () => myPhotoPicker(), // { base64, mime } made smaller (1600 px, JPEG 80%), or null
  pickDocument: () => myDocumentPicker(), // { base64, name, mime }, or null
};
export const panel = <OryksaChat client={client} picker={picker} />;

// Without the UI
export const sent = client.send("Here is the quote", { file: { base64: "JVBERi0=", name: "quote.pdf", mime: "application/pdf" } });
export const def: OryksaPicker | null = createDefaultPicker();
export const att = documentAttachment({ base64: "", name: "a.txt" });
export const max: number = MAX_FILE_BYTES;
