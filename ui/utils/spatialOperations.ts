import polygonClipping from 'polygon-clipping';
import { parseWKTGeometry, PolygonWithHoles } from './wktParser';
import buffer from '@turf/buffer';
import { polygon as turfPolygon } from '@turf/helpers';

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

/**
 * Buffer (expand or shrink) a polygon by a specified distance
 * 
 * @param userPolygon - User's polygon in [lat, lng][] format
 * @param distanceMeters - Distance to buffer in meters (positive = expand, negative = shrink)
 * @returns Buffered polygon(s), or null if operation fails
 *          - Single polygon: [lat, lng][]
 *          - Multiple polygons (from self-intersection): [lat, lng][][]
 *          - Failed operation: null
 */
export function bufferPolygon(
  userPolygon: [number, number][],
  distanceMeters: number
): [number, number][] | [number, number][][] | null {
  console.time('buffer-polygon');
  
  try {
    if (!userPolygon || userPolygon.length < 3) {
      console.error('Invalid polygon for buffering');
      return null;
    }

    if (distanceMeters === 0) {
      console.warn('Buffer distance is 0, returning original polygon');
      console.timeEnd('buffer-polygon');
      return userPolygon;
    }

    console.log(`Buffering polygon by ${distanceMeters}m (${userPolygon.length} vertices)`);

    // Validate input coordinates
    const hasInvalidCoords = userPolygon.some(([lat, lng]) => 
      lat < -90 || lat > 90 || lng < -180 || lng > 180 || isNaN(lat) || isNaN(lng)
    );
    
    if (hasInvalidCoords) {
      console.error('Input polygon contains invalid coordinates (lat must be -90 to 90, lng must be -180 to 180)');
      return null;
    }

    // Convert [lat, lng][] to GeoJSON polygon format [lng, lat][]
    const coordinates = userPolygon.map(([lat, lng]) => [lng, lat]);
    
    // Ensure polygon is closed for Turf
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coordinates.push([first[0], first[1]]);
    }

    // Create Turf polygon
    const turfPoly = turfPolygon([coordinates]);

    // Convert meters to kilometers for Turf
    const distanceKm = distanceMeters / 1000;

    // Perform buffer operation
    // steps=8 controls smoothness of curved corners (default is 8)
    const buffered = buffer(turfPoly, distanceKm, { units: 'kilometers', steps: 8 });

    if (!buffered || !buffered.geometry) {
      console.error('Buffer operation returned null or invalid geometry');
      console.timeEnd('buffer-polygon');
      return null;
    }

    // Handle different geometry types
    const geomType = buffered.geometry.type;
    
    if (geomType === 'Polygon') {
      // Single polygon result
      const coords = buffered.geometry.coordinates[0]; // Outer ring
      
      // Convert back to [lat, lng][] and remove closing point
      // Also clamp coordinates to valid geographic bounds
      let clampedCount = 0;
      const result: [number, number][] = coords
        .slice(0, -1)
        .map(([lng, lat]): [number, number] => {
          // Clamp latitude to -90..90
          const clampedLat = Math.max(-90, Math.min(90, lat));
          // Wrap longitude to -180..180
          let clampedLng = lng;
          while (clampedLng > 180) clampedLng -= 360;
          while (clampedLng < -180) clampedLng += 360;
          
          if (clampedLat !== lat || clampedLng !== lng) {
            clampedCount++;
          }
          
          return [clampedLat, clampedLng];
        });
      
      if (clampedCount > 0) {
        console.warn(`⚠️ ${clampedCount} coordinates were clamped to valid geographic bounds. Buffer may be too large for this polygon.`);
      }
      
      console.log(`Buffer succeeded: ${result.length} vertices`);
      console.timeEnd('buffer-polygon');
      return result;
      
    } else if (geomType === 'MultiPolygon') {
      // Multiple polygons (can happen with self-intersecting results)
      let totalClampedCount = 0;
      const polygons: [number, number][][] = buffered.geometry.coordinates.map(poly => {
        const outerRing = poly[0]; // First ring is outer ring
        return outerRing
          .slice(0, -1)
          .map(([lng, lat]): [number, number] => {
            // Clamp latitude to -90..90
            const clampedLat = Math.max(-90, Math.min(90, lat));
            // Wrap longitude to -180..180
            let clampedLng = lng;
            while (clampedLng > 180) clampedLng -= 360;
            while (clampedLng < -180) clampedLng += 360;
            
            if (clampedLat !== lat || clampedLng !== lng) {
              totalClampedCount++;
            }
            
            return [clampedLat, clampedLng];
          });
      });
      
      if (totalClampedCount > 0) {
        console.warn(`⚠️ ${totalClampedCount} coordinates were clamped to valid geographic bounds. Buffer may be too large for this polygon.`);
      }
      
      console.log(`Buffer succeeded: ${polygons.length} polygon pieces`);
      console.timeEnd('buffer-polygon');
      return polygons;
      
    } else {
      console.error(`Unexpected geometry type from buffer: ${geomType}`);
      console.timeEnd('buffer-polygon');
      return null;
    }

  } catch (error) {
    console.error('Error during buffer operation:', error);
    console.timeEnd('buffer-polygon');
    return null;
  }
}

/**
 * Buffer a multi-polygon (array of polygons) by a specified distance
 * 
 * @param multiPolygon - Array of polygons in [lat, lng][][] format
 * @param distanceMeters - Distance to buffer in meters (positive = expand, negative = shrink)
 * @returns Buffered multi-polygon or null if operation fails
 */
export function bufferMultiPolygon(
  multiPolygon: [number, number][][],
  distanceMeters: number
): [number, number][][] | null {
  console.time('buffer-multipolygon');
  
  try {
    if (!multiPolygon || multiPolygon.length === 0) {
      console.error('Invalid multi-polygon for buffering');
      return null;
    }

    console.log(`Buffering multi-polygon with ${multiPolygon.length} parts`);

    // Buffer each polygon part separately
    const bufferedParts: [number, number][][] = [];
    
    for (let i = 0; i < multiPolygon.length; i++) {
      const part = multiPolygon[i];
      const result = bufferPolygon(part, distanceMeters);
      
      if (!result) {
        console.warn(`Failed to buffer polygon part ${i + 1}/${multiPolygon.length}`);
        continue;
      }
      
      // Handle both single and multi-polygon results from buffer
      if (Array.isArray(result[0]) && Array.isArray(result[0][0])) {
        // Result is multi-polygon, add all parts
        bufferedParts.push(...(result as [number, number][][]));
      } else {
        // Result is single polygon, add as one part
        bufferedParts.push(result as [number, number][]);
      }
    }

    if (bufferedParts.length === 0) {
      console.error('All polygon parts failed to buffer');
      console.timeEnd('buffer-multipolygon');
      return null;
    }

    console.log(`Multi-polygon buffer succeeded: ${bufferedParts.length} polygon parts`);
    console.timeEnd('buffer-multipolygon');
    return bufferedParts;

  } catch (error) {
    console.error('Error during multi-polygon buffer operation:', error);
    console.timeEnd('buffer-multipolygon');
    return null;
  }
}
