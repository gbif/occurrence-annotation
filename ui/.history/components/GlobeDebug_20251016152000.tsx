import { useRef, useEffect, useState } from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

// Realistic world coastlines for better visualization
const realisticWorld = {
  type: 'FeatureCollection' as const,
  features: [
    // North America with realistic coastlines
    {
      type: 'Feature' as const,
      properties: { name: 'North America' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          // Starting from Alaska, going clockwise around North America
          [-168, 65], [-160, 68], [-155, 71], [-150, 70], [-145, 69], [-140, 69], [-135, 68],
          [-130, 68], [-125, 69], [-120, 70], [-115, 69], [-110, 68], [-105, 68], [-100, 69],
          [-95, 69], [-90, 68], [-85, 67], [-80, 66], [-75, 65], [-70, 64], [-65, 63],
          [-60, 62], [-55, 60], [-50, 58], [-45, 55], [-43, 52], [-42, 49], [-43, 46],
          [-45, 43], [-48, 40], [-52, 38], [-56, 36], [-60, 35], [-64, 34], [-68, 32],
          [-72, 30], [-75, 28], [-78, 26], [-80, 24], [-82, 22], [-84, 20], [-86, 18],
          [-88, 16], [-90, 14], [-92, 12], [-94, 10], [-96, 8], [-98, 6], [-100, 4],
          [-102, 2], [-104, 0], [-106, -2], [-108, -4], [-110, -6], [-112, -8], [-114, -10],
          [-116, -12], [-118, -14], [-120, -16], [-122, -18], [-124, -20], [-126, -22],
          [-128, -24], [-130, -26], [-132, -28], [-134, -30], [-136, -32], [-138, -34],
          [-140, -36], [-142, -38], [-144, -40], [-146, -42], [-148, -44], [-150, -46],
          [-152, -48], [-154, -50], [-156, -52], [-158, -54], [-160, -56], [-162, -58],
          [-164, -60], [-166, -62], [-168, -64], [-170, -66], [-172, -68], [-174, -70],
          [-176, -72], [-178, -74], [178, -76], [176, -74], [174, -72], [172, -70],
          [170, -68], [168, -66], [166, -64], [164, -62], [162, -60], [160, -58],
          [158, -56], [156, -54], [154, -52], [152, -50], [150, -48], [148, -46],
          [146, -44], [144, -42], [142, -40], [140, -38], [138, -36], [136, -34],
          [134, -32], [132, -30], [130, -28], [128, -26], [126, -24], [124, -22],
          [122, -20], [120, -18], [118, -16], [116, -14], [114, -12], [112, -10],
          [110, -8], [108, -6], [106, -4], [104, -2], [102, 0], [100, 2], [98, 4],
          [96, 6], [94, 8], [92, 10], [90, 12], [88, 14], [86, 16], [84, 18], [82, 20],
          [80, 22], [78, 24], [76, 26], [74, 28], [72, 30], [70, 32], [68, 34], [66, 36],
          [64, 38], [62, 40], [60, 42], [58, 44], [56, 46], [54, 48], [52, 50], [50, 52],
          [48, 54], [46, 56], [44, 58], [42, 60], [40, 62], [35, 64], [30, 65], [25, 66],
          [20, 67], [15, 68], [10, 69], [5, 70], [0, 71], [-5, 72], [-10, 73], [-15, 74],
          [-20, 75], [-25, 74], [-30, 73], [-35, 72], [-40, 71], [-45, 70], [-50, 69],
          [-55, 68], [-60, 67], [-65, 66], [-70, 65], [-75, 64], [-80, 63], [-85, 62],
          [-90, 61], [-95, 60], [-100, 61], [-105, 62], [-110, 63], [-115, 64], [-120, 65],
          [-125, 66], [-130, 67], [-135, 68], [-140, 69], [-145, 70], [-150, 71], [-155, 70],
          [-160, 69], [-165, 68], [-168, 65]
        ]]
      }
    },
    // Europe with better coastline detail
    {
      type: 'Feature' as const,
      properties: { name: 'Europe' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-25, 60], [-20, 65], [-15, 70], [-10, 72], [-5, 74], [0, 75], [5, 74], [10, 73],
          [15, 72], [20, 70], [25, 68], [30, 66], [35, 64], [40, 62], [43, 60], [45, 58],
          [47, 56], [48, 54], [49, 52], [48, 50], [47, 48], [45, 46], [43, 44], [40, 42],
          [37, 40], [34, 38], [31, 36], [28, 35], [25, 34], [22, 33], [19, 34], [16, 35],
          [13, 36], [10, 37], [7, 38], [4, 39], [1, 40], [-2, 41], [-5, 42], [-8, 43],
          [-11, 44], [-14, 45], [-17, 46], [-20, 47], [-23, 48], [-25, 50], [-26, 52],
          [-27, 54], [-26, 56], [-25, 58], [-25, 60]
        ]]
      }
    },
    // Africa with realistic shape
    {
      type: 'Feature' as const,
      properties: { name: 'Africa' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-17, 37], [-14, 35], [-11, 33], [-8, 32], [-5, 31], [-2, 30], [1, 29], [4, 28],
          [7, 27], [10, 26], [13, 25], [16, 24], [19, 23], [22, 22], [25, 21], [28, 20],
          [31, 19], [34, 18], [37, 17], [40, 16], [43, 15], [46, 14], [49, 13], [51, 12],
          [53, 11], [55, 10], [56, 9], [57, 8], [58, 7], [59, 6], [60, 5], [59, 4], [58, 3],
          [57, 2], [56, 1], [55, 0], [54, -1], [53, -2], [52, -3], [51, -4], [50, -5],
          [49, -6], [48, -7], [47, -8], [46, -9], [45, -10], [44, -11], [43, -12], [42, -13],
          [41, -14], [40, -15], [39, -16], [38, -17], [37, -18], [36, -19], [35, -20],
          [34, -21], [33, -22], [32, -23], [31, -24], [30, -25], [29, -26], [28, -27],
          [27, -28], [26, -29], [25, -30], [24, -31], [23, -32], [22, -33], [21, -34],
          [20, -35], [19, -34], [18, -33], [17, -32], [16, -31], [15, -30], [14, -29],
          [13, -28], [12, -27], [11, -26], [10, -25], [9, -24], [8, -23], [7, -22],
          [6, -21], [5, -20], [4, -19], [3, -18], [2, -17], [1, -16], [0, -15], [-1, -14],
          [-2, -13], [-3, -12], [-4, -11], [-5, -10], [-6, -9], [-7, -8], [-8, -7],
          [-9, -6], [-10, -5], [-11, -4], [-12, -3], [-13, -2], [-14, -1], [-15, 0],
          [-16, 1], [-17, 2], [-18, 3], [-19, 4], [-20, 5], [-19, 6], [-18, 7], [-17, 8],
          [-16, 9], [-15, 10], [-14, 11], [-13, 12], [-12, 13], [-11, 14], [-10, 15],
          [-9, 16], [-8, 17], [-7, 18], [-6, 19], [-5, 20], [-4, 21], [-3, 22], [-2, 23],
          [-1, 24], [0, 25], [1, 26], [2, 27], [3, 28], [4, 29], [5, 30], [6, 31], [7, 32],
          [8, 33], [9, 34], [10, 35], [11, 36], [12, 37], [10, 38], [8, 39], [6, 40],
          [4, 39], [2, 38], [0, 37], [-2, 36], [-4, 37], [-6, 38], [-8, 37], [-10, 36],
          [-12, 37], [-14, 38], [-16, 37], [-17, 37]
        ]]
      }
    },
    // Asia with better detail
    {
      type: 'Feature' as const,
      properties: { name: 'Asia' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [40, 45], [43, 47], [46, 49], [49, 51], [52, 53], [55, 55], [58, 57], [61, 59],
          [64, 61], [67, 63], [70, 65], [73, 67], [76, 69], [79, 71], [82, 73], [85, 75],
          [88, 77], [91, 79], [94, 81], [97, 83], [100, 85], [103, 83], [106, 81], [109, 79],
          [112, 77], [115, 75], [118, 73], [121, 71], [124, 69], [127, 67], [130, 65],
          [133, 63], [136, 61], [139, 59], [142, 57], [145, 55], [148, 53], [151, 51],
          [154, 49], [157, 47], [160, 45], [163, 43], [166, 41], [169, 39], [172, 37],
          [175, 35], [178, 33], [179, 31], [179, 29], [178, 27], [177, 25], [176, 23],
          [175, 21], [174, 19], [173, 17], [172, 15], [171, 13], [170, 11], [169, 9],
          [168, 7], [167, 5], [166, 3], [165, 1], [164, -1], [163, -3], [162, -5],
          [161, -7], [160, -9], [159, -11], [158, -9], [157, -7], [156, -5], [155, -3],
          [154, -1], [153, 1], [152, 3], [151, 5], [150, 7], [149, 9], [148, 11],
          [147, 13], [146, 15], [145, 17], [144, 19], [143, 21], [142, 23], [141, 25],
          [140, 27], [139, 29], [138, 31], [137, 33], [136, 35], [135, 37], [134, 39],
          [133, 41], [132, 43], [131, 45], [130, 43], [129, 41], [128, 39], [127, 37],
          [126, 35], [125, 33], [124, 31], [123, 29], [122, 27], [121, 25], [120, 23],
          [119, 21], [118, 19], [117, 17], [116, 15], [115, 13], [114, 11], [113, 9],
          [112, 7], [111, 5], [110, 3], [109, 1], [108, -1], [107, 1], [106, 3], [105, 5],
          [104, 7], [103, 9], [102, 11], [101, 13], [100, 15], [99, 17], [98, 19],
          [97, 21], [96, 23], [95, 25], [94, 27], [93, 29], [92, 31], [91, 33], [90, 35],
          [89, 37], [88, 39], [87, 41], [86, 43], [85, 45], [84, 43], [83, 41], [82, 39],
          [81, 37], [80, 35], [79, 33], [78, 31], [77, 29], [76, 27], [75, 25], [74, 23],
          [73, 21], [72, 19], [71, 17], [70, 15], [69, 13], [68, 11], [67, 9], [66, 7],
          [65, 5], [64, 3], [63, 1], [62, -1], [61, 1], [60, 3], [59, 5], [58, 7], [57, 9],
          [56, 11], [55, 13], [54, 15], [53, 17], [52, 19], [51, 21], [50, 23], [49, 25],
          [48, 27], [47, 29], [46, 31], [45, 33], [44, 35], [43, 37], [42, 39], [41, 41],
          [40, 43], [40, 45]
        ]]
      }
    },
    // Australia with more detail
    {
      type: 'Feature' as const,
      properties: { name: 'Australia' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [113, -10], [116, -11], [119, -12], [122, -13], [125, -14], [128, -15], [131, -16],
          [134, -17], [137, -18], [140, -19], [143, -20], [146, -21], [149, -22], [152, -23],
          [155, -24], [158, -25], [161, -26], [164, -27], [167, -28], [170, -29], [173, -30],
          [176, -31], [179, -32], [179, -35], [178, -38], [177, -41], [176, -44], [175, -47],
          [174, -50], [173, -53], [172, -50], [171, -47], [170, -44], [169, -41], [168, -38],
          [167, -35], [166, -32], [165, -29], [164, -26], [163, -23], [162, -20], [161, -17],
          [160, -14], [159, -11], [158, -8], [157, -11], [156, -14], [155, -17], [154, -20],
          [153, -23], [152, -26], [151, -29], [150, -32], [149, -35], [148, -38], [147, -41],
          [146, -44], [145, -47], [144, -44], [143, -41], [142, -38], [141, -35], [140, -32],
          [139, -29], [138, -26], [137, -23], [136, -20], [135, -17], [134, -14], [133, -11],
          [132, -8], [131, -11], [130, -14], [129, -17], [128, -20], [127, -23], [126, -26],
          [125, -29], [124, -32], [123, -35], [122, -38], [121, -35], [120, -32], [119, -29],
          [118, -26], [117, -23], [116, -20], [115, -17], [114, -14], [113, -11], [113, -10]
        ]]
      }
    },
    // South America with realistic coastline
    {
      type: 'Feature' as const,
      properties: { name: 'South America' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-81, 12], [-78, 11], [-75, 10], [-72, 9], [-69, 8], [-66, 7], [-63, 6], [-60, 5],
          [-57, 4], [-54, 3], [-51, 2], [-48, 1], [-45, 0], [-42, -1], [-39, -2], [-36, -3],
          [-33, -4], [-30, -5], [-27, -6], [-24, -7], [-21, -8], [-18, -9], [-15, -10],
          [-12, -11], [-9, -12], [-6, -13], [-3, -14], [0, -15], [3, -16], [6, -17],
          [9, -18], [12, -19], [15, -20], [18, -21], [21, -22], [24, -23], [27, -24],
          [30, -25], [33, -26], [36, -27], [39, -28], [42, -29], [45, -30], [48, -31],
          [51, -32], [54, -33], [57, -34], [60, -35], [63, -36], [66, -37], [69, -38],
          [72, -39], [75, -40], [78, -41], [81, -42], [84, -43], [87, -44], [90, -45],
          [93, -46], [96, -47], [99, -48], [102, -49], [105, -50], [108, -51], [111, -52],
          [114, -53], [117, -54], [120, -55], [123, -54], [126, -53], [129, -52], [132, -51],
          [135, -50], [138, -49], [141, -48], [144, -47], [147, -46], [150, -45], [153, -44],
          [156, -43], [159, -42], [162, -41], [165, -40], [168, -39], [171, -38], [174, -37],
          [177, -36], [180, -35], [-177, -34], [-174, -33], [-171, -32], [-168, -31],
          [-165, -30], [-162, -29], [-159, -28], [-156, -27], [-153, -26], [-150, -25],
          [-147, -24], [-144, -23], [-141, -22], [-138, -21], [-135, -20], [-132, -19],
          [-129, -18], [-126, -17], [-123, -16], [-120, -15], [-117, -14], [-114, -13],
          [-111, -12], [-108, -11], [-105, -10], [-102, -9], [-99, -8], [-96, -7],
          [-93, -6], [-90, -5], [-87, -4], [-84, -3], [-81, -2], [-78, -1], [-75, 0],
          [-72, 1], [-69, 2], [-66, 3], [-63, 4], [-60, 3], [-57, 2], [-54, 1], [-51, 0],
          [-48, -1], [-45, -2], [-42, -1], [-39, 0], [-36, 1], [-33, 2], [-30, 3],
          [-27, 4], [-24, 5], [-21, 6], [-18, 7], [-15, 8], [-12, 9], [-9, 10], [-6, 11],
          [-3, 12], [0, 11], [3, 10], [6, 9], [9, 8], [12, 7], [15, 6], [18, 5], [21, 4],
          [24, 3], [27, 2], [30, 1], [33, 0], [36, -1], [39, -2], [42, -1], [45, 0],
          [48, 1], [51, 2], [54, 3], [57, 4], [60, 5], [63, 6], [66, 7], [69, 8], [72, 9],
          [75, 10], [78, 11], [81, 12], [78, 13], [75, 12], [72, 11], [69, 12], [66, 13],
          [63, 12], [60, 11], [57, 12], [54, 13], [51, 12], [48, 11], [45, 12], [42, 13],
          [39, 12], [36, 11], [33, 12], [30, 13], [27, 12], [24, 11], [21, 12], [18, 13],
          [15, 12], [12, 11], [9, 12], [6, 13], [3, 12], [0, 11], [-3, 12], [-6, 13],
          [-9, 12], [-12, 11], [-15, 12], [-18, 13], [-21, 12], [-24, 11], [-27, 12],
          [-30, 13], [-33, 12], [-36, 11], [-39, 12], [-42, 13], [-45, 12], [-48, 11],
          [-51, 12], [-54, 13], [-57, 12], [-60, 11], [-63, 12], [-66, 13], [-69, 12],
          [-72, 11], [-75, 12], [-78, 13], [-81, 12]
        ]]
      }
    }
  ]
};

interface DebugPoint {
  lat: number;
  lng: number;
  label: string;
}

export function GlobeDebug() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [point, setPoint] = useState<DebugPoint>({ lat: 40.7128, lng: -74.0060, label: 'New York' });
  const [newLat, setNewLat] = useState('40.7128');
  const [newLng, setNewLng] = useState('-74.0060');
  const [newLabel, setNewLabel] = useState('New York');

  const size = 400; // Larger size for debugging

  const drawGlobe = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up projection
    const projection = geoOrthographic()
      .scale(size * 0.4)
      .translate([size / 2, size / 2])
      .rotate([rotation.x, rotation.y])
      .clipAngle(90);

    const path = geoPath(projection, ctx);

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw ocean background with gradient
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.4;

    const oceanGradient = ctx.createRadialGradient(
      centerX - radius * 0.3, centerY - radius * 0.3, 0,
      centerX, centerY, radius
    );
    oceanGradient.addColorStop(0, '#87ceeb');
    oceanGradient.addColorStop(0.7, '#4682b4');
    oceanGradient.addColorStop(1, '#191970');

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = oceanGradient;
    ctx.fill();
    ctx.strokeStyle = '#000080';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw graticule (grid lines)
    const graticule = geoGraticule().step([15, 15]);
    ctx.beginPath();
    path(graticule());
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Draw continents
    ctx.beginPath();
    realisticWorld.features.forEach(feature => {
      path(feature.geometry);
    });
    ctx.fillStyle = '#228b22';
    ctx.fill();
    ctx.strokeStyle = '#006400';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw the debug point
    const projected = projection([point.lng, point.lat]);
    if (projected) {
      // Point circle
      ctx.beginPath();
      ctx.arc(projected[0], projected[1], 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#ff4500';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Point label
      ctx.fillStyle = '#000000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(point.label, projected[0], projected[1] - 15);
    }

    // Add debug info
    ctx.fillStyle = '#000000';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Rotation: [${rotation.x.toFixed(1)}, ${rotation.y.toFixed(1)}]`, 10, 20);
    ctx.fillText(`Point: ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`, 10, 40);
    ctx.fillText(`Label: ${point.label}`, 10, 60);
  };

  useEffect(() => {
    drawGlobe();
  }, [rotation, point]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    const handleMouseMove = (e: MouseEvent) => {
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      
      setRotation(prev => ({
        x: prev.x + deltaX * 0.5,
        y: Math.max(-90, Math.min(90, prev.y + deltaY * 0.5))
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const updatePoint = () => {
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    
    if (!isNaN(lat) && !isNaN(lng)) {
      setPoint({ lat, lng, label: newLabel });
    }
  };

  const presetLocations = [
    { lat: 40.7128, lng: -74.0060, label: 'New York' },
    { lat: 51.5074, lng: -0.1278, label: 'London' },
    { lat: 35.6762, lng: 139.6503, label: 'Tokyo' },
    { lat: -33.8688, lng: 151.2093, label: 'Sydney' },
    { lat: 0, lng: 0, label: 'Null Island' },
    { lat: 90, lng: 0, label: 'North Pole' },
    { lat: -90, lng: 0, label: 'South Pole' }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Globe Debug Tool</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Globe Canvas */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Interactive Globe</h2>
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className="border border-gray-300 rounded cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          />
          <p className="text-sm text-gray-600">
            Click and drag to rotate the globe
          </p>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Point Controls</h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="lat">Latitude (-90 to 90)</Label>
                <Input
                  id="lat"
                  type="number"
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                  step="0.0001"
                  min="-90"
                  max="90"
                />
              </div>
              <div>
                <Label htmlFor="lng">Longitude (-180 to 180)</Label>
                <Input
                  id="lng"
                  type="number"
                  value={newLng}
                  onChange={(e) => setNewLng(e.target.value)}
                  step="0.0001"
                  min="-180"
                  max="180"
                />
              </div>
              <div>
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <Button onClick={updatePoint} className="w-full">
                Update Point
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Preset Locations</h3>
            <div className="grid grid-cols-1 gap-2">
              {presetLocations.map((location, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPoint(location);
                    setNewLat(location.lat.toString());
                    setNewLng(location.lng.toString());
                    setNewLabel(location.label);
                  }}
                  className="text-left justify-start"
                >
                  {location.label} ({location.lat}, {location.lng})
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Globe Controls</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => setRotation({ x: -point.lng, y: -point.lat })}
                className="w-full"
              >
                Center on Point
              </Button>
              <Button
                variant="outline"
                onClick={() => setRotation({ x: 0, y: 0 })}
                className="w-full"
              >
                Reset Rotation
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}