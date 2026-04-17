import polygonClipping from 'polygon-clipping';
import { parseWKTGeometry, PolygonWithHoles } from './wktParser';

// Type definitions for polygon-clipping
type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

// Cache for loaded ocean polygons
let oceanPolygonCache: MultiPolygon | null = null;

/**
 * Load the Ocean polygon from country_polygons.json
 * Returns MultiPolygon in polygon-clipping format: [[[lng, lat], ...], ...][]
 */
async function loadOceanPolygon(): Promise<MultiPolygon | null> {
  if (oceanPolygonCache) {
    return oceanPolygonCache;
  }

  try {
    const response = await fetch('/country_polygons.json');
    const boundaries = await response.json();
    
    // Find the Ocean boundary
    const oceanBoundary = boundaries.find(
      (b: any) => b.identifier === 'OCEAN' && b.type === 'IHO'
    );
    
    if (!oceanBoundary || !oceanBoundary.wkt) {
      console.error('Ocean boundary not found in country_polygons.json');
      return null;
    }

    // Parse the WKT MULTIPOLYGON
    const parsedGeometry = parseWKTGeometry(oceanBoundary.wkt);
    if (!parsedGeometry || !parsedGeometry.polygons) {
      console.error('Failed to parse Ocean WKT geometry');
      return null;
    }

    // Convert to polygon-clipping format: [[[lng, lat], ...], ...][]
    // WKT parser returns [lat, lng] format, need to convert to [lng, lat]
    const oceanMultiPolygon: MultiPolygon = parsedGeometry.polygons.map((poly: PolygonWithHoles) => {
      // Outer ring
      const outerRing: Ring = poly.outer.map(([lat, lng]) => [lng, lat]);
      
      // Holes (if any)
      const holes: Ring[] = poly.holes?.map(hole => 
        hole.map(([lat, lng]) => [lng, lat])
      ) || [];
      
      // Polygon is: [outerRing, ...holes]
      return [outerRing, ...holes];
    });

    oceanPolygonCache = oceanMultiPolygon;

    console.log(`Ocean polygon loaded: ${oceanMultiPolygon.length} polygon(s), ${oceanBoundary.vertexCount} vertices`);
    return oceanPolygonCache;
  } catch (error) {
    console.error('Failed to load Ocean polygon:', error);
    return null;
  }
}

/**
 * Convert app's internal [lat, lng][] format to polygon-clipping Polygon format
 * polygon-clipping format: [[[lng, lat], ...]] (array of rings, first is outer ring)
 */
function coordinatesToPolygon(coords: [number, number][]): Polygon {
  // Convert from [lat, lng] to [lng, lat]
  const ring: Ring = coords.map(([lat, lng]) => [lng, lat]);
  
  // Ensure polygon is closed (first point === last point)
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  
  // Return as Polygon (array of rings - just outer ring, no holes)
  return [ring];
}

/**
 * Convert polygon-clipping MultiPolygon back to app's internal format
 * Returns [lat, lng][] for single polygon or [lat, lng][][] for multiple polygons
 */
function polygonToCoordinates(multiPolygon: MultiPolygon): [number, number][] | [number, number][][] | null {
  if (!multiPolygon || multiPolygon.length === 0) {
    return null;
  }

  if (multiPolygon.length === 1) {
    // Single polygon: return [lat, lng][]
    const polygon = multiPolygon[0];
    const outerRing = polygon[0];  // First ring is outer ring
    
    // Convert from [lng, lat] to [lat, lng] and remove the closing point
    const coords: [number, number][] = outerRing
      .slice(0, -1)  // Remove closing point
      .map(([lng, lat]) => [lat, lng]);
    
    return coords;
  } else {
    // Multiple polygons: return [lat, lng][][]
    const polygons: [number, number][][] = multiPolygon.map(polygon => {
      const outerRing = polygon[0];  // First ring is outer ring
      return outerRing
        .slice(0, -1)  // Remove closing point
        .map(([lng, lat]): [number, number] => [lat, lng]);
    });
    
    return polygons;
  }
}

/**
 * Subtract the Ocean polygon from a user-drawn polygon to create a land-only polygon
 * 
 * @param userPolygon - User's drawn polygon in [lat, lng][] format
 * @returns Land-only polygon(s), or null if entirely over ocean
 *          - Single polygon: [lat, lng][]
 *          - Multiple disconnected land areas: [lat, lng][][]
 *          - No land: null
 */
export async function subtractOceanFromPolygon(
  userPolygon: [number, number][]
): Promise<[number, number][] | [number, number][][] | null> {
  console.time('subtract-ocean');
  
  try {
    // Load ocean MultiPolygon (cached after first load)
    const oceanMultiPolygon = await loadOceanPolygon();
    if (!oceanMultiPolygon) {
      throw new Error('Failed to load Ocean polygon');
    }

    // Convert user polygon to polygon-clipping format
    const userPoly: Polygon = coordinatesToPolygon(userPolygon);
    
    console.log('Computing polygon difference...');
    console.log(`  User polygon: ${userPolygon.length} vertices`);
    console.log(`  Ocean: ${oceanMultiPolygon.length} polygon pieces`);

    // Use polygon-clipping to subtract ocean from user polygon
    // difference(polygon, ...polygons) subtracts all following polygons from the first
    const result = polygonClipping.difference(userPoly, ...oceanMultiPolygon);
    
    if (!result || result.length === 0) {
      console.log('Result: Polygon is entirely over ocean');
      console.timeEnd('subtract-ocean');
      return null;
    }

    console.log(`Result: ${result.length} polygon piece(s)`);
    
    // Convert result back to app format
    const landPolygon = polygonToCoordinates(result);
    
    if (Array.isArray(landPolygon) && landPolygon.length > 0) {
      if (Array.isArray(landPolygon[0]) && Array.isArray(landPolygon[0][0])) {
        // MultiPolygon result
        console.log(`Ocean subtraction succeeded: ${(landPolygon as [number, number][][]).length} disconnected land areas`);
      } else {
        // Single polygon result
        console.log(`Ocean subtraction succeeded: ${(landPolygon as [number, number][]).length} vertices`);
      }
    }
    
    console.timeEnd('subtract-ocean');
    return landPolygon;
  } catch (error) {
    console.error('Error during ocean subtraction:', error);
    console.timeEnd('subtract-ocean');
    throw error;
  }
}
