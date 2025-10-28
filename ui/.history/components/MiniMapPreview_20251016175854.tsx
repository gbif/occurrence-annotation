import React from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';

// Simple inline world map for better reliability
const simpleWorld = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "World" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]
        ]]
      }
    }
  ]
};

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

  // Flatten all coordinates for bounds calculation
  const allCoords = isMultiPolygon
    ? (coordinates as [number, number][][]).flat()
    : (coordinates as [number, number][]);

  const lngLatCoords = toLngLat(allCoords);

  // Calculate bounds for the polygon(s) to center and zoom the map
  const calculateBounds = () => {
    if (lngLatCoords.length === 0) return { minLng: -180, maxLng: 180, minLat: -90, maxLat: 90 };
    const lngs = lngLatCoords.map(coord => coord[0]);
    const lats = lngLatCoords.map(coord => coord[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    // Add some padding
    const lngPadding = (maxLng - minLng) * 0.2 || 10;
    const latPadding = (maxLat - minLat) * 0.2 || 10;
    return {
      minLng: minLng - lngPadding,
      maxLng: maxLng + lngPadding,
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
    };
  };

  const bounds = calculateBounds();
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const lngSpan = bounds.maxLng - bounds.minLng;
  const latSpan = bounds.maxLat - bounds.minLat;
  const maxSpan = Math.max(lngSpan, latSpan);
  const zoom = Math.min(8, Math.max(1, 360 / maxSpan));

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
          center: [centerLng, centerLat],
          scale: zoom * 50,
        }}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#4a5568', // Darker for water
        }}
      >
        <Geographies geography={simpleWorld}>
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
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}

export default MiniMapPreview;