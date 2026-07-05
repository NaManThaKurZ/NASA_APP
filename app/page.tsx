"use client";

import { useState, useEffect } from "react";
import type { PipelineResult, AgentLogEntry } from "@/lib/types";

type StageState = "idle" | "active" | "done" | "error";

const stageColor: Record<StageState, string> = {
  idle: "border-[#1f2836]",
  active: "border-[#ffb454] shadow-[0_0_0_1px_#ffb454,0_0_18px_rgba(255,180,84,0.15)]",
  done: "border-[#6bcb77] shadow-[0_0_0_1px_#6bcb77]",
  error: "border-[#ff6b6b] shadow-[0_0_0_1px_#ff6b6b]",
};

const dotColor: Record<StageState, string> = {
  idle: "bg-[#6b7889]",
  active: "bg-[#ffb454] animate-pulse",
  done: "bg-[#6bcb77]",
  error: "bg-[#ff6b6b]",
};

function Stage({
  name,
  desc,
  state,
  status,
}: {
  name: string;
  desc: string;
  state: StageState;
  status: string;
}) {
  return (
    <div className={`bg-[#11161f] border rounded-md px-4 py-4 transition-colors ${stageColor[state]}`}>
      <div className="flex items-center gap-2 font-sans font-semibold text-[13px] text-white mb-1.5">
        <span className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${dotColor[state]}`} />
        {name}
      </div>
      <div className="text-[11px] text-[#6b7889] leading-relaxed">{desc}</div>
      <div
        className={`text-[10px] mt-2 uppercase tracking-wide ${
          state === "active"
            ? "text-[#ffb454]"
            : state === "done"
            ? "text-[#6bcb77]"
            : state === "error"
            ? "text-[#ff6b6b]"
            : "text-[#6b7889]"
        }`}
      >
        {status}
      </div>
    </div>
  );
}

const sevBadge: Record<string, string> = {
  high: "bg-[#ff6b6b26] text-[#ff6b6b]",
  medium: "bg-[#ffb45426] text-[#ffb454]",
  low: "bg-[#6bcb7726] text-[#6bcb77]",
};

const sevBorder: Record<string, string> = {
  high: "border-l-[#ff6b6b]",
  medium: "border-l-[#ffb454]",
  low: "border-l-[#6bcb77]",
};

const logTagColor: Record<string, string> = {
  start: "text-[#4fd1c5]",
  success: "text-[#4fd1c5]",
  failure: "text-[#ff6b6b]",
  fallback: "text-[#ffb454]",
};

function IntroScreen({ onBegin }: { onBegin: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1400);
    const t3 = setTimeout(() => setPhase(3), 2600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0a0e14] flex items-center justify-center z-50 font-mono">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(79,209,197,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(79,209,197,0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative max-w-[620px] px-8 text-center">
        <div
          className={`text-[11px] text-[#4fd1c5] uppercase tracking-[0.3em] mb-4 transition-opacity duration-700 ${
            phase >= 1 ? "opacity-100" : "opacity-0"
          }`}
        >
          NASA Open Data — Live Feed
        </div>
        <h1
          className={`font-sans font-bold text-white text-[28px] md:text-[34px] leading-tight mb-5 transition-all duration-700 ${
            phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          Somewhere on Earth, right now,
          <br />a wildfire cluster is forming.
        </h1>
        <p
          className={`text-[13px] text-[#6b7889] leading-relaxed mb-8 transition-opacity duration-700 delay-200 ${
            phase >= 2 ? "opacity-100" : "opacity-0"
          }`}
        >
          This isn&rsquo;t a story written about a disaster. It&rsquo;s a system of
          autonomous agents that fetches live NASA EONET data, computes real
          statistical deviations, and flags what a human analyst hasn&rsquo;t
          noticed yet.
        </p>
        <button
          onClick={onBegin}
          className={`bg-[#4fd1c5] text-[#06201d] font-sans font-semibold text-[13px] px-6 py-3 rounded-md hover:opacity-90 active:scale-[0.98] transition-all duration-500 ${
            phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          ▶ Begin Monitoring
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [running, setRunning] = useState(false);
  const [fetcherState, setFetcherState] = useState<StageState>("idle");
  const [analystState, setAnalystState] = useState<StageState>("idle");
  const [reporterState, setReporterState] = useState<StageState>("idle");
  const [fetcherStatus, setFetcherStatus] = useState("Idle");
  const [analystStatus, setAnalystStatus] = useState("Idle");
  const [reporterStatus, setReporterStatus] = useState("Idle");
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);

  function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function runPipeline() {
    setRunning(true);
    setError(null);
    setResult(null);
    setLogs([]);
    setFetcherState("active");
    setFetcherStatus("Fetching EONET events…");
    setAnalystState("idle");
    setAnalystStatus("Idle");
    setReporterState("idle");
    setReporterStatus("Idle");

    try {
      const res = await fetch("/api/pipeline");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Pipeline failed");
      }

      const pipelineResult = data as PipelineResult;

      await sleep(400);
      const fetcherFailed = pipelineResult.logs.some(
        (l) => l.agent === "fetcher" && l.action === "failure"
      );
      setFetcherState(fetcherFailed ? "error" : "done");
      setFetcherStatus(`${pipelineResult.fetchResult.events.length} events retrieved`);
      setLogs(pipelineResult.logs.filter((l) => l.agent === "fetcher"));

      await sleep(500);
      setAnalystState("active");
      setAnalystStatus("Computing statistics…");
      await sleep(500);
      setAnalystState("done");
      setAnalystStatus(
        `${pipelineResult.analystResult.findings.length} finding(s) — ${pipelineResult.analystResult.method}`
      );
      setLogs(pipelineResult.logs.filter((l) => l.agent === "fetcher" || l.agent === "analyst"));

      await sleep(500);
      setReporterState("active");
      setReporterStatus("Compiling report…");
      await sleep(400);
      setReporterState("done");
      setReporterStatus("Complete");
      setLogs(pipelineResult.logs);
      setResult(pipelineResult);
    } catch (err) {
      setError((err as Error).message);
      setFetcherState("error");
      setFetcherStatus("Error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      {showIntro && <IntroScreen onBegin={() => setShowIntro(false)} />}

      <div className="max-w-[1080px] mx-auto w-full p-7 font-mono text-[#d9e2ec]">
        <header className="flex justify-between items-end mb-6 border-b border-[#1f2836] pb-4">
          <div>
            <h1 className="font-sans font-bold text-[22px] text-white tracking-wide mb-1">
              SPACE AGENTS — MISSION CONTROL
            </h1>
            <div className="text-[12px] text-[#6b7889] uppercase tracking-wider">
              Fetcher · Analyst · Reporter — NASA EONET pipeline — Research mode
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 md:gap-0 mb-6">
          <Stage name="FETCHER" desc="Pulls open natural events from NASA EONET (wildfires, storms, volcanoes)" state={fetcherState} status={fetcherStatus} />
          <div className="hidden md:block w-9 h-0.5 bg-[#1f2836]" />
          <Stage name="ANALYST" desc="Computes deviation ratios and geographic clusters, then reasons over them" state={analystState} status={analystStatus} />
          <div className="hidden md:block w-9 h-0.5 bg-[#1f2836]" />
          <Stage name="REPORTER" desc="Compiles findings into a readable mission report" state={reporterState} status={reporterStatus} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#11161f] border border-[#1f2836] rounded-md px-4 py-4 min-h-[340px] flex flex-col">
            <div className="font-sans text-[11px] font-semibold text-[#6b7889] uppercase tracking-widest mb-2.5 pb-2 border-b border-[#1f2836]">
              Agent Log Stream
            </div>
            <div className="flex-1 overflow-y-auto text-[12px] leading-relaxed max-h-[280px]">
              {logs.length === 0 ? (
                <div className="text-[#6b7889] text-[12px] py-5 text-center">
                  No run yet. Press &ldquo;Run Pipeline&rdquo; to start.
                </div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[#6b7889] flex-shrink-0">
                      {new Date(l.timestamp).toTimeString().slice(0, 8)}
                    </span>
                    <span className={`flex-shrink-0 w-[46px] font-semibold ${logTagColor[l.action]}`}>
                      {l.action.toUpperCase()}
                    </span>
                    <span>
                      <b className="text-white">{l.agent}</b> — {l.detail || l.error || ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#11161f] border border-[#1f2836] rounded-md px-4 py-4 min-h-[340px] flex flex-col">
            <div className="font-sans text-[11px] font-semibold text-[#6b7889] uppercase tracking-widest mb-2.5 pb-2 border-b border-[#1f2836]">
              Mission Report
            </div>
            <div className="flex-1 overflow-y-auto text-[12px] leading-relaxed max-h-[280px]">
              {error ? (
                <div className="text-[#ff6b6b] text-[12px] py-5">Pipeline error: {error}</div>
              ) : !result ? (
                <div className="text-[#6b7889] text-[12px] py-5 text-center">
                  Report will appear here once the Reporter agent completes.
                </div>
              ) : result.analystResult.findings.length === 0 ? (
                <div className="text-[#6b7889] text-[12px] py-5 text-center">
                  No statistically notable patterns in this window.
                </div>
              ) : (
                <>
                  <div className="font-sans font-semibold text-[13px] text-white mb-2.5">
                    {result.report.headline}
                  </div>
                  {result.analystResult.findings.map((f, i) => (
                    <div key={i} className={`border-l-2 pl-2.5 mb-3 ${sevBorder[f.severity]}`}>
                      <div>
                        <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded mr-1.5 font-semibold ${sevBadge[f.severity]}`}>
                          {f.severity}
                        </span>
                        {f.summary}
                      </div>
                      <div className="text-[#6b7889] text-[11px] mt-0.5">Evidence: {f.evidence}</div>
                      {f.relatedEventIds.length > 0 && (
                        <div className="text-[#6b7889] text-[11px]">
                          Related: {f.relatedEventIds.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {result && (
          <div className="mt-4 bg-[#11161f] border border-[#1f2836] rounded-md px-4 py-4">
            <button
              onClick={() => setShowStats((s) => !s)}
              className="font-sans text-[11px] font-semibold text-[#6b7889] uppercase tracking-widest flex items-center gap-2 w-full"
            >
              <span className="text-[#4fd1c5]">{showStats ? "▾" : "▸"}</span>
              Raw Statistical Detail ({result.analystResult.rawStats.categoryStats.length} categories,{" "}
              {result.analystResult.rawStats.geoClusters.length} geo cluster(s))
            </button>

            {showStats && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                <div>
                  <div className="text-[#6b7889] uppercase tracking-wide mb-2 text-[10px]">
                    Category Deviation (vs. uniform-split expectation)
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="text-[#6b7889] text-left border-b border-[#1f2836]">
                        <th className="pb-1.5 font-normal">Category</th>
                        <th className="pb-1.5 font-normal text-right">Obs.</th>
                        <th className="pb-1.5 font-normal text-right">Exp.</th>
                        <th className="pb-1.5 font-normal text-right">Ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.analystResult.rawStats.categoryStats.map((s, i) => (
                        <tr key={i} className="border-b border-[#1f2836]/50">
                          <td className="py-1.5">{s.category}</td>
                          <td className="py-1.5 text-right">{s.observed}</td>
                          <td className="py-1.5 text-right text-[#6b7889]">{s.expected}</td>
                          <td
                            className={`py-1.5 text-right font-semibold ${
                              s.deviationRatio >= 2 ? "text-[#ffb454]" : "text-[#d9e2ec]"
                            }`}
                          >
                            {s.deviationRatio}×
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="text-[#6b7889] uppercase tracking-wide mb-2 text-[10px]">
                    Geographic Clusters (proximity ≤ 500km)
                  </div>
                  {result.analystResult.rawStats.geoClusters.length === 0 ? (
                    <div className="text-[#6b7889]">No multi-event clusters detected.</div>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-[#6b7889] text-left border-b border-[#1f2836]">
                          <th className="pb-1.5 font-normal">Category</th>
                          <th className="pb-1.5 font-normal text-right">Count</th>
                          <th className="pb-1.5 font-normal text-right">Centroid</th>
                          <th className="pb-1.5 font-normal text-right">Radius</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.analystResult.rawStats.geoClusters.map((c, i) => (
                          <tr key={i} className="border-b border-[#1f2836]/50">
                            <td className="py-1.5">{c.category}</td>
                            <td className="py-1.5 text-right">{c.count}</td>
                            <td className="py-1.5 text-right text-[#6b7889]">
                              {c.centroidLat}, {c.centroidLon}
                            </td>
                            <td className="py-1.5 text-right text-[#6b7889]">{c.radiusKm}km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={runPipeline}
            disabled={running}
            className="bg-[#4fd1c5] disabled:bg-[#1f2836] disabled:text-[#6b7889] text-[#06201d] font-sans font-semibold text-[13px] px-5 py-2.5 rounded-md hover:opacity-90 active:scale-[0.98] transition"
          >
            {running ? "● Running..." : result ? "▶ Run Pipeline Again" : "▶ Run Pipeline"}
          </button>
          <span className="text-[11px] text-[#6b7889]">
            Calls <b className="text-[#d9e2ec]">/api/pipeline</b> — set{" "}
            <b className="text-[#d9e2ec]">GEMINI_API_KEY</b> in .env.local for LLM-powered analysis,
            otherwise falls back to rule-based clustering.
          </span>
        </div>
      </div>
    </>
  );
}
