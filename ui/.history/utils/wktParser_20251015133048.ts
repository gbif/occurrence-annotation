export interface PolygonWithHoles {
  outer: [number, number][];
  holes: [number, number][][];
}

export interface MultiPolygon {
  polygons: PolygonWithHoles[];
}

/**
 * Parse WKT POLYGON string to coordinates array
 * Handles POLYGON format: "POLYGON ((x1 y1, x2 y2, ...))"
 * And POLYGON with holes: "POLYGON ((outer ring), (hole1), (hole2))"
 * Returns simple array for backward compatibility, or use parseWKTPolygonWithHoles for full structure
 */
export function parseWKTPolygon(wkt: string): [number, number][] | null {
  const result = parseWKTPolygonWithHoles(wkt);
  return result ? result.outer : null;
}

/**
 * Parse WKT POLYGON string and return structure with holes
 */
export function parseWKTPolygonWithHoles(wkt: string): PolygonWithHoles | null {
  try {
    // Remove "POLYGON" prefix and extra spaces
    const coordsStr = wkt.replace(/POLYGON\s*\(\(/i, '').replace(/\)\)$/, '');
    
    // Split by "), (" to handle polygons with holes
    const rings = coordsStr.split(/\),\s*\(/);
    
    // console.log('Parsing WKT, found', rings.length, 'rings');
    
    // Web Mercator limits (poles cannot be displayed)
    const WEB_MERCATOR_MAX_LAT = 85.0511287798;
    
    // Parse a single ring
    const parseRing = (ringStr: string): [number, number][] => {
      const coords = ringStr
        .split(',')
        .map((pair) => {
          const parts = pair.trim().split(/\s+/).map(Number);
          const [lng, lat] = parts; // WKT is "longitude latitude"
          
          // Clamp latitude to Web Mercator limits
          const clampedLat = Math.max(-WEB_MERCATOR_MAX_LAT, Math.min(WEB_MERCATOR_MAX_LAT, lat));
          
          // Normalize longitude to -180 to 180 range
          let clampedLng = lng;
          while (clampedLng > 180) clampedLng -= 360;
          while (clampedLng < -180) clampedLng += 360;
          
          // Log if clamping occurred
          if (clampedLat !== lat || clampedLng !== lng) {
            console.log(`DEBUG: Clamped coordinates from ${lat}, ${lng} to ${clampedLat}, ${clampedLng} (Web Mercator limit: ±${WEB_MERCATOR_MAX_LAT}° lat, ±180° lng)`);
          }
          
          // Map needs [latitude, longitude]
          return [clampedLat, clampedLng] as [number, number];
        })
        .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
      
      return coords;
    };
    
    const outerRing = parseRing(rings[0]);
    const holes = rings.slice(1).map(parseRing).filter(ring => ring.length >= 3);
    
    if (outerRing.length < 3) return null;
    
    return {
      outer: outerRing,
      holes: holes
    };
  } catch (error) {
    console.error('Failed to parse WKT:', error);
    return null;
  }
}

/**
 * Parse WKT MULTIPOLYGON string and return array of polygons with holes
 * Format: MULTIPOLYGON (((x y, x y, ...)), ((x y, x y, ...)))
 */
export function parseWKTMultiPolygon(wkt: string): MultiPolygon | null {
  try {
    // Check if it's a MULTIPOLYGON
    if (!wkt.trim().toUpperCase().startsWith('MULTIPOLYGON')) {
      return null;
    }
    
    // Remove "MULTIPOLYGON" prefix and outer parentheses
    const coordsStr = wkt.replace(/MULTIPOLYGON\s*\(\(\(/i, '').replace(/\)\)\)$/, '');
    
    // Split by ")), ((" to separate individual polygons
    const polygonStrings = coordsStr.split(/\)\),\s*\(\(/);
    
    const polygons: PolygonWithHoles[] = [];
    
    for (const polyStr of polygonStrings) {
      // Reconstruct as a POLYGON for parsing
      const polygonWkt = `POLYGON ((${polyStr}))`;
      const parsed = parseWKTPolygonWithHoles(polygonWkt);
      if (parsed) {
        polygons.push(parsed);
      }
    }
    
    if (polygons.length === 0) return null;
    
    return { polygons };
  } catch (error) {
    console.error('Failed to parse MULTIPOLYGON:', error);
    return null;
  }
}

/**
 * Parse any WKT geometry (POLYGON or MULTIPOLYGON)
 * Returns a MultiPolygon structure (single polygon becomes array of 1)
 */
export function parseWKTGeometry(wkt: string): MultiPolygon | null {
  if (!wkt) return null;
  
  const trimmed = wkt.trim().toUpperCase();
  
  if (trimmed.startsWith('MULTIPOLYGON')) {
    return parseWKTMultiPolygon(wkt);
  } else if (trimmed.startsWith('POLYGON')) {
    const polygon = parseWKTPolygonWithHoles(wkt);
    return polygon ? { polygons: [polygon] } : null;
  }
  
  return null;
}

/**
 * Convert coordinates array to WKT POLYGON or MULTIPOLYGON string
 * Input format: [lat, lng][] or [lat, lng][][] (app's internal format)
 * Output format: WKT uses "lng lat" order
 */
export function coordinatesToWKT(coordinates: [number, number][] | [number, number][][], isMultiPolygon: boolean = false, inverted: boolean = false): string {
  // Web Mercator limits
  const WEB_MERCATOR_MAX_LAT = 85.0511287798;
  
  // Coordinate clamping functions
  const clampLatitude = (lat: number): number => Math.max(-WEB_MERCATOR_MAX_LAT, Math.min(WEB_MERCATOR_MAX_LAT, lat));
  const clampLongitude = (lng: number): number => {
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    return lng;
  };
  const clampCoordinates = (lat: number, lng: number): [number, number] => [clampLatitude(lat), clampLongitude(lng)];
  
  if (isMultiPolygon) {
    // Handle multipolygon
    const polygons = coordinates as [number, number][][];
    if (polygons.length === 0) return '';
    
    const wktPolygons = polygons.map(coords => {
      if (coords.length < 3) return '';
      
      // Ensure polygon is closed
      const closedCoords = coords[coords.length - 1][0] === coords[0][0] && 
                            coords[coords.length - 1][1] === coords[0][1]
        ? coords
        : [...coords, coords[0]];
      
      const coordString = closedCoords
        .map(([lat, lng]) => {
          const [clampedLat, clampedLng] = clampCoordinates(lat, lng);
          return `${clampedLng} ${clampedLat}`;
        })
        .join(', ');
      
      return `((${coordString}))`;
    }).filter(s => s !== '');
    
    return wktPolygons.length > 0 ? `MULTIPOLYGON (${wktPolygons.join(', ')})` : '';
  } else {
    // Handle single polygon
    const coords = coordinates as [number, number][];
    if (coords.length < 3) return '';
    
    // Ensure polygon is closed (first point === last point)
    const closedCoords = coords[coords.length - 1][0] === coords[0][0] && 
                          coords[coords.length - 1][1] === coords[0][1]
      ? coords
      : [...coords, coords[0]];
    
    if (inverted) {
      // For inverted polygons, create a world boundary polygon with the actual polygon as a hole
      // World boundary using Web Mercator limits
      const worldBoundary = '-180 -85.0511287798, -90 -85.0511287798, 0 -85.0511287798, 90 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, 90 85.0511287798, 0 85.0511287798, -90 85.0511287798, -180 85.0511287798, -180 -85.0511287798';
      
      // The actual polygon becomes an inner ring (hole)
      const holeCoordString = closedCoords
        .map(([lat, lng]) => {
          const [clampedLat, clampedLng] = clampCoordinates(lat, lng);
          return `${clampedLng} ${clampedLat}`;
        })
        .join(', ');
      
      return `POLYGON ((${worldBoundary}), (${holeCoordString}))`;
    } else {
      // Normal polygon
      // WKT uses longitude latitude order
      const coordString = closedCoords
        .map(([lat, lng]) => {
          const [clampedLat, clampedLng] = clampCoordinates(lat, lng);
          return `${clampedLng} ${clampedLat}`;
        })
        .join(', ');
      
      return `POLYGON ((${coordString}))`;
    }
  }
}

