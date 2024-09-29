import Browser, { Menus, Tabs } from "webextension-polyfill";
import { Config, configSchema } from "./config";
import { onMessage, sendTabMessage } from "./message";

const CURRENT_CONFIG: Config = {
  apiKey: "",
  model: "tts-1",
  voice: "alloy",
};

function createContextMenus() {
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
  console.log(info, tab);

  if (info.selectionText && tab?.id) {
    console.log(info.selectionText);

    const response = sendTabMessage(tab.id, {
      type: "tts",
      text: info.selectionText,
      config: CURRENT_CONFIG,
    });
    console.log(response);
  }
}

function updateConfig(newConfig: Config) {
  Object.assign(CURRENT_CONFIG, newConfig);
  Browser.storage.local.set(CURRENT_CONFIG);
}

async function init() {
  onMessage(async (message) => {
    switch (message.type) {
      case "config-update":
        updateConfig(message.config);
    }
  });
  Browser.runtime.onInstalled.addListener(async () => {
    createContextMenus();
  });
  Browser.contextMenus.onClicked.addListener(onContextMenuItemClicked);

  try {
    const oldConfig = configSchema.parse(await Browser.storage.local.get());
    Object.assign(CURRENT_CONFIG, oldConfig);
  } catch (e) {
    console.log(e);
  }
}

init();
