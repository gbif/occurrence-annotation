interface VocabularyTerm {
  term: string;
  description?: string;
  color: string;
  locked?: boolean;
}

interface MiniMapPreviewProps {
  coordinates: [number, number][] | [number, number][][];
  isMultiPolygon?: boolean;
  isInverted?: boolean;
  annotation?: string;
  width?: number;
  height?: number;
  className?: string;
  vocabulary?: VocabularyTerm[];
}

export function MiniMapPreview({
  coordinates,
  isMultiPolygon = false,
  isInverted = false,
  annotation = "SUSPICIOUS",
  width = 200,
  height = 120,
  className = "",
  vocabulary,
}: MiniMapPreviewProps) {
  // Helper function to convert hex color to RGBA
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Build color map from vocabulary if provided, otherwise use defaults
  const annotationColors: { [key: string]: { fill: string; fillRgba: string; stroke: string; strokeRgba: string } } = vocabulary && vocabulary.length > 0
    ? vocabulary.reduce((acc, term) => {
        acc[term.term.toUpperCase()] = {
          fill: term.color,
          fillRgba: hexToRgba(term.color, 0.4),
          stroke: term.color,
          strokeRgba: hexToRgba(term.color, 0.6),
        };
        return acc;
      }, {} as { [key: string]: { fill: string; fillRgba: string; stroke: string; strokeRgba: string } })
    : {
        SUSPICIOUS: { fill: '#ef4444', fillRgba: 'rgba(239, 68, 68, 0.4)', stroke: '#dc2626', strokeRgba: 'rgba(220, 38, 38, 0.6)' },
        NATIVE: { fill: '#10b981', fillRgba: 'rgba(16, 185, 129, 0.4)', stroke: '#059669', strokeRgba: 'rgba(5, 150, 105, 0.6)' },
        MANAGED: { fill: '#3b82f6', fillRgba: 'rgba(59, 130, 246, 0.4)', stroke: '#2563eb', strokeRgba: 'rgba(37, 99, 235, 0.6)' },
        FORMER: { fill: '#a855f7', fillRgba: 'rgba(168, 85, 247, 0.4)', stroke: '#9333ea', strokeRgba: 'rgba(147, 51, 234, 0.6)' },
        VAGRANT: { fill: '#f97316', fillRgba: 'rgba(249, 115, 22, 0.4)', stroke: '#ea580c', strokeRgba: 'rgba(234, 88, 12, 0.6)' },
        INTRODUCED: { fill: '#d97706', fillRgba: 'rgba(217, 119, 6, 0.4)', stroke: '#b45309', strokeRgba: 'rgba(180, 83, 9, 0.6)' },
      };
  
  const color = annotationColors[annotation.toUpperCase()] || annotationColors.SUSPICIOUS;

  // Convert lat/lng directly to viewport pixel coordinates.
  // The background shows the entire world stretched to fit the viewport,
  // so we map lng [-180, 180] -> [0, width] and Mercator Y -> [0, height].
  const latLngToPixel = (lat: number, lng: number): [number, number] => {
    // Web Mercator max latitude: atan(sinh(π)) ≈ 85.05112878°
    const WEB_MERCATOR_MAX_LAT = 85.05112878;
    
    // Clamp latitude to Web Mercator bounds to match OSM tile coverage
    const clampedLat = Math.max(-WEB_MERCATOR_MAX_LAT, Math.min(WEB_MERCATOR_MAX_LAT, lat));

    // Longitude maps linearly across the viewport width
    const x = ((lng + 180) / 360) * width;

    // Web Mercator Y, normalized to [0, 1] across the full world, then scaled to viewport height
    const latRad = (clampedLat * Math.PI) / 180;
    const mercatorY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const normalizedY = (1 - mercatorY / Math.PI) / 2; // 0 at top, 1 at bottom
    const y = normalizedY * height;

    return [x, y];
  };

  // Validate coordinate structure
  function validateCoordinates(coords: any): boolean {
    if (!Array.isArray(coords)) return false;
    
    if (isMultiPolygon) {
      // Should be [number, number][][]
      return coords.every(ring => 
        Array.isArray(ring) && 
        ring.length >= 3 && 
        ring.every(coord => 
          Array.isArray(coord) && 
          coord.length >= 2 && 
          typeof coord[0] === 'number' && 
          typeof coord[1] === 'number'
        )
      );
    } else {
      // Should be [number, number][]
      return coords.length >= 3 && 
        coords.every(coord => 
          Array.isArray(coord) && 
          coord.length >= 2 && 
          typeof coord[0] === 'number' && 
          typeof coord[1] === 'number'
        );
    }
  }

  // Validate coordinates before processing
  if (!validateCoordinates(coordinates)) {
    console.error('Invalid polygon coordinates in MiniMapPreview:', {
      isMultiPolygon,
      coordinates: JSON.stringify(coordinates).substring(0, 200)
    });
    return (
      <div className={`border border-red-300 rounded overflow-hidden flex items-center justify-center ${className}`}
           style={{ 
             backgroundColor: '#fee', 
             width: `${width}px`,
             height: `${height}px`,
             flexShrink: 0
           }}>
        <span className="text-xs text-red-600 px-2 text-center">Invalid polygon data</span>
      </div>
    );
  }

  // Convert coordinates to array of rings
  const polygonRings = isMultiPolygon
    ? (coordinates as [number, number][][]).filter(ring => ring.length >= 3)
    : [(coordinates as [number, number][])].filter(ring => ring.length >= 3);

  // If no valid polygons after filtering, show error
  if (polygonRings.length === 0) {
    console.error('No valid polygon rings in MiniMapPreview');
    return (
      <div className={`border border-red-300 rounded overflow-hidden flex items-center justify-center ${className}`}
           style={{ 
             backgroundColor: '#fee', 
             width: `${width}px`,
             height: `${height}px`,
             flexShrink: 0
           }}>
        <span className="text-xs text-red-600 px-2 text-center">Invalid polygon data</span>
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded overflow-hidden ${className}`}
         style={{ 
           width: `${width}px`,
           height: `${height}px`,
           flexShrink: 0,
           position: 'relative'
         }}>
      {/* Static world map background using OSM tiles */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#aadaff', // Ocean blue
        backgroundImage: `url(https://tile.openstreetmap.org/1/0/0.png), url(https://tile.openstreetmap.org/1/1/0.png), url(https://tile.openstreetmap.org/1/0/1.png), url(https://tile.openstreetmap.org/1/1/1.png)`,
        backgroundSize: '50% 50%',
        backgroundPosition: 'top left, top right, bottom left, bottom right',
        backgroundRepeat: 'no-repeat'
      }} />
      {/* Render polygons as absolute-positioned SVG overlay */}
      <svg 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
        viewBox={`0 0 ${width} ${height}`}
      >
        {isInverted ? (
          // For inverted polygons, create a large rectangle with polygon as hole
          (() => {
            const margin = Math.max(width, height) * 10;
            let pathStr = `M ${-margin},${-margin} L ${margin},${-margin} L ${margin},${margin} L ${-margin},${margin} Z`;
            
            // Add all polygon rings as holes
            polygonRings.forEach((ring) => {
              const pixelCoords = ring.map(([lat, lng]) => {
                const [x, y] = latLngToPixel(lat, lng);
                return [x, y];
              });
              
              const pathPart = pixelCoords.map(([x, y], i) => 
                i === 0 ? `M ${x},${y}` : `L ${x},${y}`
              ).join(' ') + ' Z';
              
              pathStr += ` ${pathPart}`;
            });
            
            return (
              <path
                d={pathStr}
                fill={color.fillRgba}
                stroke={color.stroke}
                strokeWidth={1.5}
                fillRule="evenodd"
              />
            );
          })()
        ) : (
          // Normal polygons - render as dot if too small to see clearly
          polygonRings.map((ring, index) => {
            const pixelCoords = ring.map(([lat, lng]) => {
              const [x, y] = latLngToPixel(lat, lng);
              return [x, y] as [number, number];
            });

            // Compute bounding box in pixel space
            const xs = pixelCoords.map(([x]) => x);
            const ys = pixelCoords.map(([, y]) => y);
            const bboxWidth = Math.max(...xs) - Math.min(...xs);
            const bboxHeight = Math.max(...ys) - Math.min(...ys);

            // If polygon is smaller than ~4px in both dimensions, show as a dot at centroid
            const DOT_THRESHOLD = 4;
            if (bboxWidth < DOT_THRESHOLD && bboxHeight < DOT_THRESHOLD) {
              const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
              const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
              return (
                <circle
                  key={`polygon-${index}`}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth={1}
                />
              );
            }

            const pathStr = pixelCoords.map(([x, y], i) =>
              i === 0 ? `M ${x},${y}` : `L ${x},${y}`
            ).join(' ') + ' Z';

            return (
              <path
                key={`polygon-${index}`}
                d={pathStr}
                fill={color.fillRgba}
                stroke={color.stroke}
                strokeWidth={1.5}
              />
            );
          })
        )}
      </svg>
      {/* OSM Attribution */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        fontSize: '8px',
        lineHeight: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        padding: '1px 3px',
        borderTopLeftRadius: '2px',
        pointerEvents: 'auto'
      }}>
        <a 
          href="https://www.openstreetmap.org/copyright" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: '#0078a8', textDecoration: 'none' }}
          title="OpenStreetMap contributors"
        >
          © OSM
        </a>
      </div>
    </div>
  );
}

export default MiniMapPreview;