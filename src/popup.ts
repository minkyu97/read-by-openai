import { configSchema, isConfigKey } from "./config";
import { sendMessage } from "./message";

const configForm = document.getElementById("config") as HTMLFormElement;

window.onload = async () => {
  const oldConfig = configSchema.parse(await chrome.storage.local.get());

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
  const newConfig = configSchema.parse(Object.fromEntries(configFormData.entries()));

  await chrome.storage.local.set(newConfig);

  await sendMessage({
    type: "config-update",
  })
});
