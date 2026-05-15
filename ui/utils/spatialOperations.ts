import polygonClipping from 'polygon-clipping';
import { parseWKTGeometry, PolygonWithHoles, MultiPolygon } from './wktParser';
import buffer from '@turf/buffer';
import simplify from '@turf/simplify';
import { polygon as turfPolygon } from '@turf/helpers';

// Type definitions for polygon-clipping
type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

// Cache for loaded ocean polygons
let oceanPolygonCache: MultiPolygon | null = null;

/**
 * Load the Ocean polygon from ocean_polygon.json
 * Returns MultiPolygon in polygon-clipping format: [[[lng, lat], ...], ...][]
 */
async function loadOceanPolygon(): Promise<MultiPolygon | null> {
  if (oceanPolygonCache) {
    return oceanPolygonCache;
  }

  try {
    const response = await fetch('/ocean_polygon.json');
    
    if (!response.ok) {
      console.error(`Failed to fetch ocean polygon: ${response.status} ${response.statusText} - ${response.url}`);
      return null;
    }
    
    const boundaries = await response.json();
    
    // Find the Ocean boundary
    const oceanBoundary = boundaries.find(
      (b: any) => b.identifier === 'OCEAN' && b.type === 'IHO'
    );
    
    if (!oceanBoundary || !oceanBoundary.wkt) {
      console.error('Ocean boundary not found in ocean_polygon.json');
      return null;
    }

    // Parse the WKT MULTIPOLYGON
    const parsedGeometry = parseWKTGeometry(oceanBoundary.wkt);
    if (!parsedGeometry) {
      console.error('Failed to parse Ocean WKT geometry');
      return null;
    }

    // Normalize to array of PolygonWithHoles
    const polygons: PolygonWithHoles[] = 'polygons' in parsedGeometry 
      ? parsedGeometry.polygons 
      : [parsedGeometry];

    // Convert to polygon-clipping format: [[[lng, lat], ...], ...][]
    // WKT parser returns [lat, lng] format, need to convert to [lng, lat]
    const oceanMultiPolygon: MultiPolygon = polygons.map((poly: PolygonWithHoles) => {
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
      console.timeEnd('buffer-polygon');
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
      console.timeEnd('buffer-polygon');
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

    // Simplify the buffered geometry to reduce vertex count
    // Goal: Keep vertex count similar to or less than original polygon
    // Start with aggressive tolerance and iterate if needed
    const originalVertexCount = userPolygon.length;
    let tolerance = 0.001; // Start with ~111m at equator
    let simplified = simplify(buffered, { tolerance, highQuality: true });
    
    // Try progressively more aggressive simplification if vertex count is still too high
    if (simplified && simplified.geometry) {
      let currentVertexCount = 0;
      
      if (simplified.geometry.type === 'Polygon') {
        currentVertexCount = simplified.geometry.coordinates[0].length - 1;
      } else if (simplified.geometry.type === 'MultiPolygon') {
        currentVertexCount = simplified.geometry.coordinates.reduce((sum, poly) => sum + poly[0].length - 1, 0);
      }
      
      // Increase tolerance if we have more than 1.5x the original vertices
      while (currentVertexCount > originalVertexCount * 1.5 && tolerance < 0.01) {
        tolerance *= 1.5;
        const newSimplified = simplify(buffered, { tolerance, highQuality: true });
        if (newSimplified && newSimplified.geometry) {
          simplified = newSimplified;
          if (simplified.geometry.type === 'Polygon') {
            currentVertexCount = simplified.geometry.coordinates[0].length - 1;
          } else if (simplified.geometry.type === 'MultiPolygon') {
            currentVertexCount = simplified.geometry.coordinates.reduce((sum, poly) => sum + poly[0].length - 1, 0);
          }
        } else {
          break;
        }
      }
      
      console.log(`Simplification: ${currentVertexCount} vertices (target: ~${originalVertexCount}, tolerance: ${tolerance.toFixed(4)}°)`);
    }
    
    if (!simplified || !simplified.geometry) {
      console.warn('Simplification failed, using unsimplified buffer result');
      // Continue with buffered result
    } else {
      // Use simplified result
      buffered.geometry = simplified.geometry;
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
      
      console.log(`Buffer succeeded: ${result.length} vertices (original: ${userPolygon.length})`);
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
      
      const totalVertices = polygons.reduce((sum, p) => sum + p.length, 0);
      console.log(`Buffer succeeded: ${polygons.length} polygon pieces, ${totalVertices} total vertices (original: ${userPolygon.length})`);
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

/**
 * Union (merge) multiple polygons into a single polygon
 * Overlapping areas are dissolved into one continuous polygon
 * 
 * @param polygons - Array of polygons in [lat, lng][] format
 * @returns Unified polygon(s) or null if operation fails
 *          - Single polygon: [lat, lng][]
 *          - Multiple disconnected pieces: [lat, lng][][]
 */
export function unionPolygons(
  polygons: [number, number][][]
): [number, number][] | [number, number][][] | null {
  console.time('union-polygons');
  
  try {
    if (!polygons || polygons.length === 0) {
      console.error('No polygons provided for union');
      return null;
    }

    if (polygons.length === 1) {
      console.log('Only one polygon provided, returning as-is');
      console.timeEnd('union-polygons');
      return polygons[0];
    }

    console.log(`Computing union of ${polygons.length} polygons`);

    // Convert all polygons to polygon-clipping format
    const polyClippingPolygons: Polygon[] = polygons.map(poly => 
      coordinatesToPolygon(poly)
    );

    // Compute union using polygon-clipping
    // union(...polygons) merges all provided polygons
    const result = polygonClipping.union(...polyClippingPolygons);
    
    if (!result || result.length === 0) {
      console.error('Union operation returned empty result');
      console.timeEnd('union-polygons');
      return null;
    }

    console.log(`Union result: ${result.length} polygon piece(s)`);
    
    // Convert result back to app format
    const unionedPolygon = polygonToCoordinates(result);
    
    if (Array.isArray(unionedPolygon) && unionedPolygon.length > 0) {
      if (Array.isArray(unionedPolygon[0]) && Array.isArray(unionedPolygon[0][0])) {
        // MultiPolygon result (disconnected pieces)
        const totalVertices = (unionedPolygon as [number, number][][]).reduce((sum, p) => sum + p.length, 0);
        console.log(`Union succeeded: ${(unionedPolygon as [number, number][][]).length} disconnected pieces, ${totalVertices} total vertices`);
      } else {
        // Single polygon result
        console.log(`Union succeeded: ${(unionedPolygon as [number, number][]).length} vertices`);
      }
    }
    
    console.timeEnd('union-polygons');
    return unionedPolygon;
  } catch (error) {
    console.error('Error during polygon union:', error);
    console.timeEnd('union-polygons');
    return null;
  }
}

/**
 * Erase (subtract) an area from a polygon
 * The eraseArea is removed from the targetPolygon
 * 
 * @param targetPolygon - Polygon to erase from in [lat, lng][] or [lat, lng][][] format
 * @param eraseArea - Area to erase in [lat, lng][] format
 * @returns Modified polygon(s) or null if operation fails
 *          - Single polygon: [lat, lng][]
 *          - Multiple disconnected pieces: [lat, lng][][]
 *          - Completely erased: null
 */
export function eraseFromPolygon(
  targetPolygon: [number, number][] | [number, number][][],
  eraseArea: [number, number][]
): [number, number][] | [number, number][][] | null {
  console.time('erase-polygon');
  
  try {
    if (!targetPolygon || !eraseArea || eraseArea.length < 3) {
      console.error('Invalid input for erase operation');
      return null;
    }

    console.log('Computing erase operation...');

    // Check polygon complexity and simplify if necessary
    const isMulti = Array.isArray(targetPolygon[0]) && Array.isArray(targetPolygon[0][0]);
    let totalVertices = 0;
    
    if (isMulti) {
      const parts = targetPolygon as [number, number][][];
      totalVertices = parts.reduce((sum, part) => sum + part.length, 0);
    } else {
      totalVertices = (targetPolygon as [number, number][]).length;
    }
    
    console.log(`Target polygon has ${totalVertices} total vertices`);
    
    // Safeguard: Reject extremely complex polygons to prevent crashes
    if (totalVertices > 5000) {
      console.error(`Polygon too complex for erase operation: ${totalVertices} vertices (max 5000)`);
      throw new Error('Polygon has too many vertices for erase operation. Try simplifying first.');
    }
    
    // Simplify if polygon is moderately complex (500-5000 vertices)
    let processedTarget = targetPolygon;
    if (totalVertices > 500) {
      console.log('Simplifying polygon before erase operation...');
      
      try {
        if (isMulti) {
          const parts = targetPolygon as [number, number][][];
          const simplifiedParts: [number, number][][] = [];
          
          for (const part of parts) {
            // Skip invalid parts
            if (!Array.isArray(part) || part.length < 3) {
              console.warn('Skipping invalid polygon part during simplification');
              continue;
            }
            
            // Convert to GeoJSON for simplification
            const geoJson = {
              type: 'Feature' as const,
              geometry: {
                type: 'Polygon' as const,
                coordinates: [part.map(coord => {
                  if (!Array.isArray(coord) || coord.length < 2) {
                    throw new Error('Invalid coordinate in polygon part');
                  }
                  const [lat, lng] = coord;
                  return [lng, lat];
                })]
              },
              properties: {}
            };
            
            const simplified = simplify(geoJson, { tolerance: 0.001, highQuality: false, mutate: false });
            
            // Validate simplified result
            if (!simplified?.geometry?.coordinates?.[0] || !Array.isArray(simplified.geometry.coordinates[0])) {
              console.warn('Simplification returned invalid structure, using original part');
              simplifiedParts.push(part);
              continue;
            }
            
            const simplifiedCoords = simplified.geometry.coordinates[0].map(coord => {
              if (!Array.isArray(coord) || coord.length < 2) {
                throw new Error('Invalid coordinate in simplified result');
              }
              const [lng, lat] = coord;
              return [lat, lng] as [number, number];
            });
            
            // Ensure we have at least 3 coordinates
            if (simplifiedCoords.length < 3) {
              console.warn('Simplified polygon has too few vertices, using original');
              simplifiedParts.push(part);
            } else {
              simplifiedParts.push(simplifiedCoords);
            }
          }
          
          if (simplifiedParts.length === 0) {
            console.warn('No valid parts after simplification, using original');
            processedTarget = targetPolygon;
          } else {
            processedTarget = simplifiedParts;
            const newTotal = simplifiedParts.reduce((sum, part) => sum + part.length, 0);
            console.log(`Simplified multi-polygon from ${totalVertices} to ${newTotal} vertices`);
          }
        } else {
          const coords = targetPolygon as [number, number][];
          
          // Validate input
          if (!Array.isArray(coords) || coords.length < 3) {
            throw new Error('Invalid polygon coordinates for simplification');
          }
          
          // Convert to GeoJSON for simplification
          const geoJson = {
            type: 'Feature' as const,
            geometry: {
              type: 'Polygon' as const,
              coordinates: [coords.map(coord => {
                if (!Array.isArray(coord) || coord.length < 2) {
                  throw new Error('Invalid coordinate in polygon');
                }
                const [lat, lng] = coord;
                return [lng, lat];
              })]
            },
            properties: {}
          };
          
          const simplified = simplify(geoJson, { tolerance: 0.001, highQuality: false, mutate: false });
          
          // Validate simplified result
          if (!simplified?.geometry?.coordinates?.[0] || !Array.isArray(simplified.geometry.coordinates[0])) {
            throw new Error('Simplification returned invalid structure');
          }
          
          const simplifiedCoords = simplified.geometry.coordinates[0].map(coord => {
            if (!Array.isArray(coord) || coord.length < 2) {
              throw new Error('Invalid coordinate in simplified result');
            }
            const [lng, lat] = coord;
            return [lat, lng] as [number, number];
          });
          
          // Ensure we have at least 3 coordinates
          if (simplifiedCoords.length < 3) {
            console.warn('Simplified polygon has too few vertices, using original');
            processedTarget = targetPolygon;
          } else {
            processedTarget = simplifiedCoords;
            console.log(`Simplified polygon from ${totalVertices} to ${simplifiedCoords.length} vertices`);
          }
        }
      } catch (simplifyError) {
        console.warn('Simplification failed, proceeding with original polygon:', simplifyError);
        processedTarget = targetPolygon;
      }
    }

    // Convert erase area to polygon-clipping format
    const erasePoly: Polygon = coordinatesToPolygon(eraseArea);

    // Check if target is multipolygon
    const targetIsMulti = Array.isArray(processedTarget[0]) && Array.isArray(processedTarget[0][0]);
    
    let result: MultiPolygon;
    
    if (targetIsMulti) {
      // Target is multi-polygon - erase from all parts
      const targetParts = processedTarget as [number, number][][];
      const targetPolys: Polygon[] = targetParts.map(part => coordinatesToPolygon(part));
      
      console.log(`Erasing from multi-polygon with ${targetParts.length} parts`);
      
      // Compute difference for each part and combine results
      const results: MultiPolygon = [];
      for (const targetPoly of targetPolys) {
        try {
          const partResult = polygonClipping.difference(targetPoly, erasePoly);
          if (partResult && partResult.length > 0) {
            results.push(...partResult);
          }
        } catch (partError) {
          console.warn('Failed to erase from one polygon part, skipping:', partError);
          // Keep the original part if erase fails
          results.push([targetPoly[0]]);
        }
      }
      result = results;
    } else {
      // Target is single polygon
      const targetPoly: Polygon = coordinatesToPolygon(processedTarget as [number, number][]);
      console.log(`Erasing from single polygon with ${(processedTarget as [number, number][]).length} vertices`);
      
      // Compute difference using polygon-clipping
      result = polygonClipping.difference(targetPoly, erasePoly);
    }
    
    if (!result || result.length === 0) {
      console.log('Erase result: Polygon completely erased');
      console.timeEnd('erase-polygon');
      return null;
    }

    console.log(`Erase result: ${result.length} polygon piece(s)`);
    
    // Convert result back to app format
    const erasedPolygon = polygonToCoordinates(result);
    
    // Validate the result structure before returning
    if (erasedPolygon) {
      const isResultMulti = Array.isArray(erasedPolygon[0]) && Array.isArray(erasedPolygon[0][0]);
      
      if (isResultMulti) {
        // MultiPolygon result - validate each part
        const parts = erasedPolygon as [number, number][][];
        for (const part of parts) {
          if (!Array.isArray(part) || part.length < 3) {
            throw new Error('Invalid polygon part in result: insufficient vertices');
          }
          for (const coord of part) {
            if (!Array.isArray(coord) || coord.length < 2 || typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
              throw new Error('Invalid coordinate in result polygon');
            }
          }
        }
        console.log(`Erase succeeded: ${parts.length} disconnected piece${parts.length > 1 ? 's' : ''}`);
      } else {
        // Single polygon result - validate coordinates
        const coords = erasedPolygon as [number, number][];
        if (!Array.isArray(coords) || coords.length < 3) {
          throw new Error('Invalid result polygon: insufficient vertices');
        }
        for (const coord of coords) {
          if (!Array.isArray(coord) || coord.length < 2 || typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
            throw new Error('Invalid coordinate in result polygon');
          }
        }
        console.log(`Erase succeeded: ${coords.length} vertices`);
      }
    }
    
    console.timeEnd('erase-polygon');
    return erasedPolygon;
  } catch (error) {
    console.error('Error during erase operation:', error);
    console.timeEnd('erase-polygon');
    throw error; // Re-throw to allow caller to handle
  }
}
