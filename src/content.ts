import { sendMessage, onMessage } from "./message";

interface ControlBarState {
  isPlaying: boolean;
  isLoading: boolean;
  isVisible: boolean;
  hasError: boolean;
  isHovered: boolean;
}

class ReadByAIControlBar {
  private state: ControlBarState = {
    isPlaying: false,
    isLoading: false,
    isVisible: false,
    hasError: false,
    isHovered: false
  };

  private hideTimeout: number | null = null;
  private readonly PROXIMITY_THRESHOLD = 100; // pixels from right edge
  private lastMouseX: number = 0;

  private elements: {
    container?: HTMLElement;
    playPauseButton?: HTMLButtonElement;
    replayButton?: HTMLButtonElement;
    statusIndicator?: HTMLElement;
  } = {};

  private readonly controlBarHtml = `
    <div id="read-by-ai-control-bar" role="toolbar" aria-label="Audio playback controls">
      <div id="read-by-ai-status" class="status-indicator" aria-live="polite"></div>
      <button id="read-by-ai-play-pause" type="button" aria-label="Play/Pause audio">
        <span class="button-icon">
          <svg class="icon-pause" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z"/>
          </svg>
          <svg class="icon-play" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="display: none;">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M6.271 5.055a.5.5 0 0 1 .52.038L11 7.051a.5.5 0 0 1 0 .898L6.791 9.907a.5.5 0 0 1-.791-.407V5.5a.5.5 0 0 1 .271-.445z"/>
          </svg>
        </span>
        <span class="loading-spinner" style="display: none;">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 1 0 8 8A8 8 0 0 0 8 0zm0 14a6 6 0 1 1 6-6 6 6 0 0 1-6 6z" opacity="0.3"/>
            <path d="M8 0a8 8 0 0 1 8 8h-2a6 6 0 0 0-6-6z">
              <animateTransform attributeName="transform" type="rotate" values="0 8 8;360 8 8" dur="1s" repeatCount="indefinite"/>
            </path>
          </svg>
        </span>
      </button>
      <button id="read-by-ai-replay" type="button" aria-label="Replay audio">
        <span class="button-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
            <path d="M8 4.466V2.534a.25.25 0 0 0-.41-.192L5.23 4.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 6.466V4.466z"/>
          </svg>
        </span>
      </button>
    </div>
  `;

  private readonly controlBarCss = `
    #read-by-ai-control-bar {
      position: fixed;
      right: 0;
      top: 50%;
      transform: translateY(-50%) translateX(100%);
      width: 48px;
      background: linear-gradient(145deg, #ffffff, #f0f0f0);
      border: 1px solid #ddd;
      border-right: none;
      border-radius: 8px 0 0 8px;
      box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      padding: 8px 0;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }

    #read-by-ai-control-bar.visible {
      transform: translateY(-50%) translateX(0);
      pointer-events: auto;
    }

    #read-by-ai-control-bar.visible:hover {
      width: 52px;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    }

    #read-by-ai-control-bar.peek {
      transform: translateY(-50%) translateX(calc(100% - 8px));
      pointer-events: none;
      opacity: 0.6;
    }

    #read-by-ai-control-bar.error {
      background: linear-gradient(145deg, #ffebee, #ffcdd2);
      border-color: #f44336;
    }

    .status-indicator {
      height: 3px;
      background: #4caf50;
      margin: 0 8px 4px 8px;
      border-radius: 2px;
      transition: background-color 0.3s ease;
    }

    .status-indicator.playing {
      background: #2196f3;
      animation: pulse 2s infinite;
    }

    .status-indicator.error {
      background: #f44336;
    }

    .status-indicator.loading {
      background: linear-gradient(90deg, #ff9800, #ffc107, #ff9800);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    #read-by-ai-control-bar button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px 0;
      text-align: center;
      position: relative;
      transition: all 0.2s ease;
      border-radius: 4px;
      margin: 2px 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #333;
    }

    #read-by-ai-control-bar button svg {
      width: 16px;
      height: 16px;
      transition: all 0.2s ease;
    }

    #read-by-ai-control-bar button:hover {
      background-color: rgba(0, 0, 0, 0.08);
      transform: scale(1.05);
    }

    #read-by-ai-control-bar button:active {
      transform: scale(0.95);
    }

    #read-by-ai-control-bar button:focus {
      outline: 2px solid #2196f3;
      outline-offset: 2px;
    }

    #read-by-ai-control-bar button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    #read-by-ai-control-bar button:disabled:hover {
      background: none;
      transform: none;
    }

    .loading-spinner {
      animation: spin 1s linear infinite;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    /* Hover area for mouse detection */
    #read-by-ai-hover-area {
      position: fixed;
      right: 0;
      top: 0;
      width: 20px;
      height: 100%;
      z-index: 9999;
      pointer-events: auto;
    }

    @media (max-width: 768px) {
      #read-by-ai-control-bar {
        width: 44px;
        top: 20%;
      }
      
      #read-by-ai-control-bar button {
        padding: 6px 0;
      }
      
      #read-by-ai-control-bar button svg {
        width: 14px;
        height: 14px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      #read-by-ai-control-bar,
      #read-by-ai-control-bar button,
      .status-indicator {
        transition: none;
      }
      
      .loading-spinner svg {
        animation: none;
      }
      
      .loading-spinner svg animateTransform {
        animation: none;
      }
      
      .status-indicator.playing {
        animation: none;
      }
    }

    @media (prefers-color-scheme: dark) {
      #read-by-ai-control-bar {
        background: linear-gradient(145deg, #2d2d2d, #1a1a1a);
        border-color: #404040;
        color: #ffffff;
      }
      
      #read-by-ai-control-bar button {
        color: #ffffff;
      }
      
      #read-by-ai-control-bar button:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }
  `;

  private async sendMessageWithRetry(message: any, maxRetries = 3): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await sendMessage(message);
        this.updateState({ hasError: false });
        return;
      } catch (error) {
        console.warn(`Message send attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) {
          this.updateState({ hasError: true });
          this.showError("Connection failed. Please try again.");
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }

  private updateState(newState: Partial<ControlBarState>): void {
    this.state = { ...this.state, ...newState };
    this.updateUI();
  }

  private updateUI(): void {
    const { container, playPauseButton, statusIndicator } = this.elements;
    
    if (!container || !playPauseButton || !statusIndicator) return;

    // Update container classes
    container.classList.toggle('error', this.state.hasError);
    container.classList.toggle('visible', this.state.isVisible);

    // Update play/pause button
    const buttonIcon = playPauseButton.querySelector('.button-icon') as HTMLElement;
    const loadingSpinner = playPauseButton.querySelector('.loading-spinner') as HTMLElement;
    
    if (buttonIcon && loadingSpinner) {
      if (this.state.isLoading) {
        buttonIcon.style.display = 'none';
        loadingSpinner.style.display = 'block';
        playPauseButton.disabled = true;
      } else {
        buttonIcon.style.display = 'flex';
        loadingSpinner.style.display = 'none';
        playPauseButton.disabled = false;
        
        // Toggle play/pause icons
        const playIcon = buttonIcon.querySelector('.icon-play') as HTMLElement;
        const pauseIcon = buttonIcon.querySelector('.icon-pause') as HTMLElement;
        
        if (playIcon && pauseIcon) {
          if (this.state.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
          } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
          }
        }
      }
    }

    // Update aria-label
    playPauseButton.setAttribute('aria-label', 
      this.state.isPlaying ? 'Pause audio' : 'Play audio'
    );

    // Update status indicator
    statusIndicator.className = 'status-indicator';
    if (this.state.hasError) {
      statusIndicator.classList.add('error');
    } else if (this.state.isLoading) {
      statusIndicator.classList.add('loading');
    } else if (this.state.isPlaying) {
      statusIndicator.classList.add('playing');
    }
  }

  private showError(message: string): void {
    const statusIndicator = this.elements.statusIndicator;
    if (statusIndicator) {
      statusIndicator.setAttribute('aria-label', message);
      statusIndicator.title = message;
    }
  }

  private setupEventListeners(): void {
    const { playPauseButton, replayButton, container } = this.elements;

    if (playPauseButton) {
      playPauseButton.addEventListener('click', this.handlePlayPause.bind(this));
    }

    if (replayButton) {
      replayButton.addEventListener('click', this.handleReplay.bind(this));
    }

    // Mouse proximity detection
    document.addEventListener('mousemove', (e) => {
      this.lastMouseX = e.clientX;
      this.handleMouseMove(e);
    });
    
    // Control bar hover events
    if (container) {
      container.addEventListener('mouseenter', this.handleControlBarEnter.bind(this));
      container.addEventListener('mouseleave', this.handleControlBarLeave.bind(this));
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        this.handlePlayPause();
      } else if (e.altKey && e.key === 'r') {
        e.preventDefault();
        this.handleReplay();
      }
    });

    // Message listener
    onMessage(this.handleMessage.bind(this));
  }

  private async handlePlayPause(): Promise<void> {
    if (this.state.isLoading) return;

    try {
      this.updateState({ isLoading: true });
      
      const message = this.state.isPlaying 
        ? { type: "pause" as const }
        : { type: "resume" as const };
      
      await this.sendMessageWithRetry(message);
      this.updateState({ 
        isPlaying: !this.state.isPlaying,
        isLoading: false 
      });
    } catch (error) {
      this.updateState({ isLoading: false });
      console.error('Play/Pause error:', error);
    }
  }

  private async handleReplay(): Promise<void> {
    if (this.state.isLoading) return;

    try {
      this.updateState({ isLoading: true });
      await this.sendMessageWithRetry({ type: "replay" });
      this.updateState({ 
        isPlaying: true,
        isLoading: false 
      });
    } catch (error) {
      this.updateState({ isLoading: false });
      console.error('Replay error:', error);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const windowWidth = window.innerWidth;
    const mouseX = e.clientX;
    const distanceFromRight = windowWidth - mouseX;

    // Show control bar when mouse is close to right edge
    if (distanceFromRight <= this.PROXIMITY_THRESHOLD) {
      if (!this.state.isVisible) {
        this.showControlBar();
      }
    } else {
      // Immediately hide when cursor leaves hover area
      if (this.state.isVisible && !this.state.isHovered) {
        this.hideControlBar();
      }
    }

    // Peek effect when mouse is very close but bar is hidden
    if (distanceFromRight <= 30 && !this.state.isVisible) {
      this.peekControlBar();
    } else if (distanceFromRight > 30 && !this.state.isVisible) {
      this.hidePeek();
    }
  }

  private handleControlBarEnter(): void {
    this.updateState({ isHovered: true });
    this.clearHideTimeout();
  }

  private handleControlBarLeave(): void {
    this.updateState({ isHovered: false });
    // Small delay to allow mouse to move to proximity area
    setTimeout(() => {
      const windowWidth = window.innerWidth;
      const distanceFromRight = windowWidth - this.getLastMouseX();
      if (distanceFromRight > this.PROXIMITY_THRESHOLD) {
        this.hideControlBar();
      }
    }, 50);
  }

  private showControlBar(): void {
    this.updateState({ isVisible: true });
    this.clearHideTimeout();
  }

  private hideControlBar(): void {
    if (!this.state.isHovered) {
      this.updateState({ isVisible: false });
    }
  }

  private peekControlBar(): void {
    const { container } = this.elements;
    if (container && !this.state.isVisible) {
      container.classList.add('peek');
    }
  }

  private hidePeek(): void {
    const { container } = this.elements;
    if (container) {
      container.classList.remove('peek');
    }
  }

  private getLastMouseX(): number {
    return this.lastMouseX;
  }

  private clearHideTimeout(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }


  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'playback-finished':
        this.updateState({ isPlaying: false });
        break;
      case 'playback-started':
        this.updateState({ isPlaying: true });
        break;
      case 'playback-paused':
        this.updateState({ isPlaying: false });
        break;
      case 'playback-resumed':
        this.updateState({ isPlaying: true });
        break;
      case 'playback-error':
        this.updateState({ 
          isPlaying: false,
          hasError: true 
        });
        this.showError(message.error || 'Playback error occurred');
        break;
    }
  }

  public init(): void {
    // Prevent multiple initialization
    if (document.getElementById('read-by-ai-control-bar')) {
      return;
    }

    // Inject CSS
    const styleTag = document.createElement('style');
    styleTag.textContent = this.controlBarCss;
    document.head.appendChild(styleTag);

    // Inject HTML
    const body = document.body;
    const controlBarContainer = document.createElement('div');
    controlBarContainer.innerHTML = this.controlBarHtml;
    body.appendChild(controlBarContainer);

    // Cache elements
    this.elements = {
      container: document.getElementById('read-by-ai-control-bar') as HTMLElement,
      playPauseButton: document.getElementById('read-by-ai-play-pause') as HTMLButtonElement,
      replayButton: document.getElementById('read-by-ai-replay') as HTMLButtonElement,
      statusIndicator: document.getElementById('read-by-ai-status') as HTMLElement,
    };

    // Setup event listeners
    this.setupEventListeners();

    // Initial UI update
    this.updateUI();
  }

  public destroy(): void {
    this.clearHideTimeout();
    
    const container = document.getElementById('read-by-ai-control-bar');
    if (container) {
      container.remove();
    }
    
    const hoverArea = document.getElementById('read-by-ai-hover-area');
    if (hoverArea) {
      hoverArea.remove();

    }
    
    const styleTag = document.querySelector('style[data-read-by-ai]');
    if (styleTag) {
      styleTag.remove();
    }
  }
}

// Global instance
let controlBarInstance: ReadByAIControlBar | null = null;

function initializeControlBar(): void {
  if (controlBarInstance) {
    controlBarInstance.destroy();
  }
  
  controlBarInstance = new ReadByAIControlBar();
  controlBarInstance.init();
}

// Initialize control bar when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeControlBar);
} else {
  initializeControlBar();
}

// Reinitialize on navigation for SPAs
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(initializeControlBar, 100);
  }
}).observe(document, { subtree: true, childList: true });