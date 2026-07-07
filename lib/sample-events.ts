import type { EonetEvent } from "./types";

/**
 * Embedded fallback dataset, shaped exactly like EONET's real API response.
 *
 * Used ONLY when live EONET fetch fails after all retries — e.g. venue wifi
 * blocks external calls, NASA API is rate-limited or down mid-demo. This
 * guarantees the pipeline always has something to analyze, so a demo never
 * dead-ends on an empty dashboard. The UI must always disclose when this
 * data is in use (see FetchResult.degraded) — never present it as live.
 *
 * Values are realistic in shape (categories, coordinate format, date recency)
 * but are illustrative, not a claim about real ongoing events.
 */
export function getSampleEvents(): EonetEvent[] {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();

  return [
    // Wildfire cluster — Northern California
    { id: "SAMPLE-WF-001", title: "Sample Wildfire — Shasta County", categories: [{ id: "8", title: "Wildfires" }], geometry: [{ date: daysAgo(2), coordinates: [-122.39, 40.77] }] },
    { id: "SAMPLE-WF-002", title: "Sample Wildfire — Trinity County", categories: [{ id: "8", title: "Wildfires" }], geometry: [{ date: daysAgo(3), coordinates: [-123.11, 40.98] }] },
    { id: "SAMPLE-WF-003", title: "Sample Wildfire — Siskiyou County", categories: [{ id: "8", title: "Wildfires" }], geometry: [{ date: daysAgo(1), coordinates: [-122.65, 41.59] }] },
    { id: "SAMPLE-WF-004", title: "Sample Wildfire — Lassen County", categories: [{ id: "8", title: "Wildfires" }], geometry: [{ date: daysAgo(4), coordinates: [-120.64, 40.42] }] },

    // Severe storm cluster — Gulf of Mexico
    { id: "SAMPLE-ST-001", title: "Sample Tropical System — Gulf Basin A", categories: [{ id: "10", title: "Severe Storms" }], geometry: [{ date: daysAgo(1), coordinates: [-88.5, 25.9] }] },
    { id: "SAMPLE-ST-002", title: "Sample Tropical System — Gulf Basin B", categories: [{ id: "10", title: "Severe Storms" }], geometry: [{ date: daysAgo(2), coordinates: [-89.1, 26.4] }] },
    { id: "SAMPLE-ST-003", title: "Sample Tropical System — Gulf Basin C", categories: [{ id: "10", title: "Severe Storms" }], geometry: [{ date: daysAgo(1), coordinates: [-87.9, 25.3] }] },

    // Isolated volcano
    { id: "SAMPLE-VO-001", title: "Sample Volcanic Activity — Pacific Ring", categories: [{ id: "12", title: "Volcanoes" }], geometry: [{ date: daysAgo(5), coordinates: [130.66, 30.78] }] },

    // Isolated events (no cluster, low signal)
    { id: "SAMPLE-IC-001", title: "Sample Iceberg — Southern Ocean", categories: [{ id: "15", title: "Sea and Lake Ice" }], geometry: [{ date: daysAgo(6), coordinates: [-45.2, -62.1] }] },
    { id: "SAMPLE-DR-001", title: "Sample Drought Region — Horn of Africa", categories: [{ id: "16", title: "Drought" }], geometry: [{ date: daysAgo(7), coordinates: [42.8, 8.4] }] },
  ];
}
