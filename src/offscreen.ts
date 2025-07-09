import { onMessage } from "./message";

let audioTag: HTMLAudioElement | null = null;

onMessage(async (message, _, sendResponse) => {
  switch (message.type) {
    case "audio":
      await handleAudio(message.base64, sendResponse);
      break;
    case "pause":
      if (audioTag) {
        audioTag.pause();
        console.log("Audio paused");
      }
      break;
    case "resume":
      if (audioTag) {
        audioTag.play();
        console.log("Audio resumed");
      }
      break;
  }
})

async function handleAudio(base64: string, sendResponse: (response?: any) => void) {
  console.log(`Playing audio`);
  return new Promise<void>(async (resolve) => {
    const blob = await (await fetch(base64)).blob();
    audioTag = document.createElement("audio");
    audioTag.src = URL.createObjectURL(blob);
    audioTag.addEventListener("ended", () => {
      console.log(`Audio ended`);
      chrome.runtime.sendMessage({ type: "playback-finished" });
      sendResponse({
        type: "response", text: "success"
      });
      resolve();
    });
    await audioTag.play();
  });
}
