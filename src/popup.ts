import Browser from "webextension-polyfill";
import { configSchema, isConfigKey } from "./config";
import { Message, sendMessage } from "./message";

const configForm = document.getElementById("config") as HTMLFormElement;

window.onload = async () => {
  const oldConfig = configSchema.parse(await Browser.storage.local.get());

  for (const _input of configForm.querySelectorAll("input, select")) {
    const input = _input as (HTMLInputElement | HTMLSelectElement);
    const name = input.name;
    if (isConfigKey(name) && oldConfig[name] !== undefined) {
      input.value = oldConfig[name];
    }
  }
};

configForm.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();

  const configForm = document.getElementById("config") as HTMLFormElement;
  const configFormData = new FormData(configForm);
  const config = configSchema.parse(Object.fromEntries(configFormData.entries()));

  const message: Message = {
    type: "config-update",
    config,
  };
  await sendMessage(message);
});
