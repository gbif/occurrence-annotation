import { useRef, useEffect } from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';

// Simplified world map data (major continents outline)
const worldMapData = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          // North America (simplified)
          [-130, 50], [-130, 70], [-60, 70], [-60, 50], [-80, 45], [-85, 40], [-90, 35], [-95, 30], [-100, 25], [-105, 30], [-110, 35], [-120, 40], [-130, 50]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          // South America (simplified)
          [-80, 10], [-80, -55], [-35, -55], [-35, 10], [-40, 15], [-50, 10], [-60, 5], [-70, 0], [-75, 5], [-80, 10]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          // Europe (simplified)
          [-10, 35], [-10, 70], [40, 70], [40, 35], [30, 40], [20, 45], [10, 50], [0, 45], [-10, 35]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          // Africa (simplified)
          [-20, 35], [-20, -35], [50, -35], [50, 35], [40, 30], [30, 20], [20, 10], [15, 0], [10, -10], [20, -20], [30, -30], [40, -25], [45, -15], [50, 0], [45, 15], [35, 25], [25, 30], [15, 35], [5, 40], [-5, 35], [-15, 30], [-20, 35]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          // Asia (simplified)
          [40, 35], [40, 70], [180, 70], [180, 10], [140, 10], [120, 20], [100, 30], [80, 40], [60, 45], [40, 35]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          // Australia (simplified)
          [110, -10], [110, -45], [160, -45], [160, -10], [150, -15], [140, -20], [130, -25], [120, -20], [110, -10]
        ]]
      }
    }
  ]
};

interface Globe3DProps {
  coordinates: [number, number][] | [number, number][][];
  annotation?: string;
  isMultiPolygon?: boolean;
  onClick?: () => void;
  size?: number;
}

export function Globe3D({ 
  coordinates, 
  annotation = 'SUSPICIOUS', 
  isMultiPolygon = false, 
  onClick,
  size = 80 
}: Globe3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up projection
    const projection = geoOrthographic()
      .scale(size * 0.45)
      .translate([size / 2, size / 2])
      .clipAngle(90);

    const path = geoPath(projection, ctx);

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw globe background
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.45, 0, 2 * Math.PI);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw graticule (grid lines)
    const graticule = geoGraticule();
    ctx.beginPath();
    path(graticule());
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Calculate center of polygon(s) for globe rotation
    const polygons: [number, number][][] = isMultiPolygon 
      ? (coordinates as [number, number][][])
      : [coordinates as [number, number][]];

    if (polygons.length === 0 || polygons[0].length === 0) return;

    // Find center of all polygons
    const allCoords = polygons.flat();
    const lats = allCoords.map(c => c[0]);
    const lngs = allCoords.map(c => c[1]);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

    // Rotate globe to center the polygon
    projection.rotate([-centerLng, -centerLat]);

    // Get annotation colors
    const annotationColors: { [key: string]: { fill: string; stroke: string } } = {
      SUSPICIOUS: { fill: 'rgba(239, 68, 68, 0.7)', stroke: '#dc2626' },
      NATIVE: { fill: 'rgba(16, 185, 129, 0.7)', stroke: '#059669' },
      MANAGED: { fill: 'rgba(59, 130, 246, 0.7)', stroke: '#2563eb' },
      FORMER: { fill: 'rgba(168, 85, 247, 0.7)', stroke: '#9333ea' },
      VAGRANT: { fill: 'rgba(249, 115, 22, 0.7)', stroke: '#ea580c' },
    };
    const color = annotationColors[annotation.toUpperCase()] || annotationColors.SUSPICIOUS;

    // Draw polygons
    polygons.forEach(polyCoords => {
      if (polyCoords.length < 3) return;

      // Convert to GeoJSON-like format for d3-geo
      const geoPolygon = {
        type: 'Polygon' as const,
        coordinates: [polyCoords.map(coord => [coord[1], coord[0]])] // Convert [lat, lng] to [lng, lat]
      };

      ctx.beginPath();
      path(geoPolygon);
      
      // Fill polygon
      ctx.fillStyle = color.fill;
      ctx.fill();
      
      // Stroke polygon
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Draw a subtle highlight point at the center
    const projected = projection([centerLng, centerLat]);
    if (projected) {
      ctx.beginPath();
      ctx.arc(projected[0], projected[1], 2, 0, 2 * Math.PI);
      ctx.fillStyle = color.stroke;
      ctx.fill();
    }

  }, [coordinates, annotation, isMultiPolygon, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`border border-gray-200 rounded-full bg-white ${onClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
      onClick={onClick}
      title="3D Globe View"
    />
  );
}