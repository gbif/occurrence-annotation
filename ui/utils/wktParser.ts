export interface PolygonWithHoles {
  outer: [number, number][];
  holes: [number, number][][];
}

export interface MultiPolygon {
  polygons: PolygonWithHoles[];
}

/**
 * Detect if a polygon is inverted by checking if outer ring covers the world
 * Inverted polygons have a world-spanning outer boundary with holes representing excluded regions
 */
export function isInvertedPolygon(polygon: PolygonWithHoles): boolean {
  const outer = polygon.outer;
  if (outer.length < 4) return false;
  
  // Check if the outer ring spans close to the entire world (-180 to 180, -85 to 85)
  const lats = outer.map((coord: [number, number]) => coord[0]);
  const lngs = outer.map((coord: [number, number]) => coord[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  // If it covers nearly the entire world and has holes, it's likely inverted
  const coversWorld = (maxLat - minLat) > 170 && (maxLng - minLng) > 350;
  const hasHoles = polygon.holes && polygon.holes.length > 0;
  
  return coversWorld && hasHoles;
}

/**
 * Remove closing coordinate if polygon is explicitly closed (first point === last point)
 */
export function removeClosingCoordinate(coords: [number, number][]): [number, number][] {
  if (coords.length < 2) return coords;
  
  const first = coords[0];
  const last = coords[coords.length - 1];
  
  if (first[0] === last[0] && first[1] === last[1]) {
    return coords.slice(0, -1);
  }
  
  return coords;
}

/**
 * Fix dateline-crossing polygons by adjusting longitude values for continuity
 * Finds the median longitude and adjusts any coordinates that are >180° away
 */
export function fixDatelineCrossing(coords: [number, number][]): [number, number][] {
  if (coords.length < 2) return coords;
  
  // Calculate median longitude to find the "center" of the polygon
  const lngs = coords.map(([_, lng]) => lng).sort((a, b) => a - b);
  const medianLng = lngs[Math.floor(lngs.length / 2)];
  
  // Adjust coordinates that are far from the median
  const fixed = coords.map(([lat, lng]) => {
    let adjustedLng = lng;
    const diff = lng - medianLng;
    
    // If a coordinate is more than 180° away from the median,
    // it likely crossed the dateline and should be adjusted
    if (diff > 180) {
      adjustedLng = lng - 360;
    } else if (diff < -180) {
      adjustedLng = lng + 360;
    }
    
    return [lat, adjustedLng] as [number, number];
  });
  
  // Check if the resulting polygon spans too much longitude
  const adjustedLngs = fixed.map(coord => coord[1]);
  const minLng = Math.min(...adjustedLngs);
  const maxLng = Math.max(...adjustedLngs);
  const span = maxLng - minLng;
  
  // If span is very large (>270°), this might be a problematic geometry
  // Return original coordinates to avoid worse rendering
  if (span > 270) {
    return coords;
  }
  
  return fixed;
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
          
          // NOTE: Do NOT normalize longitude here - we need original values
          // to properly detect dateline crossings. The fixDatelineCrossing
          // function will handle continuity adjustments.
          
          // Map needs [latitude, longitude]
          return [clampedLat, lng] as [number, number];
        })
        .filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng));
      
      // Fix dateline crossing issues (handles coordinate adjustments)
      return fixDatelineCrossing(coords);
    };
    
    const outerRing = removeClosingCoordinate(parseRing(rings[0]));
    const holes = rings.slice(1)
      .map(ring => removeClosingCoordinate(parseRing(ring)))
      .filter(ring => ring.length >= 3);
    
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
 * Returns PolygonWithHoles for single POLYGON, MultiPolygon for MULTIPOLYGON
 */
export function parseWKTGeometry(wkt: string): MultiPolygon | PolygonWithHoles | null {
  if (!wkt) return null;
  
  const trimmed = wkt.trim().toUpperCase();
  
  if (trimmed.startsWith('MULTIPOLYGON')) {
    return parseWKTMultiPolygon(wkt);
  } else if (trimmed.startsWith('POLYGON')) {
    // Return PolygonWithHoles directly - don't wrap in MultiPolygon
    return parseWKTPolygonWithHoles(wkt);
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

    if (inverted) {
      // For inverted multipolygons, we need to create a single polygon with multiple holes
      // This represents "everywhere except these areas"
      const worldBoundary = '-180 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, -180 85.0511287798, -180 -85.0511287798';
      
      // Each polygon becomes a hole (inner ring)
      const holes = polygons.map(coords => {
        if (coords.length < 3) return '';
        
        // Ensure polygon is closed
        const closedCoords = coords[coords.length - 1][0] === coords[0][0] && 
                              coords[coords.length - 1][1] === coords[0][1]
          ? coords
          : [...coords, coords[0]];
        
        // Reverse for counter-clockwise orientation (holes)
        const holeCoordString = closedCoords
          .slice()
          .reverse()
          .map(([lat, lng]) => {
            const [clampedLat, clampedLng] = clampCoordinates(lat, lng);
            return `${clampedLng} ${clampedLat}`;
          })
          .join(', ');
        
        return `(${holeCoordString})`;
      }).filter(s => s !== '');
      
      // Combine world boundary with all holes
      const allRings = [`(${worldBoundary})`, ...holes].join(', ');
      return `POLYGON (${allRings})`;
    } else {
      // Normal multipolygon
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
    }
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
      // World boundary using Web Mercator limits - create a proper rectangular boundary
      // Go clockwise around the world boundary to ensure proper orientation
      const worldBoundary = '-180 -85.0511287798, 180 -85.0511287798, 180 85.0511287798, -180 85.0511287798, -180 -85.0511287798';
      
      // The actual polygon becomes an inner ring (hole)
      // Holes should have opposite orientation (counter-clockwise) to outer ring
      const holeCoordString = closedCoords
        .slice() // Create a copy
        .reverse() // Reverse to ensure counter-clockwise orientation for hole
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

