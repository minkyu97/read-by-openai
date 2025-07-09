import { configSchema, getConfig, isConfigKey, saveConfig } from "./config";

const configForm = document.getElementById("config") as HTMLFormElement;

window.onload = async () => {
  const oldConfig = await getConfig();

  for (const _input of configForm.querySelectorAll("input, select")) {
    const input = _input as (HTMLInputElement | HTMLSelectElement);
    const name = input.name;
    if (isConfigKey(name) && oldConfig[name] !== undefined) {
      input.value = String(oldConfig[name]);
    }
  }
};

configForm.addEventListener("submit", async (e: SubmitEvent) => {
  e.preventDefault();

  const configForm = document.getElementById("config") as HTMLFormElement;
  const configFormData = new FormData(configForm);
  const newConfig = configSchema.parse(Object.fromEntries(configFormData.entries()));

  await saveConfig(newConfig);
});
