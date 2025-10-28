import React from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';

// Use a reliable CDN URL for world map data
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface MiniMapPreviewProps {
  coordinates: [number, number][] | [number, number][][];
  isMultiPolygon?: boolean;
  isInverted?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function MiniMapPreview({
  coordinates,
  isMultiPolygon = false,
  isInverted = false,
  width = 200,
  height = 120,
  className = "",
}: MiniMapPreviewProps) {
  // Convert coordinates from [lat, lng] (app format) to [lng, lat] (react-simple-maps format)
  function toLngLat(coords: [number, number][]) {
    return coords.map(([lat, lng]) => [lng, lat] as [number, number]);
  }

  // Convert coordinates to the format expected by react-simple-maps
  const polygonCoordinates = isMultiPolygon
    ? (coordinates as [number, number][][]).map(ring => toLngLat(ring))
    : [toLngLat(coordinates as [number, number][])];

  return (
    <div className={`border border-gray-200 rounded overflow-hidden ${className}`}
         style={{ 
           backgroundColor: '#4a5568', // Darker for water
           width: `${width}px`,
           height: `${height}px`,
           flexShrink: 0
         }}> {/* Darker for water */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: Math.min(width, height) * 0.15,
        }}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#4a5568', // Darker for water
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
                  fill="#e5e7eb"
                  stroke="#d1d5db"
                />
              );
            }
            return geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#e5e7eb" // Light gray for land (grayscale)
                stroke="#d1d5db" // Slightly darker gray for borders
                strokeWidth={0.2} // Thinner borders for mini map
                style={{
                  default: {
                    fill: "#e5e7eb",
                    stroke: "#d1d5db",
                    strokeWidth: 0.2,
                    outline: "none",
                  },
                  hover: {
                    fill: "#e5e7eb",
                    stroke: "#d1d5db",
                    strokeWidth: 0.2,
                    outline: "none",
                  },
                  pressed: {
                    fill: "#e5e7eb",
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
          
          // The coordinates are already in [lng, lat] format for react-simple-maps
          // Create SVG path string
          const pathString = `M ${ring.map(coord => coord.join(",")).join(" L ")} Z`;
          
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