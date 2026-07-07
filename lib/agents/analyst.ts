import type {
  FetchResult,
  AnalystResult,
  Finding,
  AgentLogEntry,
  RawStats,
  CritiqueResult,
  RevisionEntry,
} from "../types";
import { computeCategoryStats, computeGeoClusters } from "../stats";

function computeRawStats(fetchResult: FetchResult): RawStats {
  return {
    totalEvents: fetchResult.events.length,
    categoryStats: computeCategoryStats(fetchResult.events),
    geoClusters: computeGeoClusters(fetchResult.events),
    computedAt: new Date().toISOString(),
  };
}

function ruleBasedAnalysis(rawStats: RawStats): Finding[] {
  const findings: Finding[] = [];

  for (const stat of rawStats.categoryStats) {
    if (stat.observed >= 3 && stat.deviationRatio >= 1.5) {
      findings.push({
        summary: `"${stat.category}" is ${stat.deviationRatio}x the expected uniform rate (${stat.observed} observed vs ${stat.expected} expected).`,
        severity: stat.deviationRatio >= 3 ? "high" : stat.deviationRatio >= 2 ? "medium" : "low",
        relatedEventIds: [],
        evidence: `${stat.observed} events (${stat.percentOfTotal}% of all open events) tagged "${stat.category}".`,
      });
    }
  }

  for (const cluster of rawStats.geoClusters) {
    if (cluster.count >= 3) {
      findings.push({
        summary: `Geographic cluster of ${cluster.count} "${cluster.category}" events within ${cluster.radiusKm}km.`,
        severity: cluster.count >= 6 ? "high" : cluster.count >= 4 ? "medium" : "low",
        relatedEventIds: cluster.eventIds,
        evidence: `Centroid at (${cluster.centroidLat}, ${cluster.centroidLon}).`,
      });
    }
  }

  return findings;
}

async function llmAnalysis(rawStats: RawStats): Promise<Finding[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("no GEMINI_API_KEY set");

  const statsBlock = JSON.stringify(
    {
      totalEvents: rawStats.totalEvents,
      categoryStats: rawStats.categoryStats,
      geoClusters: rawStats.geoClusters.map((c) => ({
        category: c.category,
        centroid: [c.centroidLat, c.centroidLon],
        radiusKm: c.radiusKm,
        count: c.count,
        eventIds: c.eventIds,
      })),
    },
    null,
    2
  );

  const prompt = `You are a research assistant analyzing precomputed statistics from live NASA EONET natural event data, for a scientific/research audience.

categoryStats: deviation ratio is observed count / expected count under a uniform-distribution null hypothesis across categories currently open in this window (NOT a true historical baseline — EONET's public API doesn't expose one).
geoClusters: groups of same-category events within radiusKm of each other, computed via greedy proximity clustering on great-circle distance.

DATA:
${statsBlock}

Write findings a researcher could cite. Reference the actual numbers (deviation ratios, cluster counts, radii) directly — do not round loosely or invent numbers not present in the data. Note any limitation explicitly if a pattern is only suggestive given small sample size (e.g. n < 5).

Respond with ONLY a JSON array (no prose, no markdown fences), where each item has:
{"summary": string, "severity": "low"|"medium"|"high", "relatedEventIds": string[], "evidence": string}

Keep "summary" and "evidence" under 30 words each. Report at most 6 findings, ordered by significance.
If nothing is statistically notable, return an empty array [].`;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();

  const finishReason = data.candidates?.[0]?.finishReason;
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no content (finishReason: ${finishReason ?? "unknown"})`);

  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as Finding[];
  } catch {
    throw new Error(
      `Gemini returned malformed JSON (finishReason: ${finishReason ?? "unknown"}, length: ${cleaned.length})`
    );
  }
}

export async function runAnalystAgent(
  fetchResult: FetchResult,
  log: (entry: AgentLogEntry) => void
): Promise<AnalystResult> {
  log({ agent: "analyst", action: "start", timestamp: new Date().toISOString() });

  const rawStats = computeRawStats(fetchResult);
  log({
    agent: "analyst",
    action: "success",
    timestamp: new Date().toISOString(),
    detail: `computed stats: ${rawStats.categoryStats.length} categories, ${rawStats.geoClusters.length} geo cluster(s)`,
  });

  let findings: Finding[];
  let method: "llm" | "rule-based";

  try {
    findings = await llmAnalysis(rawStats);
    method = "llm";
    log({
      agent: "analyst",
      action: "success",
      timestamp: new Date().toISOString(),
      detail: `LLM analysis produced ${findings.length} finding(s)`,
    });
  } catch (err) {
    method = "rule-based";
    log({
      agent: "analyst",
      action: "fallback",
      timestamp: new Date().toISOString(),
      error: (err as Error).message,
    });
    findings = ruleBasedAnalysis(rawStats);
    log({
      agent: "analyst",
      action: "success",
      timestamp: new Date().toISOString(),
      detail: `rule-based analysis produced ${findings.length} finding(s)`,
    });
  }

  return { findings, analyzedAt: new Date().toISOString(), method, rawStats };
}

/**
 * Analyst revision pass: given the Critic's critique, responds to each point
 * (concede / defend / revise) and produces the final findings that ship in
 * the report. Skips the LLM round-trip entirely when there's nothing to
 * address — the common case for genuinely solid findings.
 */
async function llmRevision(
  findings: Finding[],
  critique: CritiqueResult,
  rawStats: RawStats
): Promise<{ revisions: RevisionEntry[]; finalFindings: Finding[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("no GEMINI_API_KEY set");

  const findingsBlock = JSON.stringify(
    findings.map((f, i) => ({ index: i, ...f })),
    null,
    2
  );

  const prompt = `You are the Analyst agent revisiting your own findings after peer critique in a NASA EONET data analysis pipeline.

YOUR ORIGINAL FINDINGS (indexed):
${findingsBlock}

CRITIQUE RECEIVED FROM THE CRITIC AGENT:
${JSON.stringify(critique, null, 2)}

RAW STATISTICS (ground truth for any revision):
${JSON.stringify(rawStats, null, 2)}

For EACH critique point, respond with exactly one resolution:
- "conceded": the critique is valid; the finding should be weakened, downgraded, or removed accordingly
- "defended": you disagree, and you explain why with direct reference to the actual stats
- "revised": you're changing the finding — supply a full replacement Finding object (summary, severity, relatedEventIds, evidence) so it stays internally consistent. Never patch a single field in isolation.

Respond with ONLY a JSON object (no prose, no markdown fences) matching exactly:
{
  "revisions": [
    { "critiquePointId": "c1", "resolution": "conceded"|"defended"|"revised", "analystResponse": "<your reasoning, under 30 words>", "updatedFinding": { "summary": string, "severity": "low"|"medium"|"high", "relatedEventIds": string[], "evidence": string } }
  ]
}

Omit "updatedFinding" entirely unless resolution is "revised".`;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 4096,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();

  const finishReason = data.candidates?.[0]?.finishReason;
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini returned no content (finishReason: ${finishReason ?? "unknown"})`);

  const cleaned = text.replace(/```json|```/g, "").trim();
  let parsed: { revisions: RevisionEntry[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Gemini returned malformed revision JSON (finishReason: ${finishReason ?? "unknown"}, length: ${cleaned.length})`
    );
  }

  const finalFindings = applyRevisions(findings, critique, parsed.revisions);
  return { revisions: parsed.revisions, finalFindings };
}

/**
 * Rule-based fallback: auto-concedes sample-size/statistical-rigor points by
 * downgrading severity one level, and auto-defends everything else with a
 * generic note. No LLM call — keeps the pipeline functional without a key.
 */
function ruleBasedRevision(
  findings: Finding[],
  critique: CritiqueResult
): { revisions: RevisionEntry[]; finalFindings: Finding[] } {
  const downgrade: Record<Finding["severity"], Finding["severity"]> = {
    high: "medium",
    medium: "low",
    low: "low",
  };

  const revisions: RevisionEntry[] = critique.points.map((point) => {
    const shouldConcede = point.category === "sample_size" || point.category === "statistical_rigor";
    if (shouldConcede) {
      const original = findings[point.findingIndex];
      const updatedFinding: Finding = { ...original, severity: downgrade[original.severity] };
      return {
        critiquePointId: point.id,
        resolution: "revised",
        analystResponse: "Automated fallback: downgraded severity one level given the flagged sample-size/rigor concern.",
        updatedFinding,
      };
    }
    return {
      critiquePointId: point.id,
      resolution: "defended",
      analystResponse: "Automated fallback: no LLM available to weigh this critique — finding retained as-is pending manual review.",
    };
  });

  const finalFindings = applyRevisions(findings, critique, revisions);
  return { revisions, finalFindings };
}

function applyRevisions(
  findings: Finding[],
  critique: CritiqueResult,
  revisions: RevisionEntry[]
): Finding[] {
  const result = [...findings];
  for (const revision of revisions) {
    if (revision.resolution === "revised" && revision.updatedFinding) {
      const point = critique.points.find((p) => p.id === revision.critiquePointId);
      if (point && result[point.findingIndex]) {
        result[point.findingIndex] = revision.updatedFinding;
      }
    }
  }
  return result;
}

export async function reviseFindings(
  findings: Finding[],
  critique: CritiqueResult,
  rawStats: RawStats,
  log: (entry: AgentLogEntry) => void
): Promise<{ revisions: RevisionEntry[]; finalFindings: Finding[] }> {
  if (critique.points.length === 0) {
    log({
      agent: "analyst",
      action: "success",
      timestamp: new Date().toISOString(),
      detail: "no critique points raised — findings stand as-is",
    });
    return { revisions: [], finalFindings: findings };
  }

  try {
    const result = await llmRevision(findings, critique, rawStats);
    log({
      agent: "analyst",
      action: "success",
      timestamp: new Date().toISOString(),
      detail: `LLM revision addressed ${result.revisions.length} critique point(s)`,
    });
    return result;
  } catch (err) {
    log({
      agent: "analyst",
      action: "fallback",
      timestamp: new Date().toISOString(),
      error: (err as Error).message,
    });
    const result = ruleBasedRevision(findings, critique);
    log({
      agent: "analyst",
      action: "success",
      timestamp: new Date().toISOString(),
      detail: `rule-based revision addressed ${result.revisions.length} critique point(s)`,
    });
    return result;
  }
}