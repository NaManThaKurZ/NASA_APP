import type { AnalystResult, Report, AgentLogEntry } from "../types";

export async function runReporterAgent(
  analystResult: AnalystResult,
  log: (entry: AgentLogEntry) => void
): Promise<Report> {
  log({ agent: "reporter", action: "start", timestamp: new Date().toISOString() });

  if (analystResult.findings.length === 0) {
    const report: Report = {
      headline: "No notable patterns detected",
      body: "The analyst agent reviewed the current data window and found no clusters or anomalies worth flagging.",
      generatedAt: new Date().toISOString(),
    };
    log({ agent: "reporter", action: "success", timestamp: new Date().toISOString(), detail: "empty report" });
    return report;
  }

  const high = analystResult.findings.filter((f) => f.severity === "high");
  const headline =
    high.length > 0
      ? `${high.length} high-severity pattern(s) detected across active Earth events`
      : `${analystResult.findings.length} pattern(s) detected across active Earth events`;

  const body = analystResult.findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.severity.toUpperCase()}] ${f.summary}\n   Evidence: ${f.evidence}\n   Related events: ${f.relatedEventIds.join(", ")}`
    )
    .join("\n\n");

  const report: Report = { headline, body, generatedAt: new Date().toISOString() };
  log({ agent: "reporter", action: "success", timestamp: new Date().toISOString(), detail: headline });
  return report;
}
