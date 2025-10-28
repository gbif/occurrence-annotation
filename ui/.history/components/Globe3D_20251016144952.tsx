import { useRef, useEffect } from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';

// Use Natural Earth 110m coastlines data (simplified for bundle size)
const worldMapData = {
  type: 'FeatureCollection' as const,
  features: [
    // North America - more detailed coastline
    {
      type: 'Feature' as const,
      properties: { name: 'North America' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [
          // Continental US
          [[
            [-158.1, 21.8], [-157.9, 21.3], [-155.5, 19.1], [-155.0, 18.9], [-154.8, 19.5], [-156.1, 20.9], 
            [-158.1, 21.8]
          ]], // Hawaii
          [[
            [-178.3, 70.0], [-156.0, 71.5], [-130.0, 70.2], [-87.5, 67.8], [-84.0, 46.4], [-82.4, 42.9],
            [-82.7, 41.7], [-83.5, 42.1], [-87.8, 42.3], [-90.6, 46.7], [-94.6, 49.4], [-95.2, 49.4],
            [-123.3, 49.0], [-124.8, 50.4], [-126.8, 50.4], [-128.0, 50.8], [-131.7, 54.1], [-132.7, 54.9],
            [-134.3, 54.5], [-142.0, 69.5], [-163.0, 68.9], [-165.6, 68.6], [-168.0, 65.7], [-166.4, 68.8],
            [-164.9, 68.7], [-163.2, 69.6], [-161.9, 70.3], [-160.4, 70.8], [-178.3, 70.0]
          ]]
        ]
      }
    },
    // Greenland
    {
      type: 'Feature' as const,
      properties: { name: 'Greenland' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-46.8, 82.6], [-43.4, 83.2], [-40.0, 83.2], [-38.6, 84.0], [-35.1, 83.6], [-27.1, 83.5],
          [-20.8, 82.7], [-22.9, 82.1], [-26.2, 82.3], [-31.9, 82.2], [-31.4, 82.0], [-27.8, 82.1],
          [-24.8, 81.7], [-22.3, 80.7], [-22.1, 79.6], [-21.7, 76.8], [-19.7, 76.1], [-19.7, 75.1],
          [-20.6, 73.1], [-19.8, 70.2], [-17.5, 69.3], [-18.9, 68.4], [-19.7, 67.4], [-27.0, 68.3],
          [-31.0, 68.1], [-31.8, 67.1], [-32.8, 66.9], [-33.6, 66.8], [-35.1, 66.3], [-36.3, 65.9],
          [-37.3, 65.4], [-39.4, 65.4], [-40.3, 64.8], [-41.3, 63.9], [-42.8, 66.2], [-42.8, 69.2],
          [-42.4, 70.8], [-43.0, 71.5], [-44.5, 71.7], [-46.2, 71.2], [-47.9, 70.2], [-49.2, 69.9],
          [-51.6, 69.0], [-53.7, 67.2], [-54.4, 67.3], [-54.8, 69.2], [-55.6, 70.0], [-56.7, 71.3],
          [-55.8, 72.9], [-54.7, 73.8], [-53.3, 74.9], [-53.2, 75.9], [-50.4, 76.4], [-48.5, 76.8],
          [-47.9, 79.0], [-46.8, 82.6]
        ]]
      }
    },
    // Europe with more detail
    {
      type: 'Feature' as const,
      properties: { name: 'Europe' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [
          // Scandinavia and continental Europe
          [[
            [31.3, 70.0], [28.6, 71.2], [23.7, 71.0], [16.8, 68.0], [11.0, 67.3], [9.6, 64.1],
            [5.3, 62.0], [4.7, 59.5], [7.1, 58.1], [12.4, 56.0], [14.1, 55.6], [12.9, 54.9],
            [12.5, 56.0], [10.9, 56.5], [10.7, 53.5], [7.1, 53.6], [6.9, 49.2], [3.3, 43.1],
            [-1.0, 43.8], [-9.0, 41.9], [-9.3, 43.0], [-7.0, 43.8], [-1.9, 43.4], [3.0, 42.5],
            [9.6, 42.2], [9.6, 40.8], [16.2, 38.2], [18.5, 40.3], [22.9, 41.3], [28.0, 43.7],
            [27.2, 44.2], [28.7, 45.9], [26.3, 43.9], [22.5, 44.2], [22.4, 45.5], [26.1, 48.2],
            [32.2, 49.2], [32.4, 52.3], [31.8, 53.9], [27.5, 53.9], [25.3, 54.8], [22.7, 54.3],
            [19.7, 54.5], [19.7, 56.0], [21.0, 56.8], [22.6, 59.5], [25.7, 60.2], [28.2, 59.5],
            [31.6, 62.8], [31.3, 70.0]
          ]],
          // British Isles
          [[
            [-10.5, 51.7], [-6.2, 53.4], [-6.2, 54.8], [-5.0, 58.6], [-4.2, 57.6], [-3.0, 58.6],
            [-4.3, 57.3], [-2.0, 55.9], [-1.9, 55.8], [-0.9, 54.6], [0.5, 50.8], [-4.3, 50.3],
            [-3.7, 51.4], [-4.9, 51.6], [-5.3, 49.9], [-10.5, 51.7]
          ]]
        ]
      }
    },
    // Africa with better coastline
    {
      type: 'Feature' as const,
      properties: { name: 'Africa' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [51.1, 12.0], [43.1, 12.7], [42.4, 15.2], [32.9, 22.0], [25.0, 25.7], [11.6, 32.9],
          [-8.7, 27.4], [-13.2, 27.6], [-16.8, 27.7], [-17.1, 21.4], [-17.9, 21.4], [-14.8, 16.3],
          [-14.5, 16.0], [-12.2, 14.6], [-11.9, 12.4], [-11.0, 12.3], [-7.9, 12.4], [-4.8, 11.1],
          [2.2, 4.7], [5.9, 4.2], [8.5, 4.8], [8.9, 9.4], [14.2, 12.8], [14.5, 22.5], [23.5, 19.6],
          [25.0, 20.2], [25.7, 14.9], [35.3, 9.9], [33.2, 9.4], [32.0, 8.4], [38.4, 8.0],
          [38.8, 6.2], [41.2, 3.9], [43.3, 4.4], [45.0, 2.0], [45.6, -4.8], [45.5, -15.8],
          [44.0, -16.2], [37.4, -17.6], [36.3, -18.5], [32.8, -19.5], [31.5, -22.3], [31.2, -24.4],
          [29.4, -24.6], [25.9, -24.7], [25.8, -25.7], [25.2, -30.3], [22.6, -34.0], [18.4, -34.4],
          [18.2, -31.9], [16.3, -28.6], [11.6, -17.4], [12.8, -13.2], [13.2, -8.9], [12.7, -4.8],
          [9.6, -2.1], [7.5, -4.4], [2.9, -4.4], [-9.2, -4.5], [-13.4, -4.4], [-16.7, -12.5],
          [-18.0, -21.9], [-12.8, -24.5], [-8.9, -26.8], [-4.9, -25.8], [1.4, -25.8], [5.2, -25.6],
          [11.5, -25.3], [15.2, -32.0], [16.3, -34.1], [20.7, -34.8], [35.0, -33.0], [51.1, 12.0]
        ]]
      }
    },
    // Asia
    {
      type: 'Feature' as const,
      properties: { name: 'Asia' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [26.5, 41.2], [44.8, 41.2], [61.2, 35.7], [74.9, 37.0], [87.4, 49.5], [98.2, 42.6],
          [99.5, 42.5], [103.3, 41.4], [104.5, 41.6], [106.2, 42.9], [107.7, 42.8], [116.7, 47.8],
          [117.4, 53.4], [119.8, 53.8], [125.9, 53.2], [137.7, 54.6], [138.3, 57.0], [138.8, 59.6],
          [139.9, 61.2], [159.3, 61.2], [169.9, 60.5], [180.0, 64.9], [180.0, 71.5], [180.0, 77.8],
          [170.0, 71.0], [157.0, 64.0], [151.0, 62.0], [142.0, 59.0], [130.0, 62.0], [106.0, 50.0],
          [82.0, 50.0], [75.0, 42.0], [70.0, 38.0], [60.0, 36.0], [50.0, 37.0], [40.0, 40.0],
          [32.0, 40.0], [26.5, 41.2]
        ]]
      }
    },
    // Australia and Oceania
    {
      type: 'Feature' as const,
      properties: { name: 'Australia' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [
          // Australia mainland
          [[
            [113.3, -13.8], [128.0, -12.2], [136.2, -13.9], [140.9, -17.0], [144.7, -20.0],
            [153.6, -24.4], [153.5, -28.1], [149.9, -37.1], [147.6, -38.8], [145.0, -38.6],
            [142.2, -38.4], [140.7, -37.8], [138.5, -35.3], [135.9, -35.0], [135.2, -34.5],
            [134.6, -33.2], [134.1, -32.0], [132.3, -32.0], [130.8, -32.3], [127.2, -32.3],
            [124.8, -32.9], [121.0, -33.8], [115.5, -34.2], [115.0, -32.2], [115.0, -30.0],
            [114.6, -26.7], [113.7, -24.0], [113.8, -22.0], [114.0, -20.0], [113.3, -13.8]
          ]],
          // Tasmania
          [[
            [148.3, -40.9], [148.0, -42.8], [147.0, -43.2], [146.4, -41.1], [145.0, -40.8],
            [144.0, -41.2], [143.3, -40.7], [145.0, -39.8], [148.3, -40.9]
          ]],
          // New Zealand North Island
          [[
            [172.8, -34.4], [174.3, -35.3], [174.7, -36.5], [175.3, -37.2], [175.8, -38.4],
            [175.9, -39.5], [174.6, -39.9], [173.8, -39.0], [173.5, -38.2], [172.8, -37.3],
            [172.7, -36.4], [173.2, -35.7], [172.8, -34.4]
          ]],
          // New Zealand South Island
          [[
            [172.6, -40.5], [173.0, -41.6], [173.5, -42.2], [171.0, -44.0], [169.3, -46.6],
            [166.6, -46.2], [166.3, -45.9], [167.2, -45.2], [168.4, -44.1], [169.7, -43.9],
            [170.6, -43.4], [171.4, -42.3], [171.8, -41.4], [172.2, -40.8], [172.6, -40.5]
          ]]
        ]
      }
    },
    // South America
    {
      type: 'Feature' as const,
      properties: { name: 'South America' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-81.7, 12.4], [-68.2, 12.2], [-59.6, 8.4], [-60.2, 4.9], [-59.0, 1.4], [-56.0, 2.0],
          [-53.6, 2.0], [-51.7, 4.6], [-51.0, 7.6], [-50.0, 1.9], [-48.6, -0.2], [-44.9, -1.6],
          [-41.8, -2.9], [-39.8, -2.9], [-38.5, -3.7], [-35.1, -4.9], [-34.9, -7.3], [-34.7, -8.0],
          [-35.1, -9.1], [-37.2, -11.0], [-39.2, -14.2], [-39.6, -17.6], [-41.0, -20.5], [-43.4, -22.5],
          [-44.7, -23.3], [-46.5, -24.1], [-48.5, -25.8], [-51.0, -30.0], [-53.4, -33.1], [-53.6, -33.4],
          [-55.9, -30.9], [-57.6, -30.2], [-58.5, -27.1], [-57.6, -25.2], [-58.6, -24.0], [-60.2, -23.9],
          [-64.3, -22.1], [-65.0, -22.0], [-64.3, -20.5], [-62.8, -18.0], [-60.0, -16.3], [-58.2, -16.9],
          [-58.2, -19.9], [-57.8, -22.0], [-56.5, -22.3], [-55.8, -22.0], [-55.5, -20.7], [-55.1, -16.0],
          [-57.3, -15.6], [-60.0, -11.0], [-62.8, -7.3], [-67.0, -2.3], [-70.1, 0.7], [-70.0, 2.2],
          [-70.4, 3.7], [-67.9, 6.2], [-67.5, 8.6], [-67.2, 10.5], [-68.0, 11.1], [-69.9, 12.1],
          [-72.4, 11.0], [-74.0, 9.5], [-77.3, 7.0], [-79.0, 8.3], [-81.4, 8.8], [-81.7, 12.4]
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
      .scale(size * 0.42)
      .translate([size / 2, size / 2])
      .clipAngle(90)
      .precision(0.1);

    const path = geoPath(projection, ctx);

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Set high DPI scaling for crisp rendering
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(ratio, ratio);

    // Draw ocean (globe background)
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.42, 0, 2 * Math.PI);
    ctx.fillStyle = '#f8fafc'; // Very light gray-blue ocean
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
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

    // Draw graticule (grid lines) - subtle background grid
    const graticule = geoGraticule();
    ctx.beginPath();
    path(graticule());
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Draw all world continents in one pass to avoid overlaps
    ctx.beginPath();
    worldMapData.features.forEach(feature => {
      path(feature.geometry);
    });
    // Land areas - light gray/beige color that's easy to see
    ctx.fillStyle = '#f1f5f9'; 
    ctx.fill();
    // Continent borders - subtle dark outline
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.3;
    ctx.stroke();

    // Get annotation colors with better contrast
    const annotationColors: { [key: string]: { fill: string; stroke: string; glow: string } } = {
      SUSPICIOUS: { fill: 'rgba(239, 68, 68, 0.9)', stroke: '#dc2626', glow: 'rgba(239, 68, 68, 0.4)' },
      NATIVE: { fill: 'rgba(34, 197, 94, 0.9)', stroke: '#16a34a', glow: 'rgba(34, 197, 94, 0.4)' },
      MANAGED: { fill: 'rgba(59, 130, 246, 0.9)', stroke: '#2563eb', glow: 'rgba(59, 130, 246, 0.4)' },
      FORMER: { fill: 'rgba(168, 85, 247, 0.9)', stroke: '#9333ea', glow: 'rgba(168, 85, 247, 0.4)' },
      VAGRANT: { fill: 'rgba(249, 115, 22, 0.9)', stroke: '#ea580c', glow: 'rgba(249, 115, 22, 0.4)' },
    };
    const color = annotationColors[annotation.toUpperCase()] || annotationColors.SUSPICIOUS;

    // Draw polygons with enhanced visual effects
    polygons.forEach(polyCoords => {
      if (polyCoords.length < 3) return;

      // Convert to GeoJSON-like format for d3-geo
      const geoPolygon = {
        type: 'Polygon' as const,
        coordinates: [polyCoords.map(coord => [coord[1], coord[0]])] // Convert [lat, lng] to [lng, lat]
      };

      // Draw glow effect first
      ctx.shadowColor = color.glow;
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      ctx.beginPath();
      path(geoPolygon);
      
      // Fill polygon with solid color and glow
      ctx.fillStyle = color.fill;
      ctx.fill();
      
      // Reset shadow for stroke
      ctx.shadowBlur = 0;
      
      // Stroke polygon with thick border
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Add inner stroke for better definition
      ctx.beginPath();
      path(geoPolygon);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw a center marker for better visual reference
    const projected = projection([centerLng, centerLat]);
    if (projected) {
      // Outer ring
      ctx.beginPath();
      ctx.arc(projected[0], projected[1], 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner dot
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