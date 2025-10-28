import { useRef, useEffect, useState } from 'react';
import { geoOrthographic, geoPath, geoGraticule } from 'd3-geo';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

// Simple world outline for debugging
const simpleWorld = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { name: 'North America' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-160, 70], [-50, 70], [-50, 10], [-160, 10], [-160, 70]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Europe' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-10, 35], [50, 35], [50, 75], [-10, 75], [-10, 35]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Africa' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-20, 40], [50, 40], [50, -35], [-20, -35], [-20, 40]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Asia' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [50, 80], [180, 80], [180, 5], [50, 5], [50, 80]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'Australia' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [110, -10], [160, -10], [160, -50], [110, -50], [110, -10]
        ]]
      }
    },
    {
      type: 'Feature' as const,
      properties: { name: 'South America' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          [-90, 15], [-30, 15], [-30, -60], [-90, -60], [-90, 15]
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