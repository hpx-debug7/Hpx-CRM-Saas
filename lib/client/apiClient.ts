import { logger } from "./logger";

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      cache: "no-store"
    });

    if (!res) {
      logger.error(`apiFetch: no response for ${url}`);
      return null;
    }

    if (!res.ok) {
      logger.error(`apiFetch: HTTP ${res.status} ${url}`);
      return null;
    }

    const text = await res.text();

    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      logger.warn(`apiFetch: invalid JSON from ${url}`);
      return null;
    }
  } catch (err: any) {
    logger.error(`apiFetch: fetch failed for ${url}`, err?.message);
    return null;
  }
}
