// Opcionalmente usa Redis para cachear contexto e reduzir chamadas a banco.
import Redis from "ioredis";

let client: Redis | null = null;

if (process.env.REDIS_URL) {
  client = new Redis(process.env.REDIS_URL);
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
  if (!client) return null;
  const raw = await client.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setCachedValue(key: string, value: unknown, ttlSeconds: number) {
  if (!client) return;
  await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
}
