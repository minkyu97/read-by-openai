import Browser, { Menus, Tabs } from "webextension-polyfill";
import { Config, configSchema } from "./config";
import { onMessage, sendTabMessage } from "./message";

let CURRENT_CONFIG: Config | undefined;

async function getConfig(): Promise<Config> {
  return CURRENT_CONFIG ?? configSchema.parse(await Browser.storage.local.get());
}

async function onInstall() {
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

    const response = await sendTabMessage(tab.id, {
      type: "tts",
      text: info.selectionText,
      config: await getConfig(),
    });
    console.log(response);
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
