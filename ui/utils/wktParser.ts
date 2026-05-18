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
  
  // Check if this is a world-spanning polygon (e.g., ocean boundary)
  // World-spanning polygons have longitude range close to 360° and touch both ±180 boundaries
  const longitudes = coords.map(([_, lng]) => lng);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const lngSpan = maxLng - minLng;
  
  // If polygon spans close to 360° and touches both boundaries, it's world-spanning
  // Don't apply dateline fix to avoid collapsing the polygon
  const isWorldSpanning = lngSpan > 350 && minLng < -170 && maxLng > 170;
  if (isWorldSpanning) {
    return coords;
  }
  
  // Detect if polygon crosses dateline by checking for large longitude jumps
  let hasDatelineCrossing = false;
  for (let i = 0; i < coords.length - 1; i++) {
    const jump = Math.abs(coords[i + 1][1] - coords[i][1]);
    if (jump > 180) {
      hasDatelineCrossing = true;
      break;
    }
  }
  
  // Check wrap-around from last to first
  if (!hasDatelineCrossing) {
    const wrapJump = Math.abs(coords[0][1] - coords[coords.length - 1][1]);
    if (wrapJump > 180) {
      hasDatelineCrossing = true;
    }
  }
  
  // If no dateline crossing detected, return original
  if (!hasDatelineCrossing) {
    return coords;
  }
  
  // For dateline-crossing polygons, normalize to 0-360° range
  // This keeps all coordinates on the same "side" and avoids straight lines
  const normalized = coords.map(([lat, lng]) => {
    // Convert -180 to 180 range to 0 to 360 range
    const normalizedLng = lng < 0 ? lng + 360 : lng;
    return [lat, normalizedLng] as [number, number];
  });
  
  return normalized;
}

/**
 * Split a polygon at the dateline by detecting large longitude jumps
 * Returns coordinates for the "primary" polygon piece
 * @deprecated - Use fixDatelineCrossing with 0-360 normalization instead
 */
export function splitAtDateline(coords: [number, number][]): [number, number][] {
  if (coords.length < 3) return coords;
  
  // Find the largest consecutive longitude jump
  let maxJump = 0;
  let splitIndex = -1;
  
  for (let i = 0; i < coords.length - 1; i++) {
    const jump = Math.abs(coords[i + 1][1] - coords[i][1]);
    if (jump > maxJump && jump > 180) {
      maxJump = jump;
      splitIndex = i;
    }
  }
  
  // Also check wrap-around from last to first
  const wrapJump = Math.abs(coords[0][1] - coords[coords.length - 1][1]);
  if (wrapJump > maxJump && wrapJump > 180) {
    maxJump = wrapJump;
    splitIndex = coords.length - 1;
  }
  
  // If no significant jump found, return original
  if (splitIndex === -1) {
    return coords;
  }
  
  // Determine which side of the dateline to keep
  // Keep the side with more coordinates
  const part1 = coords.slice(0, splitIndex + 1);
  const part2 = coords.slice(splitIndex + 1);
  
  // Return the larger part (typically the "main" landmass)
  if (part1.length >= part2.length) {
    return part1;
  } else {
    return part2;
  }
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

