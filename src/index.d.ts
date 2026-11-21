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

/** A photo from the customer (JPEG, PNG or WebP, up to 2 MB). The AI looks at it. */
export interface OryksaImage { base64: string; mime?: string }
/** Options of OryksaClient.ai: your prompt and your JSON Schema live in your app. */
export interface OryksaAiOptions {
  instructions?: string;
  input?: string;
  /** Up to 4 photos (about 1.5 MB each; resize to 1600 px). */
  images?: OryksaImage[];
  /** A JSON Schema: the answer comes back in `json`. */
  schema?: object;
  maxTokens?: number;
  temperature?: number;
}
/** The answer of OryksaClient.ai. */
export interface OryksaAiResult {
  text: string;
  json: Record<string, unknown> | null;
  interactionsSpent: number;
  interactionsRemaining: number | null;
}

/** A document from the customer (PDF, Word, text or CSV, up to 8 MB). The AI reads it. */
export interface OryksaFile { base64: string; name: string; mime?: string }

export interface OryksaSendOptions {
  /** A photo from the customer (sent as image_base64 / image_mime). */
  image?: OryksaImage;
  /** A document from the customer (sent as file_base64 / file_name / file_mime). */
  file?: OryksaFile;
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
  /** An AI task of your own app, counted as ORYKSA interactions (1 per answer). Never creates a conversation. */
  ai(opts: OryksaAiOptions): Promise<OryksaAiResult>;
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
  /** Shows the attach button (photo library, camera, document). Default true; it shows only when a picker is available. */
  attachments?: boolean;
  /** Picker adapter (default: createDefaultPicker()). */
  picker?: OryksaPicker | null;
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

/** What a picker gives back: a photo ({ base64, mime }), a document ({ base64, name, mime } or { tooBig: true }), or null when cancelled. */
export interface OryksaPicked { base64?: string; name?: string; mime?: string; tooBig?: boolean }

/**
 * The pickers of the attach button (bring your own for Expo or another stack). Photos should come made
 * smaller (1600 px, JPEG about 80%). A missing function hides that choice.
 */
export interface OryksaPicker {
  pickPhoto?: (() => Promise<OryksaPicked | null>) | null;
  takePhoto?: (() => Promise<OryksaPicked | null>) | null;
  pickDocument?: (() => Promise<OryksaPicked | null>) | null;
}

/** The default pickers: react-native-image-picker and @react-native-documents/picker when installed (null if neither is). */
export declare function createDefaultPicker(): OryksaPicker | null;

export type OryksaAttachResult = { image: OryksaImage } | { file: OryksaFile } | { error: "big" | "failed" };

/** A picked photo as what the chat sends ({ error: "big" } above 2 MB). */
export declare function photoAttachment(p: OryksaPicked | null): OryksaAttachResult;

/** A picked document as what the chat sends: pictures up to 2 MB as a photo, the rest as a file up to 8 MB. */
export declare function documentAttachment(d: OryksaPicked | null): OryksaAttachResult;

/** 2 MB: the largest photo the chat sends. */
export declare const MAX_PHOTO_BYTES: number;
/** 8 MB: the largest document the chat sends. */
export declare const MAX_FILE_BYTES: number;

/** The distinct web links of text, in order, without the final punctuation (at most max, 3 by default). */
export declare function linksIn(text: string, max?: number): string[];

/** text without its web links (what the voice screen shows while she speaks). */
export declare function withoutLinks(text: string): string;

/** Opens a link: handler first (true = your app opened it), then the system (Linking.openURL). */
export declare function openLink(url: string, handler?: OryksaLinkHandler): void;
