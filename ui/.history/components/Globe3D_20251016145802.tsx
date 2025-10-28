import { useRef, useEffect } from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';

// Simple, reliable world coastlines data
const worldMapData = {
  type: 'FeatureCollection' as const,
  features: [
    // North America
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-125, 50], [-125, 25], [-80, 25], [-80, 50], [-70, 60], [-90, 70], [-125, 50]
        ]]
      }
    },
    // Europe
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-10, 35], [40, 35], [40, 70], [-10, 70], [-10, 35]
        ]]
      }
    },
    // Africa
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-20, 35], [50, 35], [50, -35], [-20, -35], [-20, 35]
        ]]
      }
    },
    // Asia
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [40, 35], [180, 35], [180, 70], [40, 70], [40, 35]
        ]]
      }
    },
    // Australia
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [110, -10], [155, -10], [155, -45], [110, -45], [110, -10]
        ]]
      }
    },
    // South America
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-85, 12], [-35, 12], [-35, -55], [-85, -55], [-85, 12]
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

    // Set up projection with better quality
    const projection = geoOrthographic()
      .scale(size * 0.45)
      .translate([size / 2, size / 2])
      .clipAngle(90);

    const path = geoPath(projection, ctx);

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Calculate center of polygon(s) for globe rotation
    const polygons: [number, number][][] = isMultiPolygon 
      ? (coordinates as [number, number][][])
      : [coordinates as [number, number][]];

    if (polygons.length > 0 && polygons[0].length > 0) {
      // Find center of all polygons
      const allCoords = polygons.flat();
      const lats = allCoords.map(c => c[0]);
      const lngs = allCoords.map(c => c[1]);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

      // Rotate globe to center the polygon
      projection.rotate([-centerLng, -centerLat]);
    }

    // Draw ocean (globe background) with simple 3D shading
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.45;
    
    // Create a simple radial gradient for sphere effect
    const sphereGradient = ctx.createRadialGradient(
      centerX - radius * 0.3, centerY - radius * 0.3, 0,
      centerX, centerY, radius
    );
    sphereGradient.addColorStop(0, '#e0f2fe');
    sphereGradient.addColorStop(0.7, '#bae6fd');
    sphereGradient.addColorStop(1, '#7dd3fc');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = sphereGradient;
    ctx.fill();
    
    // Simple border
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw simple, clean grid lines
    const graticule = geoGraticule()
      .step([30, 30]); // Only major lines every 30 degrees
    
    ctx.beginPath();
    path(graticule());
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Draw all world continents simply and cleanly
    ctx.beginPath();
    worldMapData.features.forEach(feature => {
      path(feature.geometry);
    });
    // Simple land color
    ctx.fillStyle = '#e2e8f0'; 
    ctx.fill();
    // No continent borders to keep it clean
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.2;
    ctx.stroke();

    // Get annotation colors with clean styling
    const annotationColors: { [key: string]: { fill: string; stroke: string } } = {
      SUSPICIOUS: { fill: 'rgba(239, 68, 68, 0.8)', stroke: '#dc2626' },
      NATIVE: { fill: 'rgba(34, 197, 94, 0.8)', stroke: '#16a34a' },
      MANAGED: { fill: 'rgba(59, 130, 246, 0.8)', stroke: '#2563eb' },
      FORMER: { fill: 'rgba(168, 85, 247, 0.8)', stroke: '#9333ea' },
      VAGRANT: { fill: 'rgba(249, 115, 22, 0.8)', stroke: '#ea580c' },
    };
    const color = annotationColors[annotation.toUpperCase()] || annotationColors.SUSPICIOUS;

    // Draw polygons with clean, simple styling
    polygons.forEach(polyCoords => {
      if (polyCoords.length < 3) return;

      // Convert to GeoJSON-like format for d3-geo
      const geoPolygon = {
        type: 'Polygon' as const,
        coordinates: [polyCoords.map(coord => [coord[1], coord[0]])] // Convert [lat, lng] to [lng, lat]
      };

      ctx.beginPath();
      path(geoPolygon);
      
      // Simple, bold polygon fill
      ctx.fillStyle = color.fill;
      ctx.fill();
      
      // Clean stroke
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Simple center marker
    const projected = projection([centerLng, centerLat]);
    if (projected) {
      ctx.beginPath();
      ctx.arc(projected[0], projected[1], 3, 0, 2 * Math.PI);
      ctx.fillStyle = color.stroke;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
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