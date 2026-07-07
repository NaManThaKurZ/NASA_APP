import type { AnalystResult, CritiqueResult, AgentLogEntry } from "../types";

/**
 * Critic agent: reviews the Analyst's findings against the raw statistics
 * they were derived from, actively looking for overreach rather than
 * validating. Mirrors the Analyst's own LLM-call pattern (same model,
 * same token/thinking config) so it fails soft the same way.
 */
async function llmCritique(analystResult: AnalystResult): Promise<CritiqueResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("no GEMINI_API_KEY set");

  const findingsBlock = JSON.stringify(
    analystResult.findings.map((f, i) => ({ index: i, ...f })),
    null,
    2
  );

  const statsBlock = JSON.stringify(
    {
      totalEvents: analystResult.rawStats.totalEvents,
      categoryStats: analystResult.rawStats.categoryStats,
      geoClusters: analystResult.rawStats.geoClusters,
    },
    null,
    2
  );

  const prompt = `You are a skeptical peer-reviewer AI in a scientific pipeline analyzing NASA EONET disaster event data.
Another AI agent (the Analyst) already produced the findings below from the precomputed statistics also shown below.
Your job is NOT to validate — it is to actively look for weaknesses. Do not manufacture criticism for its own sake, but do not rubber-stamp weak claims either.

For each finding, check:
1. Sample size: is it drawn from too few events to be reliable? (rule of thumb: observed < 5 or cluster count < 4 is weak)
2. Confounders: could geography, reporting bias, or seasonality explain the pattern instead of the stated cause?
3. Statistical rigor: does the deviationRatio/count cited actually support the strength of the severity label used (e.g. "high" severity from a 1.6x deviation is overstated)?
4. Causal overreach: does the finding imply causation when only co-occurrence/correlation exists?

FINDINGS (indexed):
${findingsBlock}

RAW STATISTICS THEY WERE DERIVED FROM:
${statsBlock}

Respond with ONLY a JSON object (no prose, no markdown fences) matching exactly:
{
  "points": [
    { "id": "c1", "findingIndex": 0, "challenge": "<specific objection>", "severity": "minor"|"moderate"|"major", "category": "sample_size"|"confounder"|"statistical_rigor"|"causal_overreach"|"other" }
  ],
  "overallAssessment": "<1-2 sentence verdict on the findings' overall reliability>"
}

Reference findings by their index, not by re-quoting text. If findings are genuinely solid, return an empty "points" array — don't force criticism.`;

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
    return JSON.parse(cleaned) as CritiqueResult;
  } catch {
    throw new Error(
      `Gemini returned malformed critique JSON (finishReason: ${finishReason ?? "unknown"}, length: ${cleaned.length})`
    );
  }
}

/**
 * Rule-based fallback: flags findings whose severity looks unsupported by
 * the underlying numbers, without needing an LLM call. Runs whenever the
 * LLM critique is unavailable (no API key, API error, bad JSON) — mirrors
 * the Analyst's rule-based fallback so the pipeline never crashes.
 */
function ruleBasedCritique(analystResult: AnalystResult): CritiqueResult {
  const points: CritiqueResult["points"] = [];
  let counter = 1;

  analystResult.findings.forEach((finding, index) => {
    if (finding.severity === "high") {
      const isGeoFinding = finding.relatedEventIds.length > 0;

      if (isGeoFinding && finding.relatedEventIds.length < 4) {
        points.push({
          id: `rb${counter++}`,
          findingIndex: index,
          challenge: `"High" severity assigned to a cluster of only ${finding.relatedEventIds.length} events — below the n<4 reliability threshold.`,
          severity: "moderate",
          category: "sample_size",
        });
      }

      if (!isGeoFinding) {
        const stat = analystResult.rawStats.categoryStats.find((s) => finding.summary.includes(s.category));
        if (stat && stat.observed < 5) {
          points.push({
            id: `rb${counter++}`,
            findingIndex: index,
            challenge: `"High" severity assigned to a category with only ${stat.observed} observed events — below the n<5 reliability threshold.`,
            severity: "moderate",
            category: "sample_size",
          });
        }
      }
    }
  });

  return {
    points,
    overallAssessment:
      points.length > 0
        ? `Rule-based review flagged ${points.length} high-severity finding(s) as potentially overstated given sample size.`
        : "Rule-based review found no severity/sample-size mismatches.",
  };
}

export async function runCriticAgent(
  analystResult: AnalystResult,
  log: (entry: AgentLogEntry) => void
): Promise<CritiqueResult> {
  log({ agent: "critic", action: "start", timestamp: new Date().toISOString() });

  if (analystResult.findings.length === 0) {
    log({
      agent: "critic",
      action: "success",
      timestamp: new Date().toISOString(),
      detail: "no findings to review",
    });
    return { points: [], overallAssessment: "No findings were produced this run, so there is nothing to critique." };
  }

  try {
    const critique = await llmCritique(analystResult);
    log({
      agent: "critic",
      action: "success",
      timestamp: new Date().toISOString(),
      detail: `LLM critique raised ${critique.points.length} point(s)`,
    });
    return critique;
  } catch (err) {
    log({
      agent: "critic",
      action: "fallback",
      timestamp: new Date().toISOString(),
      error: (err as Error).message,
    });
    const critique = ruleBasedCritique(analystResult);
    log({
      agent: "critic",
      action: "success",
      timestamp: new Date().toISOString(),
      detail: `rule-based critique raised ${critique.points.length} point(s)`,
    });
    return critique;
  }
}