class OffscreenAudioManager {
  private audioTag: HTMLAudioElement | null = null;
  private isPlaying = false;
  private currentAudioUrl: string | null = null;
  private progressInterval: number | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      try {
        switch (message.type) {
          case "audio":
            await this.handleAudio(message.base64, sendResponse);
            break;
          case "pause":
            this.pauseAudio();
            break;
          case "resume":
            await this.resumeAudio();
            break;
          case "seek":
            this.seekAudio(message.seconds);
            break;
          case "speed":
            this.setSpeed(message.rate);
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ type: "error", error: error.message });
      }
    });
  }

  private async handleAudio(base64: string, sendResponse: (response?: any) => void): Promise<void> {
    if (!base64) {
      console.warn('No audio data provided');
      sendResponse({ type: "error", error: "No audio data" });
      return;
    }

    try {
      // Clean up previous audio
      this.cleanup();

      console.log('Playing audio, base64 length:', base64.length);
      
      const blob = await (await fetch(base64)).blob();
      console.log('Blob created, size:', blob.size, 'type:', blob.type);
      
      this.currentAudioUrl = URL.createObjectURL(blob);
      
      this.audioTag = document.createElement("audio");
      this.audioTag.src = this.currentAudioUrl;
      this.audioTag.preload = 'auto';
      this.audioTag.volume = 1.0;
      
      // Set up event listeners
      this.audioTag.addEventListener("ended", () => {
        console.log('Audio ended');
        this.isPlaying = false;
        chrome.runtime.sendMessage({ type: "playback-finished" });
        sendResponse({ type: "response", text: "success" });
        this.cleanup();
      });
      
      this.audioTag.addEventListener("error", (e) => {
        console.error('Audio playback error:', e, this.audioTag?.error);
        this.isPlaying = false;
        sendResponse({ type: "error", error: "Audio playback failed" });
        this.cleanup();
      });
      
      this.audioTag.addEventListener("canplaythrough", () => {
        console.log('Audio ready to play');
      });
      
      this.audioTag.addEventListener("loadstart", () => {
        console.log('Audio load started');
      });
      
      this.audioTag.addEventListener("loadeddata", () => {
        console.log('Audio data loaded');
      });
      
      console.log('Starting audio playback');
      await this.audioTag.play();
      this.isPlaying = true;
      console.log('Audio playback started successfully');
      
      // Start progress tracking
      this.startProgressTracking();
      
    } catch (error) {
      console.error('Error playing audio:', error);
      sendResponse({ type: "error", error: error instanceof Error ? error.message : String(error) });
      this.cleanup();
    }
  }

  private pauseAudio(): void {
    if (this.audioTag && this.isPlaying) {
      this.audioTag.pause();
      this.isPlaying = false;
      console.log('Audio paused');
    }
  }

  private async resumeAudio(): Promise<void> {
    if (this.audioTag && !this.isPlaying) {
      try {
        await this.audioTag.play();
        this.isPlaying = true;
        console.log('Audio resumed');
      } catch (error) {
        console.error('Error resuming audio:', error);
      }
    }
  }


  private seekAudio(seconds: number): void {
    if (this.audioTag) {
      const newTime = Math.max(0, Math.min(this.audioTag.duration, this.audioTag.currentTime + seconds));
      this.audioTag.currentTime = newTime;
      console.log(`Seeking to ${newTime}s`);
    }
  }

  private setSpeed(rate: number): void {
    if (this.audioTag) {
      this.audioTag.playbackRate = rate;
      console.log(`Playback speed set to ${rate}x`);
    }
  }

  private startProgressTracking(): void {
    this.stopProgressTracking();
    
    if (this.audioTag) {
      // Send initial progress
      this.sendProgress();
      
      // Update progress every 200ms
      this.progressInterval = window.setInterval(() => {
        this.sendProgress();
      }, 200);
    }
  }

  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  private sendProgress(): void {
    if (this.audioTag && !isNaN(this.audioTag.duration)) {
      chrome.runtime.sendMessage({
        type: "playback-progress",
        currentTime: this.audioTag.currentTime,
        duration: this.audioTag.duration
      });
    }
  }

  private cleanup(): void {
    this.stopProgressTracking();
    
    if (this.audioTag) {
      this.audioTag.pause();
      this.audioTag.removeEventListener("ended", this.handleAudioEnded);
      this.audioTag.removeEventListener("error", this.handleAudioError);
      this.audioTag = null;
    }
    
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    
    this.isPlaying = false;
  }

  private handleAudioEnded = (): void => {
    console.log('Audio ended');
    this.isPlaying = false;
    chrome.runtime.sendMessage({ type: "playback-finished" });
    this.cleanup();
  };

  private handleAudioError = (e: Event): void => {
    console.error('Audio playback error:', e);
    this.isPlaying = false;
    this.cleanup();
  };
}

// Initialize the audio manager
new OffscreenAudioManager();
