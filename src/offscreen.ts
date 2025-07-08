import { onMessage } from "./message";
import { configSchema } from "./config";
import OpenAI from "openai";

onMessage(async (message) => {
  switch (message.type) {
    case "audio":
      await handleAudio(message.text);
      return {
        type: "response", text: "success"
      };
  }
  return;
})

async function handleAudio(text: string) {
  const config = configSchema.parse(await chrome.storage.local.get());

  const client = new OpenAI({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.audio.speech.create({
    model: config.model,
    voice: config.voice,
    input: text,
  });

  if (!response.ok || !response.body) {
    console.error("Failed to generate audio");
    return;
  }
  const audioTag = document.createElement("audio");
  audioTag.src = URL.createObjectURL(await response.blob());
  audioTag.play();
}
