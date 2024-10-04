import OpenAI from "openai";
import Browser, { Menus, Tabs } from "webextension-polyfill";
import { Config, configSchema } from "./config";
import { onMessage, sendTabMessage } from "./message";

let CURRENT_CONFIG: Config | undefined;

async function getConfig(): Promise<Config> {
  return (
    CURRENT_CONFIG ?? configSchema.parse(await Browser.storage.local.get())
  );
}

async function onInstall() {
  Browser.contextMenus.create({
    id: "read-aloud-legacy",
    title: "Read Aloud (Legacy)",
    type: "normal",
    contexts: ["selection"],
  });
  Browser.contextMenus.create({
    id: "read-aloud",
    title: "Read Aloud",
    type: "normal",
    contexts: ["selection"],
  });
}

async function onContextMenuItemClicked(
  info: Menus.OnClickData,
  tab?: Tabs.Tab
) {
  switch (info.menuItemId) {
    case "read-aloud":
      readAloud(info, tab);
      break;
    case "read-aloud-legacy":
      readAloudLegacy(info, tab);
      break;
  }
}

async function readAloudLegacy(info: Menus.OnClickData, tab?: Tabs.Tab) {
  console.log(info, tab);

  if (info.selectionText && tab?.id) {
    console.log(info.selectionText);

    const response = await sendTabMessage(tab.id, {
      type: "tts",
      text: info.selectionText,
      config: await getConfig(),
    });
    console.log(response);
  }
}

async function readAloud(info: Menus.OnClickData, tab?: Tabs.Tab) {
  console.log(info, tab);

  if (info.selectionText && tab?.id) {
    console.log(info.selectionText);

    const config = await getConfig();

    const client = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await client.audio.speech.create({
      model: config.model,
      voice: config.voice,
      input: info.selectionText,
    });
    console.log(response);

    if (!response.ok || !response.body) {
      alert("Failed to generate audio");
      return;
    }

    await sendTabMessage(tab.id, {
      type: "start",
    });

    const reader = response.body.getReader();
    let done = false;
    let value: Uint8Array | undefined;
    do {
      ({ done, value } = await reader.read());

      if (value) {
        console.log("send");

        await sendTabMessage(tab.id, {
          type: "audio-chunk",
          chunk: Array.from(value),
        });
      }
    } while (!done);

    console.log("end");

    await sendTabMessage(tab.id, {
      type: "end",
    });
  }
}

function updateConfig(newConfig: Config) {
  CURRENT_CONFIG = newConfig;
  Browser.storage.local.set(CURRENT_CONFIG);
}

async function init() {
  onMessage(async (message) => {
    switch (message.type) {
      case "config-update":
        updateConfig(message.config);
    }
  });

  Browser.runtime.onInstalled.addListener(onInstall);
  Browser.contextMenus.onClicked.addListener(onContextMenuItemClicked);
}

init();
