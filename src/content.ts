import OpenAI from "openai";
import Browser from "webextension-polyfill";
import { onMessage } from "./message";

const audio = new Audio();
audio.controls = true;
audio.style.flex = "1";
audio.style.height = "50px";
audio.style.backgroundColor = "white";

const closeAudio = document.createElement("button");
closeAudio.textContent = "X";
closeAudio.style.width = "50px";
closeAudio.style.height = "50px";
closeAudio.style.fontSize = "30px";
closeAudio.style.color = "black";
closeAudio.style.backgroundColor = "white";

const downloadAudio = document.createElement("a");
downloadAudio.style.width = "50px";
downloadAudio.style.height = "50px";
downloadAudio.style.fontSize = "30px";
downloadAudio.style.color = "black";
downloadAudio.style.backgroundColor = "white";
downloadAudio.style.backgroundImage = `url(${Browser.runtime.getURL("download.png")})`;
downloadAudio.style.backgroundSize = "60%";
downloadAudio.style.backgroundRepeat = "no-repeat";
downloadAudio.style.backgroundPosition = "center";

const audioContainer = document.createElement("div");
audioContainer.style.position = "fixed";
audioContainer.style.bottom = "0";
audioContainer.style.left = "0";
audioContainer.style.width = "100%";
audioContainer.style.height = "50px";
audioContainer.style.zIndex = "100000";
audioContainer.style.opacity = "0.6";
audioContainer.style.display = "none";

audioContainer.appendChild(audio);
audioContainer.appendChild(closeAudio);
audioContainer.appendChild(downloadAudio);
document.body.appendChild(audioContainer);

closeAudio.addEventListener("click", () => {
  audioContainer.style.display = "none";
  audio.pause();
});

let currentText = "";

onMessage(async (message) => {
  switch (message.type) {
    case "tts":
      const config = message.config;
      const currentText = message.text;
      let client = null;
      try {
        client = new OpenAI({
          apiKey: config.apiKey,
          dangerouslyAllowBrowser: true,
        });
      } catch (error) {
        console.error(error);
        return { type: "log", level: "error", data: "API key is invalid" };
      }
      if (!client) {
        return { type: "log", level: "error", data: "API key is invalid" };
      }

      const mediaSource = new MediaSource();
      audio.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener("sourceopen", async () => {

        const response = await client.audio.speech.create({
          model: config.model,
          voice: config.voice,
          input: message.text,
        });


        if (!response.ok || !response.body) {
          mediaSource.endOfStream();
          return { type: "log", level: "error", data: "Failed to fetch audio" };
        }

        const contentType = response.headers.get("content-type") ?? "audio/mpeg";
        const sourceBuffer = mediaSource.addSourceBuffer(contentType);
        const audioChunks: Uint8Array[] = [];
        const reader = response.body.getReader();
        const read = async () => {
          const { done, value } = await reader.read();
          if (done) {
            mediaSource.endOfStream();
            const blob = new Blob(audioChunks, { type: contentType });
            audio.src = URL.createObjectURL(blob);
            downloadAudio.href = audio.src;
            downloadAudio.download = `${window.location.hostname}.${contentType.split("/")[1]}`;
            return;
          }
          try {
          sourceBuffer.appendBuffer(value);
          audioChunks.push(value);
          read();
          } catch (error) {
            console.error(error);
            reader.cancel();
            mediaSource.endOfStream();
            return;
          }
        };
        read();
        audioContainer.style.display = "flex";
        audio.play();
      });

      return { type: "log", level: "info", data: "success" };
    default:
      return { type: "log", level: "error", data: "Unsupported message type" };
  }
});
