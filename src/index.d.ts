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
  /** The AI photo from "Your AI" in ORYKSA (never the owner's photo). Same as avatar. */
  photo?: string;
  /** ElevenLabs voice chosen for the AI in ORYKSA. */
  voice?: string | null;
  /** Main language of the AI, from ORYKSA. */
  language?: string | null;
}

/** Where the customer is inside your app (sent with each message so the AI answers about it). */
export interface OryksaAppContext {
  screen?: string;
  title?: string;
  /** What is listed on the screen. Up to 20. */
  items?: string[];
}

export interface OryksaSendOptions {
  appContext?: OryksaAppContext;
  /** The reply will be heard: it also carries a short `speech`. */
  voice?: boolean;
  /** The customer whispered: shorter, whispered answer. */
  whisper?: boolean;
  voiceStats?: Record<string, unknown>;
  maxWaitMs?: number;
}

export interface OryksaReply {
  object: "chat_reply";
  conversation_id: string;
  status: "replied" | "pending";
  reply: string | null;
  /** With voice: the short spoken version of reply (1-2 sentences, no markdown). */
  speech?: string;
  whisper?: boolean;
}

/** Title and picture of a link of the business's own site (OryksaClient.linkPreview). */
export interface OryksaLinkPreview {
  object: "link_preview";
  url: string;
  /** Title of the page (empty for other sites). */
  title: string;
  /** Picture of the page (empty when it has none). */
  image: string;
  /** Name of the site. */
  site: string;
  /** Price, when the page says it (shops). */
  price: string;
}

/**
 * What your app does with a link the AI gave (a product, a service, a page). Return true when your app
 * opened it itself (for example its own product screen); return false and the system opens it.
 */
export type OryksaLinkHandler = (url: string) => boolean;

export declare class OryksaClient {
  constructor(opts: { token?: string; getToken?: () => Promise<string>; baseUrl?: string; fetch?: typeof fetch; timeoutMs?: number });
  agent(): Promise<OryksaAgent>;
  /** Title and picture of a link the AI gave (only the pages of the business's own site); null when it cannot be read, never throws. */
  linkPreview(url: string): Promise<OryksaLinkPreview | null>;
  send(message: string, opts?: OryksaSendOptions): Promise<OryksaReply>;
  sendAndWait(message: string, opts?: OryksaSendOptions | number): Promise<string | null>;
  sendAndWaitReply(message: string, opts?: OryksaSendOptions): Promise<OryksaReply>;
  messages(): Promise<{ messages: { role: "user" | "assistant"; content: string }[] }>;
  /** The AI's voice (MP3 bytes) for one reply of this conversation; null when not available (show the text only). */
  tts(text: string, opts?: { whisper?: boolean }): Promise<Uint8Array | null>;
  /** 16 kHz mono PCM16 WAV to text. "" = nothing said, null = failed. */
  transcribe(wav: Uint8Array): Promise<string | null>;
  voiceStats(stats: Record<string, unknown>): Promise<void>;
}

/** Audio adapter used by the voice conversation (bring your own for Expo or another audio stack). */
export interface OryksaAudio {
  /** onChunk receives PCM16 little-endian mono 16 kHz. Resolves false when the mic is not available. */
  startMic(onChunk: (pcm: Uint8Array) => void): Promise<boolean>;
  stopMic(): Promise<void>;
  /** Plays MP3 bytes; resolves when it finished or was stopped. */
  play(mp3: Uint8Array): Promise<void>;
  stopPlayback(): Promise<void>;
}

/** The default adapter: react-native-live-audio-stream + react-native-sound + react-native-fs (null if not installed). */
export declare function createDefaultAudio(): OryksaAudio | null;

export type OryksaVoicePhase = "starting" | "listening" | "hearing" | "thinking" | "speaking" | "muted" | "micError" | "noisy" | "notUnderstood";

/** The ORYKSA voice conversation: the same behaviour as the ORYKSA app (only a human voice cuts her off). */
export declare class OryksaVoiceController {
  constructor(opts: {
    client: OryksaClient;
    audio?: OryksaAudio | null;
    appContext?: () => OryksaAppContext | undefined;
    onUserText?: (text: string) => void;
    onReply?: (text: string) => void;
    onPhase?: (phase: OryksaVoicePhase, controller: OryksaVoiceController) => void;
  });
  phase: OryksaVoicePhase;
  lastReply: string;
  /** What she said out loud last (the short spoken version of lastReply). */
  lastSpoken: string;
  lastHeard: string;
  start(): Promise<void>;
  sendNow(): void;
  say(text: string): Promise<void>;
  toggleMute(): Promise<void>;
  close(): Promise<void>;
}

/** The ORYKSA voice engine (line by line port of the ORYKSA app engine). */
export declare class Vad {
  constructor(sampleRate?: number);
  static bargeFloor: number;
  static tetoOuvir: number;
  static bargeVozMin: number;
  static quietToCloseMs: number;
  static maxSpeechMs: number;
  static periodicidade(chunk: Uint8Array): number;
  static rmsOf(chunk: Uint8Array): number;
  readonly foiSussurro: boolean;
  capturing: boolean;
  reset(): void;
  newTurn(): void;
  feed(chunk: Uint8Array, speaking?: boolean): { isCapturing: boolean; isDone: boolean; isBargeIn: boolean; spokeMs: number; enough: boolean; isNoise: boolean; level: number };
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

interface OryksaChatVoiceProps {
  /** Where the customer is in your app right now (sent with each message). */
  appContext?: () => OryksaAppContext | undefined;
  /** Shows the microphone when the plan has voice (default true). */
  voice?: boolean;
  /** Audio adapter (default: createDefaultAudio()). */
  audio?: OryksaAudio | null;
  /** What your app does with a link the AI gave: return true when your app opened it, false to let the system open it. */
  onLink?: OryksaLinkHandler;
}

export declare function OryksaChat(props: { client: OryksaClient; lang?: OryksaLang; theme?: OryksaTheme; onClose?: () => void } & OryksaChatVoiceProps): React.ReactElement;
export declare function OryksaChatModal(props: { client: OryksaClient; lang?: OryksaLang; theme?: OryksaTheme; visible: boolean; onClose: () => void } & OryksaChatVoiceProps): React.ReactElement;
export declare function OryksaChatButton(props: { client: OryksaClient; lang?: OryksaLang; theme?: OryksaTheme; position?: "left" | "right"; style?: StyleProp<ViewStyle> } & OryksaChatVoiceProps): React.ReactElement;
export declare function OryksaVoiceScreen(props: {
  client: OryksaClient; agent: OryksaAgent; visible: boolean; onClose: () => void; lang?: OryksaLang; theme?: OryksaTheme;
  appContext?: () => OryksaAppContext | undefined; onUserText?: (text: string) => void; onReply?: (text: string) => void; audio?: OryksaAudio | null;
  /** What your app does with a link the AI gave; tapping Open on a card closes the voice screen first. */
  onLink?: OryksaLinkHandler;
}): React.ReactElement;

/** The card under a reply for one link: the picture and title of the page and an Open button. */
export declare function OryksaLinkCard(props: {
  url: string; client: OryksaClient; openLabel?: string; onLink?: OryksaLinkHandler; onOpened?: () => void;
  theme?: OryksaTheme & { line?: string }; style?: StyleProp<ViewStyle>;
}): React.ReactElement;

/** The distinct web links of text, in order, without the final punctuation (at most max, 3 by default). */
export declare function linksIn(text: string, max?: number): string[];

/** text without its web links (what the voice screen shows while she speaks). */
export declare function withoutLinks(text: string): string;

/** Opens a link: handler first (true = your app opened it), then the system (Linking.openURL). */
export declare function openLink(url: string, handler?: OryksaLinkHandler): void;
