import { useState, useEffect, useMemo } from 'react';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Copy, Check, RefreshCw, Repeat } from 'lucide-react';
import { Card } from './ui/card';
import { toast } from 'sonner';

interface WKTFormProps {
  currentPolygon: [number, number][] | null;
  onPolygonChange: (polygon: [number, number][] | null) => void;
  isInverted?: boolean;
  onInvertedChange?: (inverted: boolean) => void;
}

export function WKTForm({ currentPolygon, onPolygonChange, isInverted = false, onInvertedChange }: WKTFormProps) {
  const [copied, setCopied] = useState(false);
  const [wktInput, setWktInput] = useState('');

  // Convert polygon coordinates to WKT format - memoized
  const wktString = useMemo(() => {
    if (!currentPolygon || currentPolygon.length < 3) {
      return '';
    }

    // WKT uses lon/lat order (not lat/lon)
    // Also, polygons must be closed (first point = last point)
    const coordinates = currentPolygon.map(([lat, lng]) => `${lng} ${lat}`);
    
    // Close the polygon by adding the first point at the end if not already closed
    const firstPoint = currentPolygon[0];
    const lastPoint = currentPolygon[currentPolygon.length - 1];
    const isClosed = firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1];
    
    if (!isClosed) {
      coordinates.push(`${firstPoint[1]} ${firstPoint[0]}`);
    }

    // If inverted, create a polygon with a hole
    if (isInverted) {
      // Outer ring: world boundary
      const worldRing = '-180 -90, 180 -90, 180 90, -180 90, -180 -90';
      return `POLYGON((${worldRing}), (${coordinates.join(', ')}))`;
    }

    return `POLYGON((${coordinates.join(', ')}))`;
  }, [currentPolygon, isInverted]);

  // Parse WKT string to polygon coordinates
  const parseWKT = (wkt: string): [number, number][] | null => {
    try {
      // Remove extra whitespace and normalize
      const normalized = wkt.trim().toUpperCase();
      
      // Match POLYGON pattern
      const polygonMatch = normalized.match(/POLYGON\s*\(\s*\((.*?)\)\s*\)/);
      if (!polygonMatch) {
        throw new Error('Invalid WKT format. Expected: POLYGON((lon lat, lon lat, ...))');
      }

      const coordsString = polygonMatch[1];
      const coordPairs = coordsString.split(',').map(pair => pair.trim());
      
      const coordinates: [number, number][] = [];
      for (const pair of coordPairs) {
        const [lonStr, latStr] = pair.split(/\s+/);
        const lon = parseFloat(lonStr);
        const lat = parseFloat(latStr);
        
        if (isNaN(lon) || isNaN(lat)) {
          throw new Error('Invalid coordinate values');
        }
        
        // Validate coordinate ranges
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          throw new Error('Coordinates out of valid range (lat: -90 to 90, lon: -180 to 180)');
        }
        
        coordinates.push([lat, lon]); // Convert back to [lat, lng] for our internal format
      }
      
      if (coordinates.length < 3) {
        throw new Error('Polygon must have at least 3 points');
      }
      
      // Remove the last point if it's a duplicate of the first (closing point)
      if (coordinates.length > 3) {
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) {
          coordinates.pop();
        }
      }
      
      return coordinates;
    } catch (error) {
      throw error;
    }
  };

  // Update wktInput when wktString changes
  useEffect(() => {
    setWktInput(wktString);
  }, [wktString]);

  const handleCopy = async () => {
    if (wktString) {
      try {
        await navigator.clipboard.writeText(wktString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('WKT copied to clipboard');
      } catch (error) {
        console.error('Failed to copy:', error);
        toast.error('Failed to copy to clipboard');
      }
    }
  };

  const handleApplyWKT = () => {
    try {
      const polygon = parseWKT(wktInput);
      if (polygon) {
        onPolygonChange(polygon);
        toast.success('Polygon updated from WKT');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse WKT');
    }
  };

  const handleInvert = () => {
    if (onInvertedChange) {
      onInvertedChange(!isInverted);
      toast.success(isInverted ? 'Polygon normal' : 'Polygon inverted');
    }
  };

  const isModified = wktInput !== wktString;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Polygon (WKT)</Label>
          {currentPolygon && currentPolygon.length >= 3 && (
            <div className="flex gap-1">
              <Button
                onClick={handleInvert}
                variant={isInverted ? 'default' : 'outline'}
                size="sm"
                className="h-7"
                title="Invert polygon (make it a hole in the world)"
              >
                <Repeat className="w-3 h-3 mr-1" />
                Invert
              </Button>
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="h-7"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        
        <Textarea
          value={wktInput}
          onChange={(e) => setWktInput(e.target.value)}
          placeholder="Paste WKT here: POLYGON((lon lat, lon lat, ...))"
          className="font-mono text-sm resize-none"
          rows={6}
        />
        
        {isModified && (
          <Button
            onClick={handleApplyWKT}
            variant="default"
            size="sm"
            className="w-full"
          >
            <RefreshCw className="w-3 h-3 mr-2" />
            Apply WKT to Map
          </Button>
        )}
        
        <div className="text-xs text-gray-600 space-y-1">
          {currentPolygon && currentPolygon.length >= 3 && (
            <div className="flex items-center justify-between">
              <p>Points: {currentPolygon.length}</p>
              {isInverted && (
                <p className="text-blue-600">Inverted (with hole)</p>
              )}
            </div>
          )}
          <p className="text-gray-500">
            Paste WKT to update the polygon or draw on the map to generate WKT
          </p>
        </div>
      </div>
    </Card>
  );
}

