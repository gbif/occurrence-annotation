import type { OccurrenceFilterOptions } from '../components/OccurrenceFilters';
import { getGbifApiUrl } from './apiConfig';
import { fetchCountryPolygons } from './countryPolygons';
import { parseWKTGeometry, type PolygonWithHoles } from './wktParser';

export interface CoordinateLessCountry {
  code: string;
  name: string;
  count: number;
  polygons: PolygonWithHoles[];
}

export function coordinateLessCountryQuery(
  taxonKey: string, filters: OccurrenceFilterOptions, checklistKey?: string
): string {
  const params = new URLSearchParams({
    taxonKey,
    hasCoordinate: 'false',
    limit: '0',
    facet: 'country',
    facetLimit: '300',
    facetMincount: '1',
  });
  if (checklistKey) params.set('checklistKey', checklistKey);
  else if (!/^\d+$/.test(taxonKey)) {
    params.set('checklistKey', '7ddf754f-d193-4cc9-b351-99906754a03b');
  }
  if (filters.showOnlyPresent !== false) params.set('occurrenceStatus', 'PRESENT');
  if (filters.datasetKey) params.set('datasetKey', filters.datasetKey);
  if (filters.year) params.set('year', filters.year);
  if (filters.yearRange) params.append('year', `${filters.yearRange.min},${filters.yearRange.max}`);
  if (filters.hasGeospatialIssue !== undefined) {
    params.set('hasGeospatialIssue', String(filters.hasGeospatialIssue));
  }
  filters.basisOfRecord?.forEach(value => params.append('basisOfRecord', value));
  if (filters.distanceFromCentroid) params.set('distanceFromCentroidInMeters', '0,5000');
  return params.toString();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseCountryFacet(data: unknown): Array<{ code: string; count: number }> {
  if (!isObject(data) || !Array.isArray(data.facets)) {
    throw new Error('GBIF returned an invalid country facet response');
  }
  const facet = data.facets.find(
    (value: unknown) => isObject(value) && value.field === 'COUNTRY'
  );
  if (!isObject(facet) || !Array.isArray(facet.counts)) {
    throw new Error('GBIF country facet is missing');
  }
  // GBIF uses ZZ for an unknown country; there is no boundary to draw.
  return facet.counts.map((value: unknown) => {
    if (!isObject(value) || typeof value.name !== 'string' || !/^[A-Z]{2}$/.test(value.name) ||
        typeof value.count !== 'number' || !Number.isSafeInteger(value.count) || value.count < 0) {
      throw new Error('GBIF returned an invalid country count');
    }
    return { code: value.name, count: value.count };
  }).filter(value => value.count > 0 && value.code !== 'ZZ');
}

let boundaries: ReturnType<typeof fetchCountryPolygons> | undefined;

export async function fetchCoordinateLessCountries(
  query: string, signal: AbortSignal
): Promise<CoordinateLessCountry[]> {
  const response = await fetch(getGbifApiUrl(`/occurrence/search?${query}`), { signal });
  if (!response.ok) throw new Error(`GBIF country facet request failed (${response.status})`);
  const counts = parseCountryFacet(await response.json());
  if (!counts.length) return [];
  if (!boundaries) {
    boundaries = fetchCountryPolygons().catch(error => {
      boundaries = undefined;
      throw error;
    });
  }
  const countries = await boundaries;
  const result: CoordinateLessCountry[] = [];
  for (const { code, count } of counts) {
    const matches = countries.filter(country => country.iso2 === code || country.identifier === code);
    if (!matches.length) throw new Error(`No country boundary available for ${code}`);
    for (const country of matches) {
      const geometry = parseWKTGeometry(country.wkt);
      if (!geometry) throw new Error(`Invalid country boundary for ${code}`);
      result.push({
        code, name: country.name, count,
        polygons: 'polygons' in geometry ? geometry.polygons : [geometry],
      });
    }
  }
  return result;
}
