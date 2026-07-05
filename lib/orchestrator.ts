import { runFetcherAgent } from "./agents/fetcher";
import { runAnalystAgent } from "./agents/analyst";
import { runReporterAgent } from "./agents/reporter";
import type { AgentLogEntry, PipelineResult } from "./types";

export async function runPipeline(): Promise<PipelineResult> {
  const logs: AgentLogEntry[] = [];
  const log = (entry: AgentLogEntry) => logs.push(entry);

  const fetchResult = await runFetcherAgent(log);
  const analystResult = await runAnalystAgent(fetchResult, log);
  const report = await runReporterAgent(analystResult, log);

  return { fetchResult, analystResult, report, logs };
}
