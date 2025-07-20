import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sendMessage, onMessage } from '../message';

interface ControlBarState {
  isPlaying: boolean;
  isLoading: boolean;
  isVisible: boolean;
  hasError: boolean;
  isHovered: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
}

interface ControlBarProps {
  className?: string;
}

const ControlBar: React.FC<ControlBarProps> = ({ className }) => {
  const [state, setState] = useState<ControlBarState>({
    isPlaying: false,
    isLoading: false,
    isVisible: false,
    hasError: false,
    isHovered: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1
  });

  const hideTimeoutRef = useRef<number | null>(null);
  const lastMouseXRef = useRef<number>(0);
  const PROXIMITY_THRESHOLD = 100;

  const updateState = useCallback((newState: Partial<ControlBarState>) => {
    setState(prev => ({ ...prev, ...newState }));
  }, []);

  const sendMessageWithRetry = useCallback(async (message: any, maxRetries = 3): Promise<void> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await sendMessage(message);
        updateState({ hasError: false });
        return;
      } catch (error) {
        console.warn(`Message send attempt ${i + 1} failed:`, error);
        if (i === maxRetries - 1) {
          updateState({ hasError: true });
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }, [updateState]);

  const handlePlayPause = useCallback(async () => {
    if (state.isLoading) return;

    try {
      updateState({ isLoading: true });
      
      const message = state.isPlaying 
        ? { type: "pause" as const }
        : { type: "resume" as const };
      
      await sendMessageWithRetry(message);
      updateState({ 
        isPlaying: !state.isPlaying,
        isLoading: false 
      });
    } catch (error) {
      updateState({ isLoading: false });
      console.error('Play/Pause error:', error);
    }
  }, [state.isPlaying, state.isLoading, sendMessageWithRetry, updateState]);

  const handleReplay = useCallback(async () => {
    if (state.isLoading) return;

    try {
      updateState({ isLoading: true });
      await sendMessageWithRetry({ type: "replay" });
      updateState({ 
        isPlaying: true,
        isLoading: false,
        currentTime: 0
      });
    } catch (error) {
      updateState({ isLoading: false });
      console.error('Replay error:', error);
    }
  }, [state.isLoading, sendMessageWithRetry, updateState]);

  const handleSeek = useCallback(async (seconds: number) => {
    if (state.isLoading) return;

    try {
      updateState({ isLoading: true });
      await sendMessageWithRetry({ type: "seek", seconds });
      updateState({ isLoading: false });
    } catch (error) {
      updateState({ isLoading: false });
      console.error('Seek error:', error);
    }
  }, [state.isLoading, sendMessageWithRetry, updateState]);

  const handleSpeedChange = useCallback(async (rate: number) => {
    if (state.isLoading) return;

    try {
      await sendMessageWithRetry({ type: "speed", rate });
      updateState({ playbackRate: rate });
    } catch (error) {
      console.error('Speed change error:', error);
    }
  }, [state.isLoading, sendMessageWithRetry, updateState]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const showControlBar = useCallback(() => {
    updateState({ isVisible: true });
    clearHideTimeout();
  }, [updateState, clearHideTimeout]);

  const hideControlBar = useCallback(() => {
    if (!state.isHovered) {
      updateState({ isVisible: false });
    }
  }, [state.isHovered, updateState]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const windowWidth = window.innerWidth;
    const mouseX = e.clientX;
    const distanceFromRight = windowWidth - mouseX;
    
    lastMouseXRef.current = mouseX;

    if (distanceFromRight <= PROXIMITY_THRESHOLD) {
      if (!state.isVisible) {
        showControlBar();
      }
    } else {
      if (state.isVisible && !state.isHovered) {
        hideControlBar();
      }
    }
  }, [state.isVisible, state.isHovered, showControlBar, hideControlBar]);

  const handleControlBarEnter = useCallback(() => {
    updateState({ isHovered: true });
    clearHideTimeout();
  }, [updateState, clearHideTimeout]);

  const handleControlBarLeave = useCallback(() => {
    updateState({ isHovered: false });
    setTimeout(() => {
      const windowWidth = window.innerWidth;
      const distanceFromRight = windowWidth - lastMouseXRef.current;
      if (distanceFromRight > PROXIMITY_THRESHOLD) {
        hideControlBar();
      }
    }, 50);
  }, [updateState, hideControlBar]);

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.altKey && e.key === 'p') {
      e.preventDefault();
      handlePlayPause();
    } else if (e.altKey && e.key === 'r') {
      e.preventDefault();
      handleReplay();
    } else if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      handleSeek(-10);
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      handleSeek(10);
    }
  }, [handlePlayPause, handleReplay, handleSeek]);

  const handleMessage = useCallback(async (message: any): Promise<void> => {
    switch (message.type) {
      case 'playback-finished':
        updateState({ isPlaying: false });
        break;
      case 'playback-started':
        updateState({ isPlaying: true });
        break;
      case 'playback-paused':
        updateState({ isPlaying: false });
        break;
      case 'playback-resumed':
        updateState({ isPlaying: true });
        break;
      case 'playback-error':
        updateState({ 
          isPlaying: false,
          hasError: true 
        });
        break;
      case 'playback-progress':
        updateState({ 
          currentTime: message.currentTime,
          duration: message.duration 
        });
        break;
    }
  }, [updateState]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeydown);
    
    onMessage(handleMessage);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeydown);
      clearHideTimeout();
    };
  }, [handleMouseMove, handleKeydown, handleMessage, clearHideTimeout]);

  const containerClasses = [
    'read-by-ai-control-bar',
    state.isVisible && 'visible',
    state.hasError && 'error',
    className
  ].filter(Boolean).join(' ');

  const statusClasses = [
    'status-indicator',
    state.hasError && 'error',
    state.isLoading && 'loading',
    state.isPlaying && 'playing'
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={containerClasses}
      onMouseEnter={handleControlBarEnter}
      onMouseLeave={handleControlBarLeave}
      role="toolbar" 
      aria-label="Audio playback controls"
    >
      <div className={statusClasses} aria-live="polite"></div>
      
      {/* Progress info */}
      {state.duration > 0 && (
        <div className="progress-info">
          <span className="time-display">
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(state.currentTime / state.duration) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Seek backward button */}
      <button 
        onClick={() => handleSeek(-10)}
        disabled={state.isLoading}
        type="button" 
        aria-label="Seek backward 10 seconds"
        className="seek-button"
      >
        <span className="button-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <g transform="scale(-1,1)" transform-origin="center">
              <path d="M11.596 8.697l-6.363 3.692A.5.5 0 0 1 4.5 11.95V4.05a.5.5 0 0 1 .733-.44l6.363 3.692a.5.5 0 0 1 0 .88z"/>
              <path d="M11.5 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5z"/>
            </g>
          </svg>
        </span>
      </button>
      
      {/* Play/Pause button */}
      <button 
        onClick={handlePlayPause}
        disabled={state.isLoading}
        type="button" 
        aria-label={state.isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {state.isLoading ? (
          <span className="loading-spinner">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 0 8 8A8 8 0 0 0 8 0zm0 14a6 6 0 1 1 6-6 6 6 0 0 1-6 6z" opacity="0.3"/>
              <path d="M8 0a8 8 0 0 1 8 8h-2a6 6 0 0 0-6-6z">
                <animateTransform attributeName="transform" type="rotate" values="0 8 8;360 8 8" dur="1s" repeatCount="indefinite"/>
              </path>
            </svg>
          </span>
        ) : (
          <span className="button-icon">
            {state.isPlaying ? (
              <svg className="icon-pause" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z"/>
              </svg>
            ) : (
              <svg className="icon-play" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M6.271 5.055a.5.5 0 0 1 .52.038L11 7.051a.5.5 0 0 1 0 .898L6.791 9.907a.5.5 0 0 1-.791-.407V5.5a.5.5 0 0 1 .271-.445z"/>
              </svg>
            )}
          </span>
        )}
      </button>
      
      {/* Seek forward button */}
      <button 
        onClick={() => handleSeek(10)}
        disabled={state.isLoading}
        type="button" 
        aria-label="Seek forward 10 seconds"
        className="seek-button"
      >
        <span className="button-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.404 8.697l6.363 3.692a.5.5 0 0 0 .733-.44V4.05a.5.5 0 0 0-.733-.44L4.404 7.303a.5.5 0 0 0 0 .88z"/>
            <path d="M4.5 4a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 1 0v-7a.5.5 0 0 0-.5-.5z"/>
          </svg>
        </span>
      </button>
      
      {/* Replay button */}
      <button 
        onClick={handleReplay}
        disabled={state.isLoading}
        type="button" 
        aria-label="Replay audio"
      >
        <span className="button-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
            <path d="M8 4.466V2.534a.25.25 0 0 0-.41-.192L5.23 4.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 6.466V4.466z"/>
          </svg>
        </span>
      </button>
      
      {/* Speed control */}
      <div className="speed-control">
        <button 
          onClick={() => handleSpeedChange(state.playbackRate === 1 ? 1.5 : state.playbackRate === 1.5 ? 2 : 1)}
          type="button"
          aria-label={`Playback speed: ${state.playbackRate}x`}
          className="speed-button"
        >
          <span className="speed-text">{state.playbackRate}x</span>
        </button>
      </div>
    </div>
  );
};

export default ControlBar;