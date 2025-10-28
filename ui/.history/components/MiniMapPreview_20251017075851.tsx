import React from 'react';
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
    const converted = coords.map(([lat, lng]) => [lng, lat] as [number, number]);
    console.log('Converting coordinates:', coords, '→', converted);
    return converted;
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
        {polygonCoordinates.map((ring, index) => {
          if (ring.length === 0) return null;
          
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
          
          console.log('Ring coordinates:', ring);
          console.log('Projected coordinates:', projectedCoords);
          console.log('Path string:', pathString);
          
          return (
            <path
              key={`polygon-${index}`}
              d={pathString}
              fill={isInverted ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)"}
              stroke={isInverted ? "#ef4444" : "#22c55e"}
              strokeWidth={0.8}
              style={{ outline: "none" }}
            />
          );
        })}
      </ComposableMap>
    </div>
  );
}

export default MiniMapPreview;