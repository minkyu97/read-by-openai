import { sendOffscreenMessage } from "./message";
import { getConfig } from "./config";
import OpenAI from "openai";

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

let audioQueue: { sentence: string, audioData: string }[] = [];
let isPlaying = false;

async function processQueue() {
  if (isPlaying || audioQueue.length === 0) {
    return;
  }
  isPlaying = true;
  const { sentence, audioData } = audioQueue.shift()!;

  if (!audioData) {
    isPlaying = false;
    return;
  }

  await setupOffscreenDocument("/src/offscreen.html");
  sendOffscreenMessage({
    type: "audio",
    base64: audioData,
  });
}

function handleRuntimeMessage(
  message: { type: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
) {
  if (message.type === "playback-finished") {
    isPlaying = false;
    processQueue();
  }
}

async function readAloud(text: string) {
  const sentences = text.match(/[^.!?]+(?:[.!?]|$)/g) || [text];
  if (!sentences) {
    return;
  }

  // Reset queue on new request
  audioQueue = [];
  isPlaying = false;

  const config = await getConfig();
  const client = new OpenAI({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  });

  for (const sentence of sentences) {
    try {
      const response = await client.audio.speech.create({
        model: config.model,
        voice: config.voice,
        input: sentence,
      });

      if (!response.ok || !response.body) {
        console.error("Failed to generate audio");
        continue;
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      await new Promise<void>((resolve) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          audioQueue.push({ sentence, audioData: base64data });
          processQueue();
          resolve();
        };
      });
    } catch (error) {
      console.error("Audio generation failed:", error);
    }
  }
}

async function init() {
  chrome.runtime.onInstalled.addListener(onInstall);
  chrome.contextMenus.onClicked.addListener(onContextMenuItemClicked);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
}

init();
