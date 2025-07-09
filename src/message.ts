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

export type Message =
  | ConfigUpdateMessage
  | AudioMessage
  | ResponseMessage
  | PlaybackFinishedMessage
  | PauseMessage
  | ResumeMessage
  | ReplayMessage;

export function onMessage(f: (message: Message, sender: MessageSender, sendResponse: (response?: Message) => void) => Promise<Message | void>): void {
  chrome.runtime.onMessage.addListener(f);
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
