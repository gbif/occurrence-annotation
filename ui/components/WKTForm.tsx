import { useState, useEffect, useMemo } from 'react';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Copy, Check, RefreshCw, Repeat } from 'lucide-react';
import { Card } from './ui/card';
import { toast } from 'sonner';
import { parseWKTGeometry, PolygonWithHoles, MultiPolygon, isInvertedPolygon } from '../utils/wktParser';

interface WKTFormProps {
  currentPolygon: [number, number][] | null;
  onPolygonChange: (polygon: [number, number][] | null) => void;
  isInverted?: boolean;
  onInvertedChange?: (inverted: boolean) => void;

}

export function WKTForm({ 
  currentPolygon, 
  onPolygonChange, 
  isInverted = false, 
  onInvertedChange
}: WKTFormProps) {
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
      const parsed = parseWKTGeometry(wkt);
      if (!parsed) {
        throw new Error('Failed to parse WKT geometry');
      }

      // Handle MultiPolygon - return first polygon's outer ring
      if ('polygons' in parsed) {
        if (parsed.polygons.length === 0) {
          throw new Error('MultiPolygon has no polygons');
        }
        
        // Check if first polygon has holes
        if (parsed.polygons[0].holes.length > 0) {
          toast.warning('Polygon has interior holes', {
            description: 'Interior holes will be removed. Only the outer boundary will be used.',
            duration: 6000,
          });
        }
        
        return parsed.polygons[0].outer;
      }
      
      // Handle PolygonWithHoles (single polygon)
      if ('holes' in parsed) {
        // Check if it's actually an inverted polygon (outer ring covers world)
        const isOriginallyInverted = isInvertedPolygon(parsed);
        
        if (isOriginallyInverted) {
          // Inverted polygon - return first hole as editable region
          // (WKTForm only supports single polygons, not multipolygons)
          if (parsed.holes.length > 1) {
            toast.warning('Multiple exclusion areas detected', {
              description: 'Only the first exclusion area will be loaded. Use "Load Rule for Editing" to edit all areas.',
              duration: 8000,
            });
          }
          return parsed.holes[0];
        } else {
          // Normal polygon (not inverted)
          if (parsed.holes.length > 0) {
            toast.warning('Polygon has interior holes', {
              description: 'Interior holes will be removed. Only the outer boundary will be used.',
              duration: 6000,
            });
          }
          // Return outer ring
          return parsed.outer;
        }
      }
      
      throw new Error('Unexpected geometry type');
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
          <div className="flex gap-1">
            {currentPolygon && currentPolygon.length >= 3 && (
              <>
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
              </>
            )}
          </div>
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

