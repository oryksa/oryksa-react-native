/*!
 * @oryksa/react-native - Official React Native SDK for ORYKSA AI Employees.
 * Docs: https://developer.oryksa.com   License: MIT
 */
"use strict";

const client = require("./client");
const chat = require("./chat");
const voice = require("./voice");
const voiceScreen = require("./voice-screen");
const vad = require("./vad");
const profanity = require("./profanity");
const links = require("./links");
const linkCard = require("./link-card");
const attach = require("./attach");

module.exports = {
  OryksaClient: client.OryksaClient,
  OryksaError: client.OryksaError,
  VERSION: client.VERSION,
  OryksaChat: chat.OryksaChat,
  OryksaChatModal: chat.OryksaChatModal,
  OryksaChatButton: chat.OryksaChatButton,
  DEFAULT_THEME: chat.DEFAULT_THEME,
  OryksaVoiceController: voice.OryksaVoiceController,
  OryksaVoiceScreen: voiceScreen.OryksaVoiceScreen,
  createDefaultAudio: voice.createDefaultAudio,
  Vad: vad.Vad,
  maskProfanity: profanity.mask,
  loadProfanity: profanity.load,
  OryksaLinkCard: linkCard.OryksaLinkCard,
  linksIn: links.linksIn,
  withoutLinks: links.withoutLinks,
  openLink: links.openLink,
  createDefaultPicker: attach.createDefaultPicker,
  photoAttachment: attach.photoAttachment,
  documentAttachment: attach.documentAttachment,
  MAX_PHOTO_BYTES: attach.MAX_PHOTO_BYTES,
  MAX_FILE_BYTES: attach.MAX_FILE_BYTES,
};
