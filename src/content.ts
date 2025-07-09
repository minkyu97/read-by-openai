import { sendMessage, onMessage } from "./message";

const controlBarHtml = `
  <div id="read-by-ai-control-bar">
    <button id="read-by-ai-play-pause">⏸</button>
    <button id="read-by-ai-replay">⏮</button>
  </div>
`;

const controlBarCss = `
  #read-by-ai-control-bar {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 5px 0 0 5px;
    display: flex;
    flex-direction: column;
    padding: 10px 0;
    z-index: 9999;
  }

  #read-by-ai-control-bar button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    padding: 10px 0;
    text-align: center;
  }

  #read-by-ai-control-bar button:hover {
    background-color: #e0e0e0;
  }
`;

function injectControlBar() {
  // Inject CSS
  const styleTag = document.createElement("style");
  styleTag.textContent = controlBarCss;
  document.head.appendChild(styleTag);

  // Inject HTML
  const body = document.body;
  const controlBarContainer = document.createElement("div");
  controlBarContainer.innerHTML = controlBarHtml;
  body.appendChild(controlBarContainer);

  // Add event listeners
  const playPauseButton = document.getElementById("read-by-ai-play-pause");
  const replayButton = document.getElementById("read-by-ai-replay");

  let isPlaying = false; // Initial state

  if (playPauseButton) {
    playPauseButton.addEventListener("click", async () => {
      if (isPlaying) {
        await sendMessage({ type: "pause" });
        playPauseButton.textContent = "▶"; // Change to play icon
      } else {
        await sendMessage({ type: "resume" });
        playPauseButton.textContent = "⏸"; // Change to pause icon
      }
      isPlaying = !isPlaying;
      console.log("Play/Pause clicked, isPlaying:", isPlaying);
    });
  }

  if (replayButton) {
    replayButton.addEventListener("click", async () => {
      await sendMessage({ type: "replay" });
      console.log("Replay clicked");
    });
  }

  onMessage(async (message) => {
    if (message.type === "playback-finished") {
      isPlaying = false;
      if (playPauseButton) {
        playPauseButton.textContent = "▶";
      }
    }
  });
}

// Inject the control bar when the page loads
window.addEventListener("load", injectControlBar);