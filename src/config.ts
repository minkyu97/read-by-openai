import z from "zod";

export const configSchema = z.object({
  apiKey: z.string().default(""),
  model: z.enum(["tts-1", "tts-1-hd"]).default("tts-1"),
  voice: z
    .enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
    .default("alloy"),
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
