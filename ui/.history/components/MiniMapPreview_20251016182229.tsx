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
  // Ensure coordinates are in [lng, lat] format for react-simple-maps
  function toLngLat(coords: [number, number][]) {
    // If already [lng, lat], return as is. If [lat, lng], swap.
    // Heuristic: if |lat| > 90, it's probably [lng, lat]
    return coords.map(([a, b]) => (Math.abs(a) > 90 ? [a, b] : [b, a]));
  }

  // Convert coordinates to the format expected by react-simple-maps
  const polygonCoordinates = isMultiPolygon
    ? (coordinates as [number, number][][]).map(ring => toLngLat(ring))
    : [toLngLat(coordinates as [number, number][])];

  return (
    <div className={`border border-gray-200 rounded overflow-hidden ${className}`}
         style={{ backgroundColor: '#4a5568' }}> {/* Darker for water */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: Math.min(width, height) * 0.15, // Keep world visible, scale based on size
        }}
        width={width}
        height={height}
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
                strokeWidth={0.3}
                style={{
                  default: {
                    fill: "#e5e7eb",
                    stroke: "#d1d5db",
                    strokeWidth: 0.3,
                    outline: "none",
                  },
                  hover: {
                    fill: "#e5e7eb",
                    stroke: "#d1d5db",
                    strokeWidth: 0.3,
                    outline: "none",
                  },
                  pressed: {
                    fill: "#e5e7eb",
                    stroke: "#d1d5db",
                    strokeWidth: 0.3,
                    outline: "none",
                  },
                }}
              />
            ));
          }}
        </Geographies>
        {/* Render the polygon(s) as SVG paths */}
        {polygonCoordinates.map((ring, index) => {
          const pathString = ring.length > 0
            ? `M ${ring.map(coord => coord.join(",")).join(" L ")} Z`
            : '';
          return (
            <path
              key={index}
              d={pathString}
              fill={isInverted ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}
              stroke={isInverted ? "#ef4444" : "#22c55e"}
              strokeWidth={1.5}
              style={{ outline: "none" }}
            />
          );
        })}
      </ComposableMap>
    </div>
  );
}

export default MiniMapPreview;