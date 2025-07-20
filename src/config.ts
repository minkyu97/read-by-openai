import z from "zod";

export const configSchema = z.object({
  apiKey: z.string().default(""),
  model: z.enum(["tts-1", "tts-1-hd"]).default("tts-1"),
  voice: z
    .enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
    .default("alloy"),
  seekDuration: z.number().min(1).max(60).default(10),
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

// Use a simple DB manager that doesn't depend on config
class SimpleDBManager {
  private static instance: SimpleDBManager;
  private db: IDBDatabase | null = null;

  private constructor() {}

  public static getInstance(): SimpleDBManager {
    if (!SimpleDBManager.instance) {
      SimpleDBManager.instance = new SimpleDBManager();
    }
    return SimpleDBManager.instance;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open("ConfigDB", 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("config")) {
          db.createObjectStore("config", { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  public async saveItem<T>(id: string, value: T): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction("config", "readwrite");
    const store = tx.objectStore("config");
    store.put({ id, value });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async getItem<T>(id: string): Promise<T | null> {
    const db = await this.getDB();
    const tx = db.transaction("config", "readonly");
    const store = tx.objectStore("config");
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result ? request.result.value : null);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const dbManager = SimpleDBManager.getInstance();
  await dbManager.saveItem(CONFIG_KEY, config);
}

export async function getConfig(): Promise<Config> {
  const dbManager = SimpleDBManager.getInstance();
  const config = await dbManager.getItem<Config>(CONFIG_KEY);
  if (config) {
    return configSchema.parse(config);
  }
  const defaultConfig = configSchema.parse({});
  await saveConfig(defaultConfig);
  return defaultConfig;
}
