import { Message, sendOffscreenMessage } from "./message";
import { getConfig } from "./config";
import OpenAI from "openai";

import {LRUCache} from 'lru-cache';

enum OffscreenStatus {
  PLAYING,
  PAUSED,
  FINISHED,
}
const OFFSCREEN_PATH = "src/offscreen.html"

let creatingOffScreen: Promise<void> | null = null;
let cache = new LRUCache({
  max: 1000,
  maxSize: 100_000_000,
  sizeCalculation: (value: string, key: string) => {
    return (key.length + value.length) * 2;
  }
});
let textQueue: string[] = [];
let textPointer = 0;
let playbackStatus = OffscreenStatus.FINISHED;

async function offscreenExist() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });

  return existingContexts.length > 0;
}

async function setupOffscreenDocument() {
  // Check all windows controlled by the service worker to see if one
  // of them is the offscreen document with the given path
  if (await offscreenExist()) return;

  // create offscreen document
  if (creatingOffScreen) {
    await creatingOffScreen;
  } else {
    creatingOffScreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
      justification: "to read selected text using OpenAI API",
    });
    await creatingOffScreen;
    creatingOffScreen = null;
    console.log("Created offscreen document");
  }
}

async function readNextLine() {
  if (textPointer == textQueue.length) {
    return;
  }

  await setupOffscreenDocument();
  await sendOffscreenMessage({
    type: "audio",
    base64: cache.get(textQueue[textPointer++]) ?? "",
  });
}

async function tryNextLine() {
  if (playbackStatus == OffscreenStatus.PLAYING || playbackStatus == OffscreenStatus.PAUSED) {
    return;
  }
  playbackStatus = OffscreenStatus.PLAYING;
  await readNextLine();
}

async function generateAudio(sentence: string) {
  if (cache.has(sentence)) {
    return;
  }
  const config = await getConfig();
  const client = new OpenAI({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.audio.speech.create({
    model: config.model,
    voice: config.voice,
    input: sentence,
  });

  if (!response.ok || !response.body) {
    throw new Error("Failed to call OpenAI API");
  }

  const blob = await response.blob();
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  await new Promise<void>((resolve) => {
    reader.onloadend = () => {
      const base64data = reader.result as string;
      cache.set(sentence, base64data);
      resolve();
    };
  });
}

async function readAloud(text: string) {
  const segmenter = new Intl.Segmenter(undefined, {granularity: 'sentence'});
  const sentences = Array.from(segmenter.segment(text)).map(s => s.segment);
  if (!sentences) {
    return;
  }

  // Reset queue on new request
  textQueue = Array.from(sentences);
  await playFromFirstLine();
}

async function playFromFirstLine() {
  textPointer = 0;

  for (const sentence of textQueue) {
    try {
      await generateAudio(sentence);
    } catch (error) {
      console.error("Audio generation failed:", error);
    }
    await tryNextLine();
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

async function handleRuntimeMessage(
  message: Message,
) {
  switch (message.type) {
    case "playback-finished":
      playbackStatus = OffscreenStatus.FINISHED;
      await tryNextLine();
      break;
    case "pause":
      await sendOffscreenMessage({ type: "pause" });
      playbackStatus = OffscreenStatus.PAUSED;
      break;
    case "resume":
      if (playbackStatus != OffscreenStatus.PAUSED) {
        return;
      }
      playbackStatus = OffscreenStatus.PLAYING;
      await sendOffscreenMessage({ type: "resume" });
      await tryNextLine(); // Try to resume playback immediately
      break;
    case "replay":
      await sendOffscreenMessage({ type: "pause" });
      await playFromFirstLine();
      break;
  }
}

async function init() {
  chrome.runtime.onInstalled.addListener(onInstall);
  chrome.contextMenus.onClicked.addListener(onContextMenuItemClicked);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
}

init();
