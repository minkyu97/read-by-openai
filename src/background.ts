import { Message, sendOffscreenMessage } from "./message";
import { getConfig } from "./config";
import OpenAI from "openai";

enum PlaybackStatus {
  Playing,
  Paused,
  Finished,
}

let creatingOffScreen: Promise<void> | null = null;
let audioQueue: { sentence: string, audioData: string }[] = [];
let playbackStatus = PlaybackStatus.Finished;

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

async function processQueue() {
  if (playbackStatus == PlaybackStatus.Playing || playbackStatus == PlaybackStatus.Paused || audioQueue.length === 0) {
    return;
  }
  playbackStatus = PlaybackStatus.Playing;
  currentAudio = audioQueue.shift()!; // Set currentAudio
  const { audioData } = currentAudio;

  if (!audioData) {
    playbackStatus = PlaybackStatus.Finished;
    return;
  }

  await setupOffscreenDocument("/src/offscreen.html");
  sendOffscreenMessage({
    type: "audio",
    base64: audioData,
  });
}

let currentAudio: { sentence: string, audioData: string } | null = null;
let lastReadAudioData: { sentence: string, audioData: string }[] = [];

function handleRuntimeMessage(
  message: Message,
) {
  switch (message.type) {
    case "playback-finished":
      playbackStatus = PlaybackStatus.Finished;
      processQueue();
      break;
    case "pause":
      sendOffscreenMessage({ type: "pause" });
      playbackStatus = PlaybackStatus.Paused;
      break;
    case "resume":
      if (playbackStatus != PlaybackStatus.Paused) {
        return;
      }
      playbackStatus = PlaybackStatus.Playing;
      sendOffscreenMessage({ type: "resume" });
      processQueue(); // Try to resume playback immediately
      break;
    case "replay":
      if (lastReadAudioData.length == 0) {
        return;
      }
      audioQueue = [...lastReadAudioData];
      playbackStatus = PlaybackStatus.Finished;
      processQueue();
      break;
  }
}

async function readAloud(text: string) {
  const sentences = text.match(/[^.!?]+(?:[.!?]|$)/g) || [text];
  if (!sentences) {
    return;
  }

  // Reset queue on new request
  audioQueue = [];
  playbackStatus = PlaybackStatus.Finished;
  currentAudio = null;

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
          const newItem = { sentence, audioData: base64data };
          audioQueue.push(newItem);
          lastReadAudioData.push(newItem);
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
