import Browser from "webextension-polyfill";
import { configSchema, isConfigKey } from "./config";
import { Message, sendMessage } from "./message";

const configForm = document.getElementById("config") as HTMLFormElement;

window.onload = async () => {
  console.log("onload");
  console.log(configForm);
  
  
  const oldConfig = configSchema.parse(await Browser.storage.local.get());

  for (const input of configForm.getElementsByTagName("input")) {
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
  console.log(config);

  const message: Message = {
    type: "config-update",
    config,
  };
  const response = await sendMessage(message);
  console.log(response);
});
