/**
 * Boundary API client for fetching geographic boundary geometries from static JSON.
 * Supports Political (countries), Continent, and IHO (ocean) boundary types.
 * Data is served from public folder (no backend required).
 */

export type BoundaryType = 'Political' | 'Continent' | 'IHO';

export interface Country {
  identifier: string;      // Unified ID: ISO2 for Political, title for Continent/IHO
  type: BoundaryType;      // Boundary type
  name: string;            // Display name
  wkt: string;             // Well-Known Text geometry
  vertexCount: number;     // Number of vertices (performance metric)
  iso2?: string;           // Optional ISO2 code (only for Political type, for backward compat)
}

// In-memory cache for boundary list (loaded once per session)
let countryCache: Country[] | null = null;

/**
 * Fetch all geographic boundary geometries from static JSON file.
 * Results are cached in memory after first load.
 * 
 * @returns Promise resolving to array of boundary objects (Political, Continent, IHO)
 * @throws Error if fetch fails
 */
export async function fetchCountryGeometries(): Promise<Country[]> {
  // Return cached data if available
  if (countryCache !== null) {
    return countryCache;
  }

  try {
    // Use relative path from public folder (Vite serves public files from base path)
    const url = `${import.meta.env.BASE_URL}country_polygons.json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch countries: ${response.status} ${response.statusText}`);
    }

    const countries: Country[] = await response.json();
    
    // Debug logging
    console.log('[countryApi] Loaded boundaries:', countries.length);
    const typeBreakdown = countries.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[countryApi] By type:', typeBreakdown);
    console.log('[countryApi] Sample items:', {
      political: countries.find(c => c.type === 'Political')?.name,
      continent: countries.find(c => c.type === 'Continent')?.name,
      iho: countries.find(c => c.type === 'IHO')?.name
    });
    
    // Cache for subsequent requests
    countryCache = countries;
    
    return countries;
  } catch (error) {
    console.error('Error fetching country geometries:', error);
    throw new Error(
      error instanceof Error 
        ? `Failed to load countries: ${error.message}` 
        : 'Failed to load countries'
    );
  }
}

/**
 * Get WKT geometry for a specific country by ISO2 code.
 * 
 * @param iso2 - ISO 3166-1 alpha-2 country code (e.g., "US", "GB")
 * @returns Promise resolving to WKT string
 * @throws Error if country not found or fetch fails
 */
export async function getCountryWKT(iso2: string): Promise<string> {
  try {
    const response = await fetch(getAnnotationApiUrl(`/countries/${iso2.toUpperCase()}/geometry`));
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Country not found: ${iso2}`);
      }
      throw new Error(`Failed to fetch country: ${response.status} ${response.statusText}`);
    }

    const country: Country = await response.json();
    return country.wkt;
  } catch (error) {
    console.error(`Error fetching country ${iso2}:`, error);
    throw error;
  }
}

/**
 * Get multiple country WKTs and merge them into a single multipolygon.
 * 
 * @param iso2Codes - Array of ISO2 country codes
 * @returns Promise resolving to merged WKT string (MULTIPOLYGON)
 * @throws Error if any country fails to load
 */
export async function getMergedCountryWKT(iso2Codes: string[]): Promise<string> {
  if (iso2Codes.length === 0) {
    return '';
  }

  try {
    // Fetch all countries (from cache if available)
    const allCountries = await fetchCountryGeometries();
    
    // Find requested countries
    const selectedCountries = allCountries.filter(c => 
      iso2Codes.map(code => code.toUpperCase()).includes(c.iso2.toUpperCase())
    );

    if (selectedCountries.length === 0) {
      throw new Error('No matching countries found');
    }

    if (selectedCountries.length !== iso2Codes.length) {
      const found = selectedCountries.map(c => c.iso2);
      const missing = iso2Codes.filter(code => 
        !found.includes(code.toUpperCase())
      );
      console.warn('Some countries not found:', missing);
    }

    // Extract polygon parts from each WKT
    const polygonParts: string[] = [];

    for (const country of selectedCountries) {
      const wkt = country.wkt;
      
      if (wkt.startsWith('MULTIPOLYGON')) {
        // Extract inner polygons from MULTIPOLYGON(((...)),((...)))
        const match = wkt.match(/MULTIPOLYGON\s*\((.*)\)\s*$/i);
        if (match) {
          polygonParts.push(match[1]);
        }
      } else if (wkt.startsWith('POLYGON')) {
        // Convert POLYGON to multipolygon part: ((coords)) format
        const match = wkt.match(/POLYGON\s*\((.*)\)\s*$/i);
        if (match) {
          polygonParts.push(`(${match[1]})`);
        }
      }
    }

    if (polygonParts.length === 0) {
      throw new Error('Failed to parse country geometries');
    }

    // Combine into single MULTIPOLYGON
    return `MULTIPOLYGON(${polygonParts.join(',')})`;

  } catch (error) {
    console.error('Error merging country WKTs:', error);
    throw error;
  }
}

/**
 * Clear the boundary cache (useful for forcing reload).
 */
export function clearCountryCache(): void {
  countryCache = null;
}

/**
 * Filter boundaries by type.
 * 
 * @param boundaries - Array of boundary objects
 * @param types - Array of boundary types to include
 * @returns Filtered array containing only boundaries of specified types
 */
export function filterByType(boundaries: Country[], types: BoundaryType[]): Country[] {
  const filtered = boundaries.filter(b => types.includes(b.type));
  console.log('[countryApi] filterByType - requested:', types, 'total:', boundaries.length, 'filtered:', filtered.length);
  const typeBreakdown = filtered.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('[countryApi] filterByType - result breakdown:', typeBreakdown);
  return filtered;
}

/**
 * Group boundaries by type.
 * 
 * @param boundaries - Array of boundary objects
 * @returns Map of type to array of boundaries
 */
export function groupByType(boundaries: Country[]): Map<BoundaryType, Country[]> {
  const groups = new Map<BoundaryType, Country[]>();
  
  for (const boundary of boundaries) {
    const existing = groups.get(boundary.type) || [];
    existing.push(boundary);
    groups.set(boundary.type, existing);
  }
  
  return groups;
}

/**
 * Get display label for boundary type.
 * 
 * @param type - Boundary type
 * @returns Human-readable label
 */
export function getTypeLabel(type: BoundaryType): string {
  switch (type) {
    case 'Political':
      return 'Political Boundary';
    case 'Continent':
      return 'Continent';
    case 'IHO':
      return 'Ocean Region';
    default:
      return type;
  }
}
