import type { PolygonWithHoles } from './wktParser';

export interface ProjectedPolygon {
  /** SVG path in pixels of a world `256 * 2^zoom` wide, origin at its top-left corner. */
  path: string;
  /** Bounds in the same pixel units: [minX, minY, maxX, maxY]. */
  bounds: [number, number, number, number];
}

const cache = new WeakMap<PolygonWithHoles, Map<number, ProjectedPolygon | null>>();

/** Web Mercator position as a fraction of world size (longitude may exceed 0..1 for unwrapped rings). */
export function mercator(lat: number, lng: number): [number, number] {
  const rad = (lat * Math.PI) / 180;
  return [(lng + 180) / 360, (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2];
}

function perpendicularDistanceSq(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  const x = a[0] + t * dx - p[0];
  const y = a[1] + t * dy - p[1];
  return x * x + y * y;
}

/** Iterative Douglas-Peucker; keeps both endpoints. */
export function simplify(points: number[][], tolerance: number): number[][] {
  if (points.length <= 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const toleranceSq = tolerance * tolerance;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularDistanceSq(points[i], points[start], points[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index >= 0 && maxDistance > toleranceSq) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Projects and simplifies a polygon once per integer zoom level, so map panning only needs an
 * SVG transform instead of reprojecting every vertex on every frame.
 */
export function projectPolygon(polygon: PolygonWithHoles, zoom: number): ProjectedPolygon | null {
  let byZoom = cache.get(polygon);
  if (!byZoom) cache.set(polygon, byZoom = new Map());
  if (byZoom.has(zoom)) return byZoom.get(zoom)!;
  const worldWidth = 256 * Math.pow(2, zoom);
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const parts: string[] = [];
  const rings = [polygon.outer, ...polygon.holes];
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
    const points = rings[ringIndex].map(([lat, lng]) => {
      const [x, y] = mercator(lat, lng);
      return [x * worldWidth, y * worldWidth];
    });
    // Sub-pixel rings are invisible; dropping them saves most of the cost of detailed coastlines.
    const ringBounds = points.reduce((b, [x, y]) => [
      Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y),
    ], [Infinity, Infinity, -Infinity, -Infinity]);
    if (ringBounds[2] - ringBounds[0] < 1 && ringBounds[3] - ringBounds[1] < 1) {
      if (ringIndex === 0) break;
      continue;
    }
    const simplified = simplify(points, 0.5);
    if (simplified.length < 3) {
      if (ringIndex === 0) break;
      continue;
    }
    if (ringIndex === 0) {
      bounds[0] = ringBounds[0]; bounds[1] = ringBounds[1];
      bounds[2] = ringBounds[2]; bounds[3] = ringBounds[3];
    }
    parts.push(simplified.map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join('') + 'Z');
  }
  const result = parts.length && Number.isFinite(bounds[0]) ? { path: parts.join(''), bounds } : null;
  byZoom.set(zoom, result);
  return result;
}
