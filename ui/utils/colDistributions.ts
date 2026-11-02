import { getColApiUrl, getGbifApiUrl } from './apiConfig';
import type { PolygonWithHoles } from './wktParser';

const COL_DATASET = '3LXR';
const COL_CHECKLIST = '7ddf754f-d193-4cc9-b351-99906754a03b';
const MAX_LATITUDE = 85.0511287798;

export interface ColDistributionArea {
  id: string;
  name: string;
  establishmentMeans: string[];
  polygons: PolygonWithHoles[];
}

export interface ColDistributionResult {
  areas: ColDistributionArea[];
  unmapped: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Distribution request failed (${response.status}): ${url}`);
  return response.json();
}

function parseRing(value: unknown): [number, number][] {
  if (!Array.isArray(value) || value.length < 4) throw new Error('Invalid COL polygon ring');
  const ring = value.map((point: unknown): [number, number] => {
    if (!Array.isArray(point) || typeof point[0] !== 'number' || typeof point[1] !== 'number' ||
        !Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
        Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) {
      throw new Error('Invalid COL polygon coordinate');
    }
    return [Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point[1])), point[0]];
  });
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('Unclosed COL polygon ring');
  for (let index = 1; index < ring.length; index++) {
    ring[index][1] += 360 * Math.round((ring[index - 1][1] - ring[index][1]) / 360);
  }
  return ring;
}

export function parseColGeometry(value: unknown): PolygonWithHoles[] {
  if (!isObject(value)) throw new Error('Invalid COL area GeoJSON');
  if (value.type === 'Feature') return parseColGeometry(value.geometry);
  if (value.type === 'FeatureCollection') {
    if (!Array.isArray(value.features)) throw new Error('Invalid COL area features');
    return value.features.flatMap(parseColGeometry);
  }
  if ((value.type !== 'Polygon' && value.type !== 'MultiPolygon') || !Array.isArray(value.coordinates)) {
    throw new Error('COL area has no polygon geometry');
  }
  const polygons: unknown[] = value.type === 'Polygon' ? [value.coordinates] : value.coordinates;
  if (!polygons.length) throw new Error('Empty COL polygon geometry');
  return polygons.map(polygon => {
    if (!Array.isArray(polygon) || !polygon.length) throw new Error('Invalid COL polygon');
    const [outer, ...holes] = polygon.map(parseRing);
    // Keep holes in the same longitude frame as a dateline-normalized exterior.
    const longitude = outer.reduce((sum, point) => sum + point[1], 0) / outer.length;
    return {
      outer,
      holes: holes.map(ring => {
        const holeLongitude = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
        const shift = 360 * Math.round((longitude - holeLongitude) / 360);
        return ring.map(([lat, lng]): [number, number] => [lat, lng + shift]);
      }),
    };
  });
}

async function resolveColKey(taxonKey: string, signal: AbortSignal): Promise<string> {
  const taxon = await fetchJson(getGbifApiUrl(`/species/${encodeURIComponent(taxonKey)}`), signal);
  if (!isObject(taxon) || typeof taxon.canonicalName !== 'string' || typeof taxon.rank !== 'string') {
    throw new Error('GBIF taxon lacks a canonical name or rank for COL matching');
  }
  const match = await fetchJson(getColApiUrl(
    `/dataset/${COL_DATASET}/match/nameusage?q=${encodeURIComponent(taxon.canonicalName)}`
  ), signal);
  if (!isObject(match) || !isObject(match.usage) || typeof match.usage.id !== 'string' ||
      match.usage.name !== taxon.canonicalName ||
      typeof match.usage.rank !== 'string' || match.usage.rank.toUpperCase() !== taxon.rank.toUpperCase()) {
    throw new Error('No exact COL name and rank match for this GBIF taxon');
  }
  return match.usage.id;
}

export async function fetchColDistributions(
  taxonKey: string, signal: AbortSignal, isColTaxon = !/^\d+$/.test(taxonKey)
): Promise<ColDistributionResult> {
  const key = isColTaxon ? taxonKey : await resolveColKey(taxonKey, signal);
  let dataset = COL_DATASET;
  if (isColTaxon) {
    const taxon = await fetchJson(new URL(
      `../v2/experimental/taxon/${COL_CHECKLIST}/${encodeURIComponent(key)}/info`,
      getGbifApiUrl('/')
    ).href, signal);
    if (!isObject(taxon) || taxon.taxonID !== key || typeof taxon.checklistbankURL !== 'string') {
      throw new Error('GBIF taxon lacks a matching ChecklistBank source');
    }
    const source = new URL(taxon.checklistbankURL);
    const match = source.pathname.match(/^\/dataset\/(\d+)\/taxon\/([^/]+)\/?$/);
    if (source.origin !== 'https://www.checklistbank.org' || !match ||
        decodeURIComponent(match[2]) !== key) {
      throw new Error('Invalid ChecklistBank source for GBIF taxon');
    }
    dataset = match[1];
  }
  const info = await fetchJson(getColApiUrl(
    `/dataset/${dataset}/taxon/${encodeURIComponent(key)}/info`
  ), signal);
  if (!isObject(info) || !isObject(info.usage)) throw new Error('Invalid COL taxon info');
  if (info.distributions === undefined) return { areas: [], unmapped: [] };
  if (!Array.isArray(info.distributions)) throw new Error('Invalid COL distributions');
  const areas = new Map<string, ColDistributionArea>();
  const unmapped = new Set<string>();
  for (const distribution of info.distributions) {
    if (!isObject(distribution) || !isObject(distribution.area)) {
      throw new Error('Invalid COL distribution area');
    }
    const { gazetteer, id, name } = distribution.area;
    if (typeof gazetteer !== 'string' || !gazetteer || typeof id !== 'string' || !id) {
      unmapped.add(typeof name === 'string' ? name : 'Unspecified area');
      continue;
    }
    const globalId = `${gazetteer}:${id}`;
    const area = areas.get(globalId) ?? {
      id: globalId, name: typeof name === 'string' ? name : globalId,
      establishmentMeans: [], polygons: [],
    };
    const means = distribution.establishmentMeans;
    if (means !== undefined && typeof means !== 'string') throw new Error('Invalid establishment means');
    if (means && !area.establishmentMeans.includes(means)) area.establishmentMeans.push(means);
    areas.set(globalId, area);
  }
  const entries = [...areas.values()];
  // Limit parallel downloads for taxa with many distribution areas.
  for (let offset = 0; offset < entries.length; offset += 6) {
    await Promise.all(entries.slice(offset, offset + 6).map(async area => {
      try {
        const geometry = await fetchJson(getColApiUrl(
          `/vocab/area/${encodeURIComponent(area.id).replace('%3A', ':')}.geojson`
        ), signal);
        area.polygons = parseColGeometry(geometry);
        if (!area.polygons.length) throw new Error('COL area has no polygons');
      } catch (error: unknown) {
        if (signal.aborted) throw error;
        console.warn(`COL distribution boundary unavailable for ${area.id}:`, error);
        unmapped.add(area.name);
      }
    }));
    signal.throwIfAborted();
  }
  return { areas: entries.filter(area => area.polygons.length > 0), unmapped: [...unmapped] };
}
