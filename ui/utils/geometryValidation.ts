/**
 * Geometry validation utilities for polygon size limits.
 * Mirrors backend validation logic to provide client-side feedback.
 */

export const MAX_POLYGON_VERTICES = 2500;
export const MAX_WKT_LENGTH = 125000;

// Warning threshold at 80% of max vertices
export const WARNING_THRESHOLD_VERTICES = Math.floor(MAX_POLYGON_VERTICES * 0.8);

// Pattern to match coordinate pairs in WKT (e.g., "1.23 4.56")
// Matches decimal numbers (with optional sign and decimal point) followed by space and another number
// This regex matches the backend pattern in GeometryValidationService.java
const COORDINATE_PAIR_PATTERN = /-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/g;

/**
 * Counts the number of vertices (coordinate pairs) in a WKT geometry string.
 * Handles both POLYGON and MULTIPOLYGON formats.
 * 
 * @param wkt - The WKT geometry string (POLYGON or MULTIPOLYGON format)
 * @returns The number of coordinate pairs found
 */
export function countWKTVertices(wkt: string): number {
  if (!wkt || !wkt.trim()) {
    return 0;
  }

  const matches = wkt.match(COORDINATE_PAIR_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Validates that a WKT geometry string does not exceed size limits.
 * 
 * @param wkt - The WKT geometry string to validate
 * @returns Validation result with vertex count and error message if validation fails
 */
export function validatePolygonSize(wkt: string): {
  isValid: boolean;
  vertexCount: number;
  maxVertices: number;
  error?: string;
} {
  if (!wkt || !wkt.trim()) {
    return {
      isValid: false,
      vertexCount: 0,
      maxVertices: MAX_POLYGON_VERTICES,
      error: 'Geometry is required',
    };
  }

  // Check WKT string length first (fast check)
  if (wkt.length > MAX_WKT_LENGTH) {
    return {
      isValid: false,
      vertexCount: 0,
      maxVertices: MAX_POLYGON_VERTICES,
      error: `WKT geometry exceeds maximum length of ${MAX_WKT_LENGTH.toLocaleString()} characters (found ${wkt.length.toLocaleString()} characters)`,
    };
  }

  // Count vertices in the geometry
  const vertexCount = countWKTVertices(wkt);
  
  if (vertexCount > MAX_POLYGON_VERTICES) {
    return {
      isValid: false,
      vertexCount,
      maxVertices: MAX_POLYGON_VERTICES,
      error: `Polygon exceeds maximum of ${MAX_POLYGON_VERTICES.toLocaleString()} vertices (found ${vertexCount.toLocaleString()} vertices). Use the scissors tool in the editing menu to simplify your polygon.`,
    };
  }

  return {
    isValid: true,
    vertexCount,
    maxVertices: MAX_POLYGON_VERTICES,
  };
}

/**
 * Get a user-friendly description of polygon size status.
 * 
 * @param vertexCount - The number of vertices in the polygon
 * @returns Status object with message and severity level
 */
export function getPolygonSizeStatus(vertexCount: number): {
  message: string;
  severity: 'safe' | 'warning' | 'error';
  color: string;
} {
  if (vertexCount > MAX_POLYGON_VERTICES) {
    return {
      message: `${vertexCount.toLocaleString()} / ${MAX_POLYGON_VERTICES.toLocaleString()} vertices (exceeds limit)`,
      severity: 'error',
      color: 'text-red-600',
    };
  }
  
  if (vertexCount > WARNING_THRESHOLD_VERTICES) {
    return {
      message: `${vertexCount.toLocaleString()} / ${MAX_POLYGON_VERTICES.toLocaleString()} vertices (approaching limit)`,
      severity: 'warning',
      color: 'text-yellow-600',
    };
  }
  
  return {
    message: `${vertexCount.toLocaleString()} / ${MAX_POLYGON_VERTICES.toLocaleString()} vertices`,
    severity: 'safe',
    color: 'text-green-600',
  };
}
