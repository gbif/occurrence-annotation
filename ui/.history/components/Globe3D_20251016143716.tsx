import { useRef, useEffect } from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';

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