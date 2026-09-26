/*!
 * @oryksa/react-native - Official React Native SDK for ORYKSA AI Employees.
 * Docs: https://developer.oryksa.com   License: MIT
 */
"use strict";

const client = require("./client");
const chat = require("./chat");

module.exports = {
  OryksaClient: client.OryksaClient,
  OryksaError: client.OryksaError,
  VERSION: client.VERSION,
  OryksaChat: chat.OryksaChat,
  OryksaChatModal: chat.OryksaChatModal,
  OryksaChatButton: chat.OryksaChatButton,
  DEFAULT_THEME: chat.DEFAULT_THEME,
};
