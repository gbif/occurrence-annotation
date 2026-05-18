/**
 * Type definitions for country polygon data
 * Used with country_polygons.json static asset
 */

export interface CountryPolygon {
  /** ISO 2-letter country code or unique identifier */
  identifier: string;
  
  /** Type of boundary (always "country" for this dataset) */
  type: string;
  
  /** Display name of the country */
  name: string;
  
  /** Well-Known Text representation of the polygon geometry */
  wkt: string;
  
  /** Number of vertices in the polygon (after simplification) */
  vertexCount: number;
  
  /** ISO 2-letter country code (may be empty for overlapping claims) */
  iso2: string;
}

/**
 * Fetches country polygons from the static JSON asset
 * @returns Promise resolving to array of country polygons
 */
export async function fetchCountryPolygons(): Promise<CountryPolygon[]> {
  const response = await fetch('/country_polygons.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch country polygons: ${response.statusText}`);
  }
  return response.json();
}
