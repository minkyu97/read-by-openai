import { Config } from "./config";
import MessageSender = chrome.runtime.MessageSender;

type ConfigUpdateMessage = {
  type: "config-update";
};

type AudioMessage = {
  type: "audio";
  base64: string;
}

type ResponseMessage = {
  type: "response";
  text: string;
}

type PlaybackFinishedMessage = {
  type: "playback-finished";
}

type PauseMessage = {
  type: "pause";
}

type ResumeMessage = {
  type: "resume";
}

type ReplayMessage = {
  type: "replay";
}

type PlaybackStartedMessage = {
  type: "playback-started";
}

type PlaybackPausedMessage = {
  type: "playback-paused";
}

type PlaybackResumedMessage = {
  type: "playback-resumed";
}

type PlaybackErrorMessage = {
  type: "playback-error";
  error: string;
}

type SeekMessage = {
  type: "seek";
  seconds: number;
}

type SpeedMessage = {
  type: "speed";
  rate: number;
}

type PlaybackProgressMessage = {
  type: "playback-progress";
  currentTime: number;
  duration: number;
}

type NextSentenceMessage = {
  type: "next-sentence";
}

type PrevSentenceMessage = {
  type: "prev-sentence";
}

type SentenceUpdateMessage = {
  type: "sentence-update";
  current: number;
  total: number;
}

type GetConfigMessage = {
  type: "get-config";
}

type ConfigMessage = {
  type: "config";
  config: Config;
}

type DiagnoseMessage = {
  type: "diagnose";
}

export type Message =
  | ConfigUpdateMessage
  | AudioMessage
  | ResponseMessage
  | PlaybackFinishedMessage
  | PlaybackStartedMessage
  | PlaybackPausedMessage
  | PlaybackResumedMessage
  | PlaybackErrorMessage
  | PlaybackProgressMessage
  | PauseMessage
  | ResumeMessage
  | ReplayMessage
  | SeekMessage
  | SpeedMessage
  | NextSentenceMessage
  | PrevSentenceMessage
  | SentenceUpdateMessage
  | GetConfigMessage
  | ConfigMessage
  | DiagnoseMessage;

export function onMessage(
  callback: (message: Message, sender: MessageSender) => Promise<Message | undefined>
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    callback(message, sender).then(response => {
      sendResponse(response);
    });
    return true; // Keep the message channel open for async response
  });
}

export async function sendMessage(message: Message): Promise<Message | undefined> {
  return await chrome.runtime.sendMessage(message);
}

export async function sendOffscreenMessage(message: Message): Promise<any> {
  return await chrome.runtime.sendMessage({ ...message, target: "offscreen" });
}

export async function sendTabMessage(tabId: number, message: Message): Promise<Message | undefined> {
  return await chrome.tabs.sendMessage(tabId, message);
}

export async function getConfigMessage(): Promise<Config> {
  const response = await sendMessage({ type: "get-config" });
  if (response && response.type === "config") {
    return response.config;
  }
  throw new Error("Failed to get config");
}
