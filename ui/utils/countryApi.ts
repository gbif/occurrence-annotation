/**
 * Country API client for fetching country geometries from static JSON.
 * Data is served from public folder (no backend required).
 */

export interface Country {
  iso2: string;
  name: string;
  wkt: string;
  vertexCount: number;
}

// In-memory cache for country list (loaded once per session)
let countryCache: Country[] | null = null;

/**
 * Fetch all country geometries from static JSON file.
 * Results are cached in memory after first load.
 * 
 * @returns Promise resolving to array of Country objects
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
 * Clear the country cache (useful for forcing reload).
 */
export function clearCountryCache(): void {
  countryCache = null;
}
