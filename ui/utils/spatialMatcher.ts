import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon, multiPolygon } from '@turf/helpers';
import type { Position, Polygon, MultiPolygon } from 'geojson';
import { parseWKTPolygon, parseWKTPolygonWithHoles, parseWKTMultiPolygon } from './wktParser';

export interface ParsedGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: Position[][] | Position[][][];
  isInverted: boolean;
}

/**
 * Detect if a polygon is inverted (global extent with holes)
 * Based on R package logic: outer ring spans >300° longitude AND >150° latitude
 */
export function detectInvertedPolygon(wkt: string): boolean {
  try {
    // Try parsing as polygon with holes first
    const parsed = parseWKTPolygonWithHoles(wkt);
    
    if (!parsed || !parsed.holes || parsed.holes.length === 0) {
      return false; // No holes, can't be inverted
    }
    
    // Check outer ring span
    const outerRing = parsed.outer;
    const lons = outerRing.map((coord: [number, number]) => coord[1]); // WKT uses [lat, lon]
    const lats = outerRing.map((coord: [number, number]) => coord[0]);
    
    const lonRange = Math.max(...lons) - Math.min(...lons);
    const latRange = Math.max(...lats) - Math.min(...lats);
    
    // Inverted if outer ring spans >300° longitude AND >150° latitude
    return lonRange > 300 && latRange > 150;
  } catch (error) {
    // If parsing fails, assume not inverted
    console.warn('Could not parse WKT for inversion detection:', error);
    return false;
  }
}

/**
 * Parse WKT geometry into GeoJSON format for Turf.js
 */
export function parseWKTGeometry(wkt: string): ParsedGeometry {
  const isInverted = detectInvertedPolygon(wkt);
  
  try {
    // Try MultiPolygon first
    if (wkt.toUpperCase().includes('MULTIPOLYGON')) {
      const multiPoly = parseWKTMultiPolygon(wkt);
      if (!multiPoly) {
        throw new Error('Failed to parse MULTIPOLYGON');
      }
      
      // Convert from [lat, lon] to [lon, lat] for GeoJSON
      const geoJsonCoords = multiPoly.polygons.map((polygon: any) => {
        const outerRing = polygon.outer.map((coord: [number, number]) => [coord[1], coord[0]] as Position);
        const holes = (polygon.holes || []).map((hole: [number, number][]) =>
          hole.map((coord: [number, number]) => [coord[1], coord[0]] as Position)
        );
        return [outerRing, ...holes];
      });
      
      return {
        type: 'MultiPolygon',
        coordinates: geoJsonCoords,
        isInverted,
      };
    }
    
    // Try Polygon with holes
    const parsed = parseWKTPolygonWithHoles(wkt);
    if (!parsed) {
      throw new Error('Failed to parse POLYGON');
    }
    
    // Convert from [lat, lon] to [lon, lat] for GeoJSON
    const outerRing = parsed.outer.map((coord: [number, number]) => [coord[1], coord[0]] as Position);
    const holes = (parsed.holes || []).map((hole: [number, number][]) =>
      hole.map((coord: [number, number]) => [coord[1], coord[0]] as Position)
    );
    
    const geoJsonCoords = [outerRing, ...holes];
    
    return {
      type: 'Polygon',
      coordinates: geoJsonCoords,
      isInverted,
    };
  } catch (error) {
    throw new Error(`Failed to parse WKT geometry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Test if a point (lat, lon) is contained within a WKT polygon
 * Handles both normal and inverted polygons
 */
export function testPointInPolygon(
  latitude: number,
  longitude: number,
  wkt: string
): boolean {
  try {
    const geometry = parseWKTGeometry(wkt);
    
    // Create point in GeoJSON format [lon, lat]
    const testPoint = point([longitude, latitude]);
    
    // Test containment based on geometry type
    if (geometry.type === 'Polygon') {
      const testGeometry = polygon(geometry.coordinates as Position[][]);
      return booleanPointInPolygon(testPoint, testGeometry);
    } else {
      const testGeometry = multiPolygon(geometry.coordinates as Position[][][]);
      // For MultiPolygon, check each polygon
      return (geometry.coordinates as Position[][][]).some(polyCoords => {
        const poly = polygon(polyCoords);
        return booleanPointInPolygon(testPoint, poly);
      });
    }
  } catch (error) {
    console.error('Error testing point in polygon:', error);
    return false;
  }
}

/**
 * Normalize longitude to -180 to 180 range
 */
export function normalizeLongitude(lon: number): number {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

/**
 * Validate coordinate values
 */
export function validateCoordinates(lat: number, lon: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Batch test multiple points against a polygon
 * Returns array of booleans indicating if each point is inside
 */
export function batchTestPoints(
  points: Array<{ lat: number; lon: number }>,
  wkt: string
): boolean[] {
  // Parse geometry once for efficiency
  const geometry = parseWKTGeometry(wkt);
  
  // Test all points
  return points.map(({ lat, lon }) => {
    try {
      if (!validateCoordinates(lat, lon)) {
        return false;
      }
      
      const testPoint = point([lon, lat]);
      
      // Test based on geometry type
      if (geometry.type === 'Polygon') {
        const testGeometry = polygon(geometry.coordinates as Position[][]);
        return booleanPointInPolygon(testPoint, testGeometry);
      } else {
        // For MultiPolygon, check each polygon
        return (geometry.coordinates as Position[][][]).some(polyCoords => {
          const poly = polygon(polyCoords);
          return booleanPointInPolygon(testPoint, poly);
        });
      }
    } catch {
      return false;
    }
  });
}
