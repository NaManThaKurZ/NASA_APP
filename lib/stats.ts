import type { EonetEvent, CategoryStat, GeoCluster } from "./types";

/**
 * Great-circle distance between two lat/lon points, in kilometers.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Extract a representative [lat, lon] for an event from its most recent geometry point.
 * EONET returns coordinates as [lon, lat] for point geometries.
 */
function latLonOf(event: EonetEvent): [number, number] | null {
  const g = event.geometry?.[event.geometry.length - 1];
  if (!g || !Array.isArray(g.coordinates) || g.coordinates.length < 2) return null;
  const [lon, lat] = g.coordinates;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  return [lat, lon];
}

/**
 * Category deviation scoring under a uniform-distribution null hypothesis.
 *
 * This is a heuristic, not a true historical baseline (EONET doesn't expose one via
 * the public API) — expected count assumes events are spread evenly across all
 * categories present in this fetch window. A deviationRatio > 1 means a category
 * has more open events right now than an even split would predict.
 */
export function computeCategoryStats(events: EonetEvent[]): CategoryStat[] {
  const total = events.length;
  const counts = new Map<string, number>();
  for (const e of events) {
    for (const c of e.categories) {
      counts.set(c.title, (counts.get(c.title) ?? 0) + 1);
    }
  }
  const numCategories = counts.size || 1;
  const expected = total / numCategories;

  return Array.from(counts.entries())
    .map(([category, observed]) => ({
      category,
      observed,
      expected: Math.round(expected * 100) / 100,
      deviationRatio: expected > 0 ? Math.round((observed / expected) * 100) / 100 : 0,
      percentOfTotal: total > 0 ? Math.round((observed / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.deviationRatio - a.deviationRatio);
}

/**
 * Greedy proximity clustering: groups same-category events whose locations
 * fall within radiusKm of a growing cluster centroid. O(n^2) — fine at EONET's
 * scale (tens of events per fetch).
 */
export function computeGeoClusters(events: EonetEvent[], radiusKm = 500): GeoCluster[] {
  const byCategory = new Map<string, { event: EonetEvent; lat: number; lon: number }[]>();

  for (const e of events) {
    const coords = latLonOf(e);
    if (!coords) continue;
    const [lat, lon] = coords;
    for (const c of e.categories) {
      const arr = byCategory.get(c.title) ?? [];
      arr.push({ event: e, lat, lon });
      byCategory.set(c.title, arr);
    }
  }

  const clusters: GeoCluster[] = [];

  for (const [category, points] of byCategory.entries()) {
    const used = new Set<number>();

    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;
      const group = [points[i]];
      used.add(i);

      for (let j = i + 1; j < points.length; j++) {
        if (used.has(j)) continue;
        const dist = haversineKm(points[i].lat, points[i].lon, points[j].lat, points[j].lon);
        if (dist <= radiusKm) {
          group.push(points[j]);
          used.add(j);
        }
      }

      if (group.length >= 2) {
        const centroidLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
        const centroidLon = group.reduce((s, p) => s + p.lon, 0) / group.length;
        const maxDist = Math.max(
          ...group.map((p) => haversineKm(centroidLat, centroidLon, p.lat, p.lon))
        );
        clusters.push({
          category,
          centroidLat: Math.round(centroidLat * 100) / 100,
          centroidLon: Math.round(centroidLon * 100) / 100,
          radiusKm: Math.round(maxDist),
          eventIds: group.map((p) => p.event.id),
          count: group.length,
        });
      }
    }
  }

  return clusters.sort((a, b) => b.count - a.count);
}
