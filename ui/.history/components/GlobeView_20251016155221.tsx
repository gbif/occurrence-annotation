import { ComposableMap, Graticule, Geographies, Geography } from "react-simple-maps";
import { MultiPolygon } from '../utils/wktParser';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface GlobeViewProps {
  multiPolygon: MultiPolygon;
  annotation: string;
  onClick?: () => void;
}

// Helper function to get colors based on annotation
const getPolygonFillColor = (annotation: string): string => {
  switch (annotation.toUpperCase()) {
    case 'SUSPICIOUS':
      return 'rgba(239, 68, 68, 0.3)'; // red with opacity
    case 'VALID':
      return 'rgba(34, 197, 94, 0.3)'; // green with opacity
    case 'INVALID':
      return 'rgba(107, 114, 128, 0.3)'; // gray with opacity
    case 'FLAGGED':
      return 'rgba(234, 88, 12, 0.3)'; // orange with opacity
    default:
      return 'rgba(59, 130, 246, 0.3)'; // blue with opacity
  }
};

const getPolygonStrokeColor = (annotation: string): string => {
  switch (annotation.toUpperCase()) {
    case 'SUSPICIOUS':
      return '#ef4444'; // red-500
    case 'VALID':
      return '#22c55e'; // green-500
    case 'INVALID':
      return '#6b7280'; // gray-500
    case 'FLAGGED':
      return '#ea580c'; // orange-600
    default:
      return '#3b82f6'; // blue-500
  }
};

// Convert polygon coordinates to SVG path for the globe
const polygonToPath = (polygon: [number, number][]): string => {
  if (polygon.length === 0) return '';
  
  const pathCommands = polygon.map(([lat, lng], index) => {
    // Note: react-simple-maps expects [lng, lat] format
    const command = index === 0 ? 'M' : 'L';
    return `${command} ${lng} ${lat}`;
  });
  
  return pathCommands.join(' ') + ' Z';
};

export function GlobeView({ multiPolygon, annotation, onClick }: GlobeViewProps) {
  // Calculate center point for globe positioning
  const allCoords = multiPolygon.polygons.flatMap(poly => 
    [poly.outer, ...poly.holes].flat()
  );
  
  if (allCoords.length === 0) {
    return (
      <div className="w-[100px] h-[100px] border border-gray-200 rounded bg-gray-100 flex items-center justify-center">
        <span className="text-xs text-gray-500">No data</span>
      </div>
    );
  }
  
  const centerLat = allCoords.reduce((sum, [lat]) => sum + lat, 0) / allCoords.length;
  const centerLng = allCoords.reduce((sum, [, lng]) => sum + lng, 0) / allCoords.length;

  return (
    <div 
      className={`w-[100px] h-[100px] border border-gray-200 rounded bg-blue-100 overflow-hidden flex items-center justify-center ${onClick ? 'cursor-pointer hover:bg-blue-200 transition-colors' : ''}`}
      onClick={onClick}
    >
      <ComposableMap
        projection="geoOrthographic"
        projectionConfig={{
          scale: 80,
          center: [0, 0],
          rotate: [-centerLng, -centerLat, 0]
        }}
        width={100}
        height={100}
        style={{ width: '100%', height: '100%' }}
      >
        <Graticule stroke="#e5e7eb" strokeWidth={0.3} />
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography 
                key={geo.rsmKey} 
                geography={geo} 
                fill="#4a5568" 
                stroke="#2d3748"
                strokeWidth={0.3}
              />
            ))
          }
        </Geographies>
        
        {/* Render the polygon(s) */}
        {multiPolygon.polygons.map((polygonWithHoles, index) => (
          <g key={index}>
            {/* Outer ring */}
            <path
              d={polygonToPath(polygonWithHoles.outer)}
              fill={getPolygonFillColor(annotation)}
              stroke={getPolygonStrokeColor(annotation)}
              strokeWidth={0.5}
              fillRule="evenodd"
            />
            {/* Holes */}
            {polygonWithHoles.holes.map((hole, holeIndex) => (
              <path
                key={holeIndex}
                d={polygonToPath(hole)}
                fill="white"
                stroke={getPolygonStrokeColor(annotation)}
                strokeWidth={0.3}
              />
            ))}
          </g>
        ))}
      </ComposableMap>
    </div>
  );
}