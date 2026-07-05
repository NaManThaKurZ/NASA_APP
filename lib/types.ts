export interface EonetEvent {
  id: string;
  title: string;
  categories: { id: string; title: string }[];
  geometry: { date: string; coordinates: number[] }[];
}

export interface FetchResult {
  source: string;
  fetchedAt: string;
  events: EonetEvent[];
}

export interface CategoryStat {
  category: string;
  observed: number;
  expected: number;
  deviationRatio: number; // observed / expected under uniform distribution
  percentOfTotal: number;
}

export interface GeoCluster {
  category: string;
  centroidLat: number;
  centroidLon: number;
  radiusKm: number;
  eventIds: string[];
  count: number;
}

export interface RawStats {
  totalEvents: number;
  categoryStats: CategoryStat[];
  geoClusters: GeoCluster[];
  computedAt: string;
}

export interface Finding {
  summary: string;
  severity: "low" | "medium" | "high";
  relatedEventIds: string[];
  evidence: string;
}

export interface AnalystResult {
  findings: Finding[];
  analyzedAt: string;
  method: "llm" | "rule-based";
  rawStats: RawStats;
}

export interface Report {
  headline: string;
  body: string;
  generatedAt: string;
}

export interface AgentLogEntry {
  agent: "fetcher" | "analyst" | "reporter";
  action: "start" | "success" | "failure" | "fallback";
  timestamp: string;
  detail?: string;
  error?: string;
}

export interface PipelineResult {
  fetchResult: FetchResult;
  analystResult: AnalystResult;
  report: Report;
  logs: AgentLogEntry[];
}
