# Space Agents — Mission Control (Next.js)

Multi-agent pipeline (Fetcher → Analyst → Reporter) over NASA's EONET open data,
with a live mission-control dashboard. Built for the NASA Space Apps Challenge.

## Architecture

- `lib/agents/fetcher.ts` — pulls open natural events from NASA EONET (wildfires, storms, volcanoes). Retries on failure, fails soft.
- `lib/agents/analyst.ts` — finds clusters/anomalies. Uses Gemini if `GEMINI_API_KEY` is set, otherwise falls back to rule-based clustering.
- `lib/agents/reporter.ts` — turns findings into a readable report.
- `lib/orchestrator.ts` — runs the three agents in sequence.
- `app/api/pipeline/route.ts` — API route that runs the pipeline and returns JSON.
- `app/page.tsx` — mission-control dashboard UI. Calls `/api/pipeline` and animates the pipeline stages live.

## Setup

```bash
npm install
cp .env.example .env.local
# optionally add GEMINI_API_KEY in .env.local for LLM-powered analysis
```

## Run (development)

```bash
npm run dev
```

Open http://localhost:3000 and press "Run Pipeline".

## Build for production / deploy

```bash
npm run build
npm start
```

Deploys directly to Vercel (`vercel deploy`) with zero config — the API route and
dashboard ship together as one app, giving you a single live URL for hackathon judges.

## Next steps

1. Swap/extend `lib/nasa-api.ts` with additional NASA data sources once the actual
   Space Apps challenge statement is released (Earthdata, GES DISC, exoplanet API, etc.).
2. Add a scheduler if the challenge calls for continuous monitoring instead of on-demand runs.
3. Extend the Reporter agent to also draft your demo pitch narrative automatically.
