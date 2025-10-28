import { useRef, useEffect } from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';

// More detailed world map data (major continents)
const worldMapData = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { name: 'North America' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-168, 65], [-168, 68], [-166, 69], [-164, 70], [-158, 70], [-140, 69], [-128, 68], [-122, 67], [-117, 66],
          [-110, 65], [-105, 64], [-100, 62], [-95, 60], [-90, 58], [-85, 56], [-80, 54], [-75, 52], [-70, 50],
          [-65, 48], [-60, 46], [-56, 44], [-54, 42], [-55, 40], [-58, 38], [-62, 36], [-66, 34], [-70, 32],
          [-75, 30], [-80, 28], [-85, 26], [-90, 25], [-95, 24], [-100, 24], [-105, 25], [-110, 26], [-115, 28],
          [-120, 30], [-125, 32], [-130, 35], [-135, 38], [-140, 42], [-145, 46], [-150, 50], [-155, 54],
          [-160, 58], [-165, 62], [-168, 65]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'South America' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-82, 12], [-80, 10], [-78, 8], [-76, 6], [-74, 4], [-72, 2], [-70, 0], [-68, -2], [-66, -4],
          [-64, -6], [-62, -8], [-60, -10], [-58, -12], [-56, -14], [-54, -16], [-52, -18], [-50, -20],
          [-48, -22], [-46, -24], [-44, -26], [-42, -28], [-40, -30], [-38, -32], [-36, -34], [-35, -36],
          [-34, -38], [-34, -40], [-35, -42], [-36, -44], [-38, -46], [-40, -48], [-42, -50], [-44, -52],
          [-46, -54], [-48, -55], [-50, -55], [-52, -54], [-54, -53], [-56, -52], [-58, -50], [-60, -48],
          [-62, -46], [-64, -44], [-66, -42], [-68, -40], [-70, -38], [-72, -36], [-74, -34], [-76, -32],
          [-78, -30], [-80, -28], [-81, -26], [-82, -24], [-83, -22], [-84, -20], [-85, -18], [-86, -16],
          [-87, -14], [-88, -12], [-89, -10], [-90, -8], [-91, -6], [-92, -4], [-93, -2], [-94, 0],
          [-93, 2], [-92, 4], [-91, 6], [-90, 8], [-88, 10], [-86, 11], [-84, 12], [-82, 12]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Europe' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-24, 63], [-20, 65], [-15, 67], [-10, 68], [-5, 69], [0, 70], [5, 70], [10, 69], [15, 68],
          [20, 67], [25, 66], [30, 65], [35, 64], [40, 62], [42, 60], [43, 58], [44, 56], [45, 54],
          [44, 52], [43, 50], [42, 48], [40, 46], [38, 44], [36, 42], [34, 40], [32, 38], [30, 36],
          [28, 35], [26, 34], [24, 34], [22, 35], [20, 36], [18, 37], [16, 38], [14, 39], [12, 40],
          [10, 41], [8, 42], [6, 43], [4, 44], [2, 45], [0, 46], [-2, 47], [-4, 48], [-6, 49],
          [-8, 50], [-10, 51], [-12, 52], [-14, 53], [-16, 54], [-18, 55], [-20, 56], [-22, 58],
          [-23, 60], [-24, 62], [-24, 63]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Africa' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-18, 37], [-16, 35], [-14, 33], [-12, 31], [-10, 29], [-8, 27], [-6, 25], [-4, 23], [-2, 21],
          [0, 19], [2, 17], [4, 15], [6, 13], [8, 11], [10, 9], [12, 7], [14, 5], [16, 3], [18, 1],
          [20, -1], [22, -3], [24, -5], [26, -7], [28, -9], [30, -11], [32, -13], [34, -15], [36, -17],
          [38, -19], [40, -21], [42, -23], [44, -25], [46, -27], [48, -29], [50, -31], [51, -33],
          [51, -35], [50, -35], [48, -34], [46, -33], [44, -32], [42, -31], [40, -30], [38, -29],
          [36, -28], [34, -27], [32, -26], [30, -25], [28, -24], [26, -23], [24, -22], [22, -21],
          [20, -20], [18, -19], [16, -18], [14, -17], [12, -16], [10, -15], [8, -14], [6, -13],
          [4, -12], [2, -11], [0, -10], [-2, -9], [-4, -8], [-6, -7], [-8, -6], [-10, -5], [-12, -4],
          [-14, -3], [-16, -2], [-18, -1], [-19, 1], [-20, 3], [-20, 5], [-19, 7], [-18, 9],
          [-17, 11], [-16, 13], [-15, 15], [-14, 17], [-13, 19], [-14, 21], [-15, 23], [-16, 25],
          [-17, 27], [-18, 29], [-18, 31], [-18, 33], [-18, 35], [-18, 37]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Asia' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [26, 42], [30, 44], [35, 46], [40, 48], [45, 50], [50, 52], [55, 54], [60, 56], [65, 58],
          [70, 60], [75, 62], [80, 64], [85, 66], [90, 68], [95, 70], [100, 71], [105, 72], [110, 73],
          [115, 74], [120, 75], [125, 76], [130, 77], [135, 78], [140, 79], [145, 80], [150, 79],
          [155, 78], [160, 77], [165, 76], [170, 75], [175, 74], [179, 73], [179, 70], [178, 67],
          [177, 64], [176, 61], [175, 58], [174, 55], [173, 52], [172, 49], [171, 46], [170, 43],
          [169, 40], [168, 37], [167, 34], [166, 31], [165, 28], [164, 25], [163, 22], [162, 19],
          [161, 16], [160, 13], [159, 10], [158, 7], [157, 4], [156, 1], [155, -2], [154, -5],
          [150, -3], [145, -1], [140, 1], [135, 3], [130, 5], [125, 7], [120, 9], [115, 11],
          [110, 13], [105, 15], [100, 17], [95, 19], [90, 21], [85, 23], [80, 25], [75, 27],
          [70, 29], [65, 31], [60, 33], [55, 35], [50, 37], [45, 39], [40, 40], [35, 41],
          [30, 41], [26, 42]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Australia' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [113, -10], [115, -12], [117, -14], [119, -16], [121, -18], [123, -20], [125, -22], [127, -24],
          [129, -26], [131, -28], [133, -30], [135, -32], [137, -34], [139, -36], [141, -38], [143, -39],
          [145, -40], [147, -41], [149, -42], [151, -43], [153, -44], [155, -44], [157, -43], [159, -42],
          [160, -40], [159, -38], [158, -36], [157, -34], [156, -32], [155, -30], [154, -28], [153, -26],
          [152, -24], [151, -22], [150, -20], [149, -18], [148, -16], [147, -14], [146, -12], [145, -11],
          [143, -10], [141, -9], [139, -9], [137, -10], [135, -10], [133, -10], [131, -10], [129, -10],
          [127, -10], [125, -10], [123, -10], [121, -10], [119, -10], [117, -10], [115, -10], [113, -10]
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

    // Draw world map continents
    ctx.beginPath();
    worldMapData.features.forEach(feature => {
      path(feature.geometry);
    });
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
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