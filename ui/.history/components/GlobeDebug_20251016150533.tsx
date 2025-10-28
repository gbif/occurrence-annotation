import { useRef, useEffect, useState } from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

// Better resolution world outline for debugging
const simpleWorld = {
  type: 'FeatureCollection' as const,
  features: [
    // North America - more detailed shape
    {
      type: 'Feature' as const,
      properties: { name: 'North America' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-168, 65], [-140, 69], [-120, 70], [-100, 68], [-85, 65], [-75, 60], [-70, 50], [-65, 45],
          [-60, 47], [-55, 50], [-50, 52], [-45, 55], [-35, 60], [-25, 65], [-15, 70], [-10, 72],
          [-5, 75], [0, 78], [10, 80], [20, 78], [30, 75], [35, 72], [40, 68], [45, 65],
          [50, 62], [55, 58], [60, 55], [65, 52], [70, 48], [75, 45], [80, 40], [85, 35],
          [90, 30], [95, 25], [100, 20], [105, 15], [110, 10], [115, 5], [120, 0], [125, -5],
          [130, -10], [135, -15], [140, -20], [145, -25], [150, -30], [155, -35], [160, -40],
          [165, -45], [170, -50], [175, -55], [180, -60], [-175, -65], [-170, -60], [-165, -55],
          [-160, -50], [-155, -45], [-150, -40], [-145, -35], [-140, -30], [-135, -25], [-130, -20],
          [-125, -15], [-120, -10], [-115, -5], [-110, 0], [-105, 5], [-100, 10], [-95, 15],
          [-90, 20], [-85, 25], [-80, 30], [-75, 35], [-70, 40], [-68, 45], [-66, 50], [-65, 55],
          [-66, 60], [-68, 65], [-70, 68], [-75, 70], [-80, 72], [-90, 74], [-100, 75], [-110, 76],
          [-120, 77], [-130, 76], [-140, 75], [-150, 74], [-160, 72], [-165, 68], [-168, 65]
        ]]
      }
    },
    // Europe - more detailed shape
    {
      type: 'Feature' as const,
      properties: { name: 'Europe' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-25, 60], [-20, 65], [-15, 69], [-10, 71], [-5, 72], [0, 73], [5, 72], [10, 71],
          [15, 69], [20, 67], [25, 65], [30, 63], [35, 61], [40, 58], [42, 55], [43, 52],
          [42, 49], [40, 46], [38, 43], [35, 40], [32, 38], [28, 36], [24, 35], [20, 35],
          [16, 36], [12, 37], [8, 39], [4, 41], [0, 43], [-4, 45], [-8, 47], [-12, 49],
          [-16, 51], [-20, 53], [-22, 55], [-24, 57], [-25, 60]
        ]]
      }
    },
    // Africa - more detailed shape
    {
      type: 'Feature' as const,
      properties: { name: 'Africa' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-17, 37], [-15, 35], [-12, 33], [-8, 31], [-4, 29], [0, 27], [4, 25], [8, 23],
          [12, 21], [16, 19], [20, 17], [24, 15], [28, 13], [32, 11], [36, 9], [40, 7],
          [44, 5], [48, 3], [51, 1], [53, -1], [54, -3], [55, -5], [54, -7], [53, -9],
          [51, -11], [49, -13], [47, -15], [45, -17], [43, -19], [41, -21], [39, -23],
          [37, -25], [35, -27], [33, -29], [31, -31], [29, -33], [27, -34], [25, -35],
          [23, -34], [21, -33], [19, -32], [17, -31], [15, -30], [13, -29], [11, -28],
          [9, -27], [7, -26], [5, -25], [3, -24], [1, -23], [-1, -22], [-3, -21], [-5, -20],
          [-7, -19], [-9, -18], [-11, -17], [-13, -16], [-15, -15], [-16, -14], [-17, -13],
          [-18, -12], [-18, -11], [-17, -10], [-16, -9], [-15, -8], [-14, -7], [-13, -6],
          [-12, -5], [-11, -4], [-10, -3], [-9, -2], [-8, -1], [-7, 0], [-6, 1], [-5, 2],
          [-4, 3], [-3, 4], [-2, 5], [-1, 6], [0, 7], [1, 8], [2, 9], [3, 10], [4, 11],
          [5, 12], [6, 13], [7, 14], [8, 15], [9, 16], [10, 17], [11, 18], [12, 19],
          [13, 20], [14, 21], [15, 22], [16, 23], [17, 24], [18, 25], [19, 26], [20, 27],
          [21, 28], [22, 29], [23, 30], [24, 31], [25, 32], [26, 33], [27, 34], [28, 35],
          [29, 36], [30, 37], [25, 38], [20, 39], [15, 40], [10, 39], [5, 38], [0, 37],
          [-5, 36], [-10, 37], [-15, 37], [-17, 37]
        ]]
      }
    },
    // Asia - more detailed shape
    {
      type: 'Feature' as const,
      properties: { name: 'Asia' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [40, 40], [45, 42], [50, 44], [55, 46], [60, 48], [65, 50], [70, 52], [75, 54],
          [80, 56], [85, 58], [90, 60], [95, 62], [100, 64], [105, 66], [110, 68], [115, 70],
          [120, 72], [125, 74], [130, 76], [135, 78], [140, 79], [145, 80], [150, 79], [155, 78],
          [160, 77], [165, 75], [170, 73], [175, 71], [179, 68], [179, 65], [178, 62], [177, 59],
          [176, 56], [175, 53], [174, 50], [173, 47], [172, 44], [171, 41], [170, 38], [169, 35],
          [168, 32], [167, 29], [166, 26], [165, 23], [164, 20], [163, 17], [162, 14], [161, 11],
          [160, 8], [159, 5], [158, 2], [157, -1], [156, -4], [155, -7], [150, -5], [145, -3],
          [140, -1], [135, 1], [130, 3], [125, 5], [120, 7], [115, 9], [110, 11], [105, 13],
          [100, 15], [95, 17], [90, 19], [85, 21], [80, 23], [75, 25], [70, 27], [65, 29],
          [60, 31], [55, 33], [50, 35], [45, 37], [40, 40]
        ]]
      }
    },
    // Australia and New Zealand - more detailed
    {
      type: 'Feature' as const,
      properties: { name: 'Australia' },
      geometry: {
        type: 'MultiPolygon' as const,
        coordinates: [
          // Australia mainland
          [[
            [113, -10], [118, -12], [123, -14], [128, -16], [133, -18], [138, -20], [143, -22],
            [148, -24], [153, -26], [157, -28], [159, -30], [160, -32], [159, -34], [158, -36],
            [156, -38], [154, -40], [152, -42], [150, -43], [148, -44], [146, -43], [144, -42],
            [142, -41], [140, -40], [138, -39], [136, -38], [134, -37], [132, -36], [130, -35],
            [128, -34], [126, -33], [124, -32], [122, -31], [120, -30], [118, -29], [116, -28],
            [114, -27], [113, -26], [112, -25], [112, -24], [113, -23], [114, -22], [115, -21],
            [116, -20], [117, -19], [118, -18], [119, -17], [118, -16], [117, -15], [116, -14],
            [115, -13], [114, -12], [113, -11], [113, -10]
          ]],
          // New Zealand North Island
          [[
            [174, -34], [175, -35], [176, -36], [175, -37], [174, -38], [173, -39], [172, -38],
            [172, -37], [173, -36], [174, -35], [174, -34]
          ]],
          // New Zealand South Island
          [[
            [170, -41], [171, -42], [172, -43], [171, -44], [170, -45], [169, -46], [168, -45],
            [168, -44], [169, -43], [170, -42], [170, -41]
          ]]
        ]
      }
    },
    // South America - more detailed shape
    {
      type: 'Feature' as const,
      properties: { name: 'South America' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-81, 12], [-79, 10], [-77, 8], [-75, 6], [-73, 4], [-71, 2], [-69, 0], [-67, -2],
          [-65, -4], [-63, -6], [-61, -8], [-59, -10], [-57, -12], [-55, -14], [-53, -16],
          [-51, -18], [-49, -20], [-47, -22], [-45, -24], [-43, -26], [-41, -28], [-39, -30],
          [-37, -32], [-35, -34], [-34, -36], [-33, -38], [-33, -40], [-34, -42], [-35, -44],
          [-36, -46], [-37, -48], [-38, -50], [-39, -52], [-40, -54], [-42, -55], [-44, -56],
          [-46, -55], [-48, -54], [-50, -53], [-52, -52], [-54, -51], [-56, -50], [-58, -49],
          [-60, -48], [-62, -47], [-64, -46], [-66, -45], [-68, -44], [-70, -43], [-72, -42],
          [-74, -41], [-76, -40], [-78, -39], [-80, -38], [-82, -37], [-84, -36], [-86, -35],
          [-87, -34], [-88, -33], [-89, -32], [-90, -31], [-90, -30], [-89, -29], [-88, -28],
          [-87, -27], [-86, -26], [-85, -25], [-84, -24], [-83, -23], [-82, -22], [-81, -21],
          [-80, -20], [-79, -19], [-78, -18], [-77, -17], [-76, -16], [-75, -15], [-74, -14],
          [-73, -13], [-72, -12], [-71, -11], [-70, -10], [-69, -9], [-68, -8], [-67, -7],
          [-66, -6], [-65, -5], [-64, -4], [-63, -3], [-62, -2], [-61, -1], [-60, 0], [-59, 1],
          [-58, 2], [-57, 3], [-58, 4], [-59, 5], [-60, 6], [-61, 7], [-62, 8], [-63, 9],
          [-64, 10], [-65, 11], [-66, 12], [-67, 12], [-68, 12], [-69, 12], [-70, 12],
          [-71, 12], [-72, 12], [-73, 12], [-74, 12], [-75, 12], [-76, 12], [-77, 12],
          [-78, 12], [-79, 12], [-80, 12], [-81, 12]
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
    simpleWorld.features.forEach(feature => {
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