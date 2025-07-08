import { sendOffscreenMessage } from "./message";

let creatingOffScreen: Promise<void> | null = null;

async function setupOffscreenDocument(path: string) {
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) {
    return;
  }

  // create offscreen document
  if (creatingOffScreen) {
    await creatingOffScreen;
  } else {
    creatingOffScreen = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "to read selected text using OpenAI API",
    });
    await creatingOffScreen;
    creatingOffScreen = null;
    console.log("Created offscreen document");
  }
}

function onInstall() {
  const menuId = chrome.contextMenus.create({
    id: "read-by-chatgpt",
    title: "Read by ChatGPT",
    type: chrome.contextMenus.ItemType.NORMAL,
    contexts: [chrome.contextMenus.ContextType.SELECTION],
  }, () => {
    if (chrome.runtime.lastError?.message) {
      console.error(`Failed to create menu item : ${chrome.runtime.lastError.message}`);
    }
  });
  console.log(`Created menu item : ${menuId}`);
}

function onContextMenuItemClicked(
  info: chrome.contextMenus.OnClickData,
) {
  switch (info.menuItemId) {
    case "read-by-chatgpt":
      if (info.selectionText) readAloud(info.selectionText);
      break;
  }
}

async function readAloud(text: string) {
  await setupOffscreenDocument("/src/offscreen.html");
  const offscreenResponse = await sendOffscreenMessage({
    type: "audio",
    text: text,
  })
  console.log(offscreenResponse);
}

async function init() {
  chrome.runtime.onInstalled.addListener(onInstall);
  chrome.contextMenus.onClicked.addListener(onContextMenuItemClicked);
}

init();
