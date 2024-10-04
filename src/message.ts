import Browser from "webextension-polyfill";
import { Config } from "./config";

type ConfigUpdateMessage = {
  type: "config-update";
  config: Config;
};

type TtsMessage = {
  type: "tts";
  text: string;
  config: Config;
};

type StartMessage = {
  type: "start";
};

type AudioChunkMessage = {
  type: "audio-chunk";
  chunk: number[];
};

type EndMessage = {
  type: "end";
};

export type Message =
  | ConfigUpdateMessage
  | TtsMessage
  | AudioChunkMessage
  | StartMessage
  | EndMessage;

export function onMessage(f: (message: Message) => Promise<Message | void>): void {
  Browser.runtime.onMessage.addListener(f);
}

export async function sendMessage(message: Message): Promise<Message | undefined> {
  return await Browser.runtime.sendMessage(message);
}

export async function sendTabMessage(tabId: number, message: Message): Promise<Message | undefined> {
  return await Browser.tabs.sendMessage(tabId, message);
}
