# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension called "Read by AI" that uses the OpenAI API to provide text-to-speech functionality. Users can select text on any webpage and have it read aloud using AI-powered voices.

## Common Development Commands

### Build and Development
```bash
# Install dependencies
yarn install

# Start development mode with watch
yarn watch

# Build for production
yarn build

# Type checking
yarn compile

# Start development server (for popup development)
yarn dev
```

### Testing the Extension
1. Run `yarn watch` to build the extension with hot-reload
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` directory
5. The extension will appear in your browser toolbar

## Architecture

### Core Components

1. **Background Service Worker** (`src/background.ts`)
   - Central hub managing audio playback via `AudioManager` singleton
   - Handles context menu integration for text selection
   - Manages offscreen document for audio playback
   - Coordinates between content scripts and offscreen documents
   - Implements audio caching with LRU cache for performance

2. **Content Script** (`src/content.tsx`)
   - Injects React-based control bar into web pages
   - Handles user interactions for audio playback control
   - Communicates with background script for playback state

3. **Offscreen Document** (`src/offscreen.ts`, `src/offscreen.html`)
   - Dedicated context for HTML5 audio playback
   - Required due to Chrome extension restrictions on audio in service workers
   - Manages audio element lifecycle and playback events

4. **Popup Interface** (`src/popup.tsx`)
   - Settings interface for OpenAI API configuration
   - Uses React with TypeScript
   - Persists configuration to IndexedDB

### Message Flow Architecture

The extension uses Chrome's message passing API with TypeScript-typed messages (`src/message.ts`):
- Content Script ↔ Background Script: Playback control commands
- Background Script ↔ Offscreen Document: Audio data and playback control
- Popup ↔ Background Script: Configuration updates

### State Management

- **Configuration**: Stored in IndexedDB via `SimpleDBManager` in `src/config.ts`
- **Audio Cache**: LRU cache in background script (up to 100MB)
- **Playback State**: Managed by `AudioManager` with `OffscreenStatus` enum

### Audio Playback Architecture

The extension implements a streaming audio playback system:
- **On-demand Generation**: Audio is generated for each sentence as needed, not all upfront
- **Background Pre-generation**: While playing current sentence, future sentences are generated in parallel
- **Seamless Playback**: Each sentence plays immediately after the previous one finishes, if audio is ready
- **Error Resilience**: Failed audio generation for one sentence doesn't block others

### Key Technologies

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite with `vite-plugin-web-extension`
- **API Integration**: OpenAI SDK for text-to-speech
- **Data Validation**: Zod schemas for configuration
- **Storage**: IndexedDB for persistent configuration

## Important Patterns

1. **Singleton Pattern**: `AudioManager` and `SimpleDBManager` use getInstance() pattern
2. **Message Type Safety**: All Chrome runtime messages are typed via discriminated unions
3. **Async Error Handling**: Consistent try-catch patterns with user notifications
4. **React Mounting**: Careful DOM checks before mounting React components to prevent multiple initializations
5. **Streaming Audio**: Audio generation happens in parallel with playback for smooth user experience

## Recent Changes

- Fixed pause/resume bug where resuming would skip to the next sentence
- Implemented streaming audio generation to avoid waiting for all sentences to be generated before playback starts
- Audio is now generated on-demand with background pre-generation for upcoming sentences