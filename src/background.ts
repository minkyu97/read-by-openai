import { Message, sendOffscreenMessage } from "./message";
import { getConfig } from "./config";
import OpenAI from "openai";
import { LRUCache } from 'lru-cache';

enum OffscreenStatus {
  PLAYING,
  PAUSED,
  FINISHED,
}

class AudioManager {
  private static instance: AudioManager;
  private readonly OFFSCREEN_PATH = "src/offscreen.html";
  private creatingOffScreen: Promise<void> | null = null;
  private cache: LRUCache<string, string>;
  private textQueue: string[] = [];
  private textPointer = 0;
  private playbackStatus = OffscreenStatus.FINISHED;
  private currentTabId: number | null = null;
  private openAIClient: OpenAI | null = null;

  private constructor() {
    this.cache = new LRUCache({
      max: 1000,
      maxSize: 100_000_000,
      sizeCalculation: (value: string, key: string) => {
        return (key.length + value.length) * 2;
      }
    });
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private async initOpenAI(): Promise<void> {
    if (this.openAIClient) return;
    
    const config = await getConfig();
    this.openAIClient = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  public updateCurrentTab(tabId: number): void {
    this.currentTabId = tabId;
  }

  private async offscreenExist(): Promise<boolean> {
    const offscreenUrl = chrome.runtime.getURL(this.OFFSCREEN_PATH);
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl],
    });

    return existingContexts.length > 0;
  }

  private async setupOffscreenDocument(): Promise<void> {
    if (await this.offscreenExist()) return;

    if (this.creatingOffScreen) {
      await this.creatingOffScreen;
    } else {
      this.creatingOffScreen = chrome.offscreen.createDocument({
        url: this.OFFSCREEN_PATH,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: "to read selected text using OpenAI API",
      });
      await this.creatingOffScreen;
      this.creatingOffScreen = null;
      console.log("Created offscreen document");
    }
  }

  private async readNextLine(): Promise<void> {
    if (this.textPointer >= this.textQueue.length) {
      console.log('All sentences have been played');
      return;
    }

    const sentence = this.textQueue[this.textPointer++];
    const audioData = this.cache.get(sentence);
    
    if (!audioData) {
      console.warn('Audio data not found for sentence:', sentence.substring(0, 50));
      // Skip this sentence and try the next one
      await this.tryNextLine();
      return;
    }

    console.log('Playing sentence', this.textPointer, 'of', this.textQueue.length, ':', sentence.substring(0, 50));
    
    await this.setupOffscreenDocument();
    console.log('Sending audio message to offscreen document');
    
    try {
      await sendOffscreenMessage({
        type: "audio",
        base64: audioData,
      });
      console.log('Audio message sent successfully');
    } catch (error) {
      console.error('Error sending audio message:', error);
      throw error;
    }
  }

  private async tryNextLine(): Promise<void> {
    if (this.playbackStatus === OffscreenStatus.PAUSED) {
      console.log('Playback is paused, not starting next line');
      return;
    }
    
    console.log('tryNextLine called, current status:', this.playbackStatus);
    this.playbackStatus = OffscreenStatus.PLAYING;
    await this.readNextLine();
  }

  private async generateAudio(sentence: string): Promise<void> {
    if (this.cache.has(sentence)) {
      console.log('Audio found in cache for sentence:', sentence.substring(0, 50));
      return;
    }
    
    console.log('Generating audio for sentence:', sentence.substring(0, 50));
    
    await this.initOpenAI();
    if (!this.openAIClient) {
      throw new Error('OpenAI client not initialized');
    }

    const config = await getConfig();
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key not configured. Please set it in the extension popup.');
    }
    
    console.log('Calling OpenAI API with config:', { model: config.model, voice: config.voice });
    
    const response = await this.openAIClient.audio.speech.create({
      model: config.model,
      voice: config.voice,
      input: sentence,
    });

    if (!response.ok || !response.body) {
      throw new Error("Failed to call OpenAI API");
    }

    const blob = await response.blob();
    const base64data = await this.blobToBase64(blob);
    this.cache.set(sentence, base64data);
    console.log('Audio generated and cached for sentence:', sentence.substring(0, 50));
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public async readAloud(text: string): Promise<void> {
    try {
      console.log('readAloud called with text:', text);
      
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
      const sentences = Array.from(segmenter.segment(text))
        .map(s => s.segment)
        .filter(s => s.trim().length > 0);
      
      console.log('Segmented sentences:', sentences);
      
      if (sentences.length === 0) {
        console.warn('No sentences found in text');
        return;
      }

      // Reset queue on new request
      this.textQueue = sentences;
      this.playbackStatus = OffscreenStatus.FINISHED; // Start as finished so tryNextLine can proceed
      console.log('Starting playback for', sentences.length, 'sentences');
      
      await this.notifyContentScript({ type: "playback-started" });
      await this.playFromFirstLine();
    } catch (error) {
      console.error('Error in readAloud:', error);
      await this.notifyContentScript({ type: "playback-error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async playFromFirstLine(): Promise<void> {
    this.textPointer = 0;

    try {
      console.log('Starting audio generation for', this.textQueue.length, 'sentences');
      
      // Generate audio for all sentences in parallel
      const audioPromises = this.textQueue.map((sentence, index) => 
        this.generateAudio(sentence).catch(error => {
          console.error(`Audio generation failed for sentence ${index}: "${sentence.substring(0, 50)}"`, error);
          // Don't let one failed sentence stop the others
          return null;
        })
      );
      
      await Promise.all(audioPromises);
      console.log('All audio generation completed');
      
      // Reset status to allow tryNextLine to proceed
      this.playbackStatus = OffscreenStatus.FINISHED;
      await this.tryNextLine();
    } catch (error) {
      console.error('Error in playFromFirstLine:', error);
      await this.notifyContentScript({ type: "playback-error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async notifyContentScript(message: Message): Promise<void> {
    try {
      if (this.currentTabId) {
        await chrome.tabs.sendMessage(this.currentTabId, message);
      } else {
        // Fallback to active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await chrome.tabs.sendMessage(tabs[0].id, message);
        }
      }
    } catch (error) {
      console.log("Could not send message to content script", error);
    }
  }

  public async handleMessage(message: Message, sender?: chrome.runtime.MessageSender): Promise<void> {
    console.log('handleMessage called with:', message.type);
    
    // Update current tab ID if message comes from a content script
    if (sender?.tab?.id) {
      this.currentTabId = sender.tab.id;
    }

    switch (message.type) {
      case "playback-finished":
        console.log('Playback finished, moving to next line');
        this.playbackStatus = OffscreenStatus.FINISHED;
        await this.notifyContentScript({ type: "playback-finished" });
        await this.tryNextLine();
        break;
      case "pause":
        if (this.playbackStatus !== OffscreenStatus.PLAYING) {
          return;
        }
        await sendOffscreenMessage({ type: "pause" });
        this.playbackStatus = OffscreenStatus.PAUSED;
        await this.notifyContentScript({ type: "playback-paused" });
        break;
      case "resume":
        if (this.playbackStatus !== OffscreenStatus.PAUSED) {
          return;
        }
        this.playbackStatus = OffscreenStatus.PLAYING;
        await sendOffscreenMessage({ type: "resume" });
        await this.notifyContentScript({ type: "playback-resumed" });
        await this.tryNextLine();
        break;
      case "replay":
        await sendOffscreenMessage({ type: "pause" });
        this.playbackStatus = OffscreenStatus.PLAYING;
        await this.notifyContentScript({ type: "playback-started" });
        await this.playFromFirstLine();
        break;
      case "config-update":
        // Reset OpenAI client to pick up new config
        this.openAIClient = null;
        break;
    }
  }

  public getPlaybackStatus(): OffscreenStatus {
    return this.playbackStatus;
  }

  public clearCache(): void {
    this.cache.clear();
  }


  public async diagnose(): Promise<void> {
    console.log('=== DIAGNOSTICS ===');
    console.log('PlaybackStatus:', this.playbackStatus);
    console.log('TextQueue length:', this.textQueue.length);
    console.log('TextPointer:', this.textPointer);
    console.log('Cache size:', this.cache.size);
    console.log('CurrentTabId:', this.currentTabId);
    
    const config = await getConfig();
    console.log('Config:', {
      hasApiKey: !!config.apiKey,
      model: config.model,
      voice: config.voice
    });
    
    const offscreenExists = await this.offscreenExist();
    console.log('Offscreen document exists:', offscreenExists);
    console.log('=== END DIAGNOSTICS ===');
  }
}

function onInstall(): void {
  const menuId = chrome.contextMenus.create({
    id: "read-by-chatgpt",
    title: "Read by ChatGPT",
    type: chrome.contextMenus.ItemType.NORMAL,
    contexts: [chrome.contextMenus.ContextType.SELECTION],
  }, () => {
    if (chrome.runtime.lastError?.message) {
      console.error(`Failed to create menu item: ${chrome.runtime.lastError.message}`);
    }
  });
  console.log(`Created menu item: ${menuId}`);
}

function onContextMenuItemClicked(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): void {
  const audioManager = AudioManager.getInstance();
  
  if (tab?.id) {
    audioManager.updateCurrentTab(tab.id);
  }
  
  switch (info.menuItemId) {
    case "read-by-chatgpt":
      if (info.selectionText) {
        audioManager.readAloud(info.selectionText);
      }
      break;
  }
}

async function init(): Promise<void> {
  const audioManager = AudioManager.getInstance();
  
  chrome.runtime.onInstalled.addListener(onInstall);
  chrome.contextMenus.onClicked.addListener(onContextMenuItemClicked);
  chrome.runtime.onMessage.addListener((message, sender) => {
    audioManager.handleMessage(message, sender);
  });
  
  // Add diagnostic command for testing
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'diagnose') {
      audioManager.diagnose();
    }
  });
}

init().catch(console.error);