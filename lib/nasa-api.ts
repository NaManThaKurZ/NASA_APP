import type { EonetEvent } from "./types";

const EONET_BASE = "https://eonet.gsfc.nasa.gov/api/v3";

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * Fetch currently open natural events from EONET (wildfires, storms, volcanoes, etc.)
 * No API key required.
 */
export async function fetchEonetEvents(days = 20, limit = 50): Promise<EonetEvent[]> {
  return withRetry(async () => {
    const url = `${EONET_BASE}/events?status=open&days=${days}&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`EONET fetch failed: ${res.status}`);
    const data = await res.json();
    return data.events as EonetEvent[];
  });
}
