import z from "zod";
import { db } from "./db";

export const configSchema = z.object({
  apiKey: z.string().default(""),
  model: z.enum(["tts-1", "tts-1-hd"]).default("tts-1"),
  voice: z
    .enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
    .default("alloy"),
  dbName: z.string().default("MyDB"),
  dbVersion: z.number().default(1),
  dbStoreName: z.string().default("data"),
});
export type Config = z.infer<typeof configSchema>;

const configKeySchema = configSchema.keyof();
type ConfigKey = z.infer<typeof configKeySchema>;

export function isConfigKey(key: string): key is ConfigKey {
  try {
    configKeySchema.parse(key);
    return true;
  } catch {
    return false;
  }
}

const CONFIG_KEY = "config";

export async function saveConfig(config: Config): Promise<void> {
  const dbInstance = await db;
  await dbInstance.saveItem(CONFIG_KEY, config);
}

export async function getConfig(): Promise<Config> {
  const dbInstance = await db;
  const config = await dbInstance.getItem<Config>(CONFIG_KEY);
  if (config) {
    return configSchema.parse(config);
  }
  const defaultConfig = configSchema.parse({});
  await saveConfig(defaultConfig);
  return defaultConfig;
}
