import OpenAI, { OpenAIError } from "openai";
import Browser from "webextension-polyfill";
import { Config } from "./config";
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
downloadAudio.style.backgroundImage = `url(${Browser.runtime.getURL(
  "download.png"
)})`;
downloadAudio.style.backgroundSize = "60%";
downloadAudio.style.backgroundRepeat = "no-repeat";
downloadAudio.style.backgroundPosition = "center";
downloadAudio.style.cursor = "not-allowed";

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
  downloadAudio.style.cursor = "not-allowed";
  audio.pause();
});

let mediaSource: MediaSource | undefined;
let audioChunks: Uint8Array[] = [];
let {
  promise: sourceOpenPromise,
  resolve: sourceOpenResolve,
  reject: sourceOpenReject,
} = Promise.withResolvers();

onMessage(async (message) => {
  switch (message.type) {
    case "tts":
      const config = message.config;
      let client = new OpenAI({
        apiKey: config.apiKey,
        dangerouslyAllowBrowser: true,
      });

      mediaSource = new MediaSource();
      audio.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener(
        "sourceopen",
        onSourceOpen(client, config, message, mediaSource)
      );
      break;
    case "start":
      console.log("start");

      mediaSource = new MediaSource();
      audio.src = URL.createObjectURL(mediaSource);
      console.log(audio.src);

      ({
        promise: sourceOpenPromise,
        resolve: sourceOpenResolve,
        reject: sourceOpenReject,
      } = Promise.withResolvers());

      mediaSource.addEventListener("sourceopen", () => {
        const contentType = "audio/mpeg";
        mediaSource?.addSourceBuffer(contentType);
        audioChunks = [];
        sourceOpenResolve(null);
        audioContainer.style.display = "flex";
        audio.play();
      });
      break;
    case "audio-chunk":
      sourceOpenPromise.then(() => {
        const sourceBuffer = mediaSource?.sourceBuffers[0];
        if (sourceBuffer !== undefined)
          runAfterUpdateEnd(sourceBuffer, () => {
            sourceBuffer?.appendBuffer(new Uint8Array(message.chunk));
          });
      });
      break;
    case "end":
      sourceOpenPromise.then(() => {
        const sourceBuffer = mediaSource?.sourceBuffers[0];
        if (sourceBuffer)
          runAfterUpdateEnd(sourceBuffer, () => {
            console.log("end");

            mediaSource?.endOfStream();
            const blob = new Blob(audioChunks, {
              type: "audio/mpeg",
            });
            downloadAudio.href = URL.createObjectURL(blob);
            downloadAudio.download = `${window.location.hostname}.mp3`;
            downloadAudio.style.cursor = "pointer";
          });
      });
      break;
    default:
      console.error("Unsupported message type", message);
  }
});

function onSourceOpen(
  client: OpenAI,
  config: {
    apiKey: string;
    model: "tts-1" | "tts-1-hd";
    voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  },
  message: {
    type: "tts";
    text: string;
    config: Config;
  },
  mediaSource: MediaSource
): (this: MediaSource, ev: Event) => any {
  return async () => {
    let response = null;
    try {
      response = await client.audio.speech.create({
        model: config.model,
        voice: config.voice,
        input: message.text,
      });
    } catch (error) {
      if (error instanceof OpenAIError) {
        alert("Check your API key");
      }
      console.error(error);
      return;
    }

    if (!response.ok || !response.body) {
      alert("Failed to generate audio");
      mediaSource.endOfStream();
      return;
    }

    const contentType = response.headers.get("content-type") ?? "audio/mpeg";
    const sourceBuffer = mediaSource.addSourceBuffer(contentType);
    const audioChunks: Uint8Array[] = [];
    const reader = response.body.getReader();
    const read = async () => {
      const { done, value } = await reader.read();
      if (done) {
        runAfterUpdateEnd(sourceBuffer, () => mediaSource.endOfStream());
        const blob = new Blob(audioChunks, { type: contentType });
        downloadAudio.href = URL.createObjectURL(blob);
        downloadAudio.download = `${window.location.hostname}.${
          contentType.split("/")[1]
        }`;
        downloadAudio.style.cursor = "pointer";
        return;
      }
      try {
        runAfterUpdateEnd(sourceBuffer, () => sourceBuffer.appendBuffer(value));
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
  };
}

function runAfterUpdateEnd(
  sourceBuffer: SourceBuffer,
  callback: () => void
): void {
  if (sourceBuffer.updating) {
    sourceBuffer.addEventListener("updateend", callback, { once: true });
  } else {
    callback();
  }
}
