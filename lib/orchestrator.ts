import { runFetcherAgent } from "./agents/fetcher";
import { runAnalystAgent, reviseFindings } from "./agents/analyst";
import { runCriticAgent } from "./agents/critic";
import { runReporterAgent } from "./agents/reporter";
import type { AgentLogEntry, DebateResult, PipelineResult } from "./types";

export async function runPipeline(): Promise<PipelineResult> {
  const logs: AgentLogEntry[] = [];
  const log = (entry: AgentLogEntry) => logs.push(entry);

  const fetchResult = await runFetcherAgent(log);
  const analystResult = await runAnalystAgent(fetchResult, log);

  const critique = await runCriticAgent(analystResult, log);
  const { revisions, finalFindings } = await reviseFindings(
    analystResult.findings,
    critique,
    analystResult.rawStats,
    log
  );
  const debateResult: DebateResult = { critique, revisions, finalFindings };

  // Reporter runs on the post-debate findings, so the shipped report
  // reflects the revised/defended conclusions, not the pre-critique draft.
  const revisedAnalystResult = { ...analystResult, findings: finalFindings };
  const report = await runReporterAgent(revisedAnalystResult, log);

  return { fetchResult, analystResult: revisedAnalystResult, report, logs, debateResult };
}