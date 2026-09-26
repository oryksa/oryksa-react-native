import * as React from "react";
import { StyleProp, ViewStyle } from "react-native";

export declare const VERSION: string;

export declare class OryksaError extends Error {
  status: number;
  code: string;
  [key: string]: unknown;
}

export interface OryksaAgent {
  name: string;
  avatar: string;
  business?: string | null;
  gender?: "female" | "male";
  greeting?: Record<string, string>;
  subtitle?: Record<string, string>;
  suggestions?: Record<string, string[]>;
  voice_replies?: boolean;
  conversation_id?: string;
}

export interface OryksaReply {
  object: "chat_reply";
  conversation_id: string;
  status: "replied" | "pending";
  reply: string | null;
}

export declare class OryksaClient {
  constructor(opts: { token?: string; getToken?: () => Promise<string>; baseUrl?: string; fetch?: typeof fetch; timeoutMs?: number });
  agent(): Promise<OryksaAgent>;
  send(message: string): Promise<OryksaReply>;
  sendAndWait(message: string, maxWaitMs?: number): Promise<string | null>;
  messages(): Promise<{ messages: { role: "user" | "assistant"; content: string }[] }>;
}

export type OryksaLang = "en" | "pt" | "br" | "es";

export interface OryksaTheme {
  accent?: string;
  ink?: string;
  soft?: string;
  background?: string;
  muted?: string;
}

export declare const DEFAULT_THEME: Required<OryksaTheme>;

export declare function OryksaChat(props: { client: OryksaClient; lang?: OryksaLang; theme?: OryksaTheme; onClose?: () => void }): React.ReactElement;
export declare function OryksaChatModal(props: { client: OryksaClient; lang?: OryksaLang; theme?: OryksaTheme; visible: boolean; onClose: () => void }): React.ReactElement;
export declare function OryksaChatButton(props: { client: OryksaClient; lang?: OryksaLang; theme?: OryksaTheme; position?: "left" | "right"; style?: StyleProp<ViewStyle> }): React.ReactElement;
