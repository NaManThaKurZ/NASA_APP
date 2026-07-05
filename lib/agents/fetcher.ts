import { fetchEonetEvents } from "../nasa-api";
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
    return { source: "EONET", fetchedAt: new Date().toISOString(), events };
  } catch (err) {
    log({
      agent: "fetcher",
      action: "failure",
      timestamp: new Date().toISOString(),
      error: (err as Error).message,
    });
    return { source: "EONET", fetchedAt: new Date().toISOString(), events: [] };
  }
}
