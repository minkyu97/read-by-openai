type ConfigUpdateMessage = {
  type: "config-update";
};

type AudioMessage = {
  type: "audio";
  text: string;
}

type ResponseMessage = {
  type: "response";
  text: string;
}

export type Message =
  | ConfigUpdateMessage
  | AudioMessage
  | ResponseMessage;

export function onMessage(f: (message: Message) => Promise<Message | void>): void {
  chrome.runtime.onMessage.addListener(f);
}

export async function sendMessage(message: Message): Promise<Message | undefined> {
  return await chrome.runtime.sendMessage(message);
}

export async function sendOffscreenMessage(message: Message): Promise<Message | undefined> {
  return await chrome.runtime.sendMessage({ ...message, target: "offscreen" });
}

export async function sendTabMessage(tabId: number, message: Message): Promise<Message | undefined> {
  return await chrome.tabs.sendMessage(tabId, message);
}
