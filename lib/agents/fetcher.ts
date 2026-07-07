import { fetchEonetEvents } from "../nasa-api";
import { getSampleEvents } from "../sample-events";
import type { FetchResult, AgentLogEntry } from "../types";

export async function runFetcherAgent(
  log: (entry: AgentLogEntry) => void
): Promise<FetchResult> {
  log({ agent: "fetcher", action: "start", timestamp: new Date().toISOString() });

  try {
    const events = await fetchEonetEvents();
    log({
      agent: "fetcher",
      action: "success",
      timestamp: new Date().toISOString(),
      detail: `fetched ${events.length} open events from EONET`,
    });
    return { source: "EONET", fetchedAt: new Date().toISOString(), events, degraded: false };
  } catch (err) {
    log({
      agent: "fetcher",
      action: "failure",
      timestamp: new Date().toISOString(),
      error: (err as Error).message,
    });

    const events = getSampleEvents();
    log({
      agent: "fetcher",
      action: "fallback",
      timestamp: new Date().toISOString(),
      detail: `EONET unreachable — loaded ${events.length} embedded sample events so downstream agents still have data to analyze`,
    });

    return {
      source: "sample-fallback",
      fetchedAt: new Date().toISOString(),
      events,
      degraded: true,
    };
  }
}
