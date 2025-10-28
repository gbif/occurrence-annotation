import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';
import { geoMercator } from 'd3-geo';

// Use a reliable CDN URL for world map data
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface MiniMapPreviewProps {
  coordinates: [number, number][] | [number, number][][];
  isMultiPolygon?: boolean;
  isInverted?: boolean;
  annotation?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function MiniMapPreview({
  coordinates,
  isMultiPolygon = false,
  isInverted = false,
  annotation = "SUSPICIOUS",
  width = 200,
  height = 120,
  className = "",
}: MiniMapPreviewProps) {
  // Get color based on annotation type
  const annotationColors: { [key: string]: { fill: string; fillRgba: string; stroke: string; strokeRgba: string } } = {
    SUSPICIOUS: { fill: '#ef4444', fillRgba: 'rgba(239, 68, 68, 0.4)', stroke: '#dc2626', strokeRgba: 'rgba(220, 38, 38, 0.6)' },
    NATIVE: { fill: '#10b981', fillRgba: 'rgba(16, 185, 129, 0.4)', stroke: '#059669', strokeRgba: 'rgba(5, 150, 105, 0.6)' },
    MANAGED: { fill: '#3b82f6', fillRgba: 'rgba(59, 130, 246, 0.4)', stroke: '#2563eb', strokeRgba: 'rgba(37, 99, 235, 0.6)' },
    FORMER: { fill: '#a855f7', fillRgba: 'rgba(168, 85, 247, 0.4)', stroke: '#9333ea', strokeRgba: 'rgba(147, 51, 234, 0.6)' },
    VAGRANT: { fill: '#f97316', fillRgba: 'rgba(249, 115, 22, 0.4)', stroke: '#ea580c', strokeRgba: 'rgba(234, 88, 12, 0.6)' },
  };
  
  const color = annotationColors[annotation.toUpperCase()] || annotationColors.SUSPICIOUS;
  
  // Convert coordinates from [lat, lng] (app format) to [lng, lat] (react-simple-maps format)
  function toLngLat(coords: [number, number][]) {
    return coords.map(([lat, lng]) => [lng, lat] as [number, number]);
  }

  // Calculate polygon size in projected coordinates to determine if it should be a dot
  function getPolygonSize(ring: [number, number][]) {
    if (ring.length === 0) return 0;
    
    // Create projection
    const projection = geoMercator()
      .scale(width * 0.16)
      .center([0, 20])
      .translate([width / 2, height / 2]);
    
    // Project coordinates
    const projectedCoords = ring.map(coord => projection(coord)).filter(coord => coord !== null);
    
    if (projectedCoords.length === 0) return 0;
    
    // Calculate bounding box in projected space
    const xs = projectedCoords.map(coord => coord![0]);
    const ys = projectedCoords.map(coord => coord![1]);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    // Return the maximum dimension (width or height)
    return Math.max(maxX - minX, maxY - minY);
  }

  // Calculate polygon centroid for dot placement
  // Note: ring coordinates are in [lng, lat] format (already converted by toLngLat)
  function getPolygonCentroid(ring: [number, number][]): [number, number] | null {
    if (ring.length === 0) return null;
    
    // Calculate centroid - ring is already in [lng, lat] format
    const sumLng = ring.reduce((sum, [lng]) => sum + lng, 0);
    const sumLat = ring.reduce((sum, [, lat]) => sum + lat, 0);
    const centroidLng = sumLng / ring.length;
    const centroidLat = sumLat / ring.length;
    
    return [centroidLng, centroidLat]; // Return in [lng, lat] format
  }

  // Convert coordinates to the format expected by react-simple-maps
  const polygonCoordinates = isMultiPolygon
    ? (coordinates as [number, number][][]).map(ring => toLngLat(ring))
    : [toLngLat(coordinates as [number, number][])];

  return (
    <div className={`border border-gray-200 rounded overflow-hidden ${className}`}
         style={{ 
           backgroundColor: '#CAD2D3', // Water color
           width: `${width}px`,
           height: `${height}px`,
           flexShrink: 0
         }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: width * 0.16, // Use width-based scaling to fill horizontally
          center: [0, 20], // Center slightly north to better show land masses
        }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#CAD2D3', // Water color
        }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) => {
            if (!geographies || geographies.length === 0) {
              // Fallback if geography data doesn't load
              return (
                <rect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  fill="#F3F3F1"
                  stroke="#d1d5db"
                />
              );
            }
            return geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#F3F3F1" // Land color
                stroke="#d1d5db" // Border color
                strokeWidth={0.2} // Thinner borders for mini map
                style={{
                  default: {
                    fill: "#F3F3F1",
                    stroke: "#d1d5db",
                    strokeWidth: 0.2,
                    outline: "none",
                  },
                  hover: {
                    fill: "#F3F3F1",
                    stroke: "#d1d5db",
                    strokeWidth: 0.2,
                    outline: "none",
                  },
                  pressed: {
                    fill: "#F3F3F1",
                    stroke: "#d1d5db",
                    strokeWidth: 0.2,
                    outline: "none",
                  },
                }}
              />
            ));
          }}
        </Geographies>
        {/* Render the polygon(s) as SVG paths with proper projection */}
        {isInverted ? (
          // For inverted polygons, create one world-covering shape with all polygons as holes
          // But also render small polygons as dots on top
          <>
            {(() => {
              // Create a projection that matches the map's projection
              const projection = geoMercator()
                .scale(width * 0.16) // Match the map's scaling
                .center([0, 20]) // Match the map's center
                .translate([width / 2, height / 2]);

              // Build one combined path with world boundary and large polygons as holes
              const worldPath = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
              
              let allPolygonPaths = '';
              const smallPolygons: [number, number][][] = [];
              
              polygonCoordinates.forEach((ring) => {
                if (ring.length > 0) {
                  const polygonSize = getPolygonSize(ring);
                  
                  if (polygonSize < 8) {
                    // Store small polygons to render as dots
                    smallPolygons.push(ring);
                  } else {
                    // Add large polygons as holes in the inverted polygon
                    const projectedCoords = ring.map(coord => projection(coord));
                    const pathString = projectedCoords.length > 0
                      ? `M ${projectedCoords.map(coord => coord ? coord.join(",") : "0,0").join(" L ")} Z`
                      : '';
                    
                    allPolygonPaths += ` ${pathString}`;
                  }
                }
              });

              const combinedPath = `${worldPath} ${allPolygonPaths}`;
              
              return (
                <g key="inverted-multipolygon">
                  {/* Main inverted polygon */}
                  <path
                    d={combinedPath}
                    fill={annotationColors.SUSPICIOUS.fillRgba}
                    stroke={annotationColors.SUSPICIOUS.stroke}
                    strokeWidth={0.8}
                    fillRule="evenodd" // This makes the inner paths holes
                    style={{ outline: "none" }}
                  />
                  {/* Small polygons as dots */}
                  {smallPolygons.map((ring, index) => {
                    const centroid = getPolygonCentroid(ring);
                    if (!centroid) return null;
                    
                    const projectedCentroid = projection(centroid); // centroid is already [lng, lat]
                    if (!projectedCentroid) return null;
                    
                    return (
                      <circle
                        key={`inverted-dot-${index}`}
                        cx={projectedCentroid[0]}
                        cy={projectedCentroid[1]}
                        r={2.5}
                        fill={annotationColors.SUSPICIOUS.fill}
                        stroke="#fff"
                        strokeWidth={0.5}
                        style={{ outline: "none" }}
                      />
                    );
                  })}
                </g>
              );
            })()}
          </>
        ) : (
          // Normal polygons - render as dots if too small
          polygonCoordinates.map((ring, index) => {
            if (ring.length === 0) return null;
            
            // Check if polygon is small enough to render as a dot (threshold: 8 pixels)
            const polygonSize = getPolygonSize(ring);
            const shouldRenderAsDot = polygonSize < 8;
            
            if (shouldRenderAsDot) {
              // Render as a dot
              const centroid = getPolygonCentroid(ring);
              if (!centroid) return null;
              
              // Project centroid
              const projection = geoMercator()
                .scale(width * 0.16)
                .center([0, 20])
                .translate([width / 2, height / 2]);
              
              const projectedCentroid = projection(centroid); // centroid is already [lng, lat]
              if (!projectedCentroid) return null;
              
              return (
                <circle
                  key={`dot-${index}`}
                  cx={projectedCentroid[0]}
                  cy={projectedCentroid[1]}
                  r={2.5} // Dot radius
                  fill={color.fill}
                  stroke={color.stroke}
                  strokeWidth={0.5}
                  style={{ outline: "none" }}
                />
              );
            } else {
              // Render as normal polygon
              // Create a projection that matches the map's projection
              const projection = geoMercator()
                .scale(width * 0.16) // Match the map's scaling
                .center([0, 20]) // Match the map's center
                .translate([width / 2, height / 2]);
              
              // Project the coordinates through the same projection as the map
              const projectedCoords = ring.map(coord => projection(coord));
              
              // Create SVG path string with projected coordinates
              const pathString = projectedCoords.length > 0
                ? `M ${projectedCoords.map(coord => coord ? coord.join(",") : "0,0").join(" L ")} Z`
                : '';

              return (
                <path
                  key={`polygon-${index}`}
                  d={pathString}
                  fill={color.fillRgba}
                  stroke={color.stroke}
                  strokeWidth={0.8}
                  style={{ outline: "none" }}
                />
              );
            }
          })
        )}
      </ComposableMap>
    </div>
  );
}

export default MiniMapPreview;