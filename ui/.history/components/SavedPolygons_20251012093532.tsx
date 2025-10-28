import { useState, useEffect, useRef } from 'react';
import { PolygonData } from '../App';
import { Button } from './ui/button';
import { Trash2, Repeat, Edit2, Upload, FileText, Loader2, Plus, Check, MessageSquare } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';
import { coordinatesToWKT } from '../utils/wktParser';

interface SavedPolygonsProps {
  polygons: PolygonData[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  editingPolygonId: string | null;
  onToggleInvert: (id: string) => void;
  onImportWKT?: (coordinates: [number, number][] | [number, number][][], isMulti?: boolean) => void;
  onUpdateAnnotation?: (id: string, annotation: string) => void;
  currentPolygon?: [number, number][] | null;
  isCurrentInverted?: boolean;
  onCurrentAnnotationChange?: (annotation: string) => void;
  currentAnnotation?: string;
  addToMultiPolygonId?: string | null;
  onAddToMultiPolygon?: (id: string | null) => void;
}

interface SaveToGBIFDialogProps {
  polygon: PolygonData;
  onSuccess: () => void;
  annotation: string;
}

interface ImportWKTDialogProps {
  onImport: (coordinates: [number, number][] | [number, number][][], isMulti?: boolean) => void;
}

function ImportWKTDialog({ onImport }: ImportWKTDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [wktInput, setWktInput] = useState('');

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

  const handleImport = () => {
    try {
      const coordinates = parseWKT(wktInput);
      if (coordinates) {
        onImport(coordinates);
        toast.success(`Polygon imported with ${coordinates.length} points`);
        setIsOpen(false);
        setWktInput('');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse WKT');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
        >
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          Import WKT
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Polygon from WKT</DialogTitle>
          <DialogDescription>
            Paste a WKT polygon string to add it to the map
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wkt-input">WKT String</Label>
            <Textarea
              id="wkt-input"
              value={wktInput}
              onChange={(e) => setWktInput(e.target.value)}
              placeholder="POLYGON((lon lat, lon lat, lon lat, lon lat))"
              className="font-mono text-sm resize-none"
              rows={8}
            />
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>Format:</strong> POLYGON((lon lat, lon lat, ...))</p>
            <p><strong>Example:</strong> POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))</p>
            <p className="text-gray-500">Note: Coordinates use longitude, latitude order in WKT format</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setWktInput('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={!wktInput.trim()}
              className="flex-1"
            >
              Import Polygon
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Small GBIF logo component
function GBIFLogoSmall() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C10.6868 2 9.38642 2.25866 8.17317 2.7612C6.95991 3.26375 5.85752 4.00035 4.92893 4.92893C3.05357 6.8043 2 9.34784 2 12C2 14.6522 3.05357 17.1957 4.92893 19.0711C5.85752 19.9997 6.95991 20.7362 8.17317 21.2388C9.38642 21.7413 10.6868 22 12 22C14.6522 22 17.1957 20.9464 19.0711 19.0711C20.9464 17.1957 22 14.6522 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7362 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2Z" fill="#4BA524"/>
      <path d="M12 6C11.4696 6 10.9609 6.21071 10.5858 6.58579C10.2107 6.96086 10 7.46957 10 8V12C10 12.5304 10.2107 13.0391 10.5858 13.4142C10.9609 13.7893 11.4696 14 12 14C12.5304 14 13.0391 13.7893 13.4142 13.4142C13.7893 13.0391 14 12.5304 14 12V8C14 7.46957 13.7893 6.96086 13.4142 6.58579C13.0391 6.21071 12.5304 6 12 6ZM9 16C9 15.7348 9.10536 15.4804 9.29289 15.2929C9.48043 15.1054 9.73478 15 10 15H14C14.2652 15 14.5196 15.1054 14.7071 15.2929C14.8946 15.4804 15 15.7348 15 16C15 16.2652 14.8946 16.5196 14.7071 16.7071C14.5196 16.8946 14.2652 17 14 17H10C9.73478 17 9.48043 16.8946 9.29289 16.7071C9.10536 16.5196 9 16.2652 9 16Z" fill="white"/>
    </svg>
  );
}

function SaveToGBIFDialog({ polygon, onSuccess, annotation }: SaveToGBIFDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Function to post pending comments to GBIF after rule creation
  const postPendingComments = async (ruleId: number, gbifAuth: string) => {
    try {
      const existingComments = JSON.parse(localStorage.getItem('polygonComments') || '[]');
      const pendingComments = existingComments.filter(
        (comment: any) => comment.polygonId === polygon.id && comment.status === 'pending'
      );

      if (pendingComments.length === 0) {
        return;
      }

      let successfulComments = 0;
      
      for (const comment of pendingComments) {
        try {
          const response = await fetch(
            `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/comment`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${gbifAuth}`,
              },
              body: JSON.stringify({ comment: comment.comment }),
            }
          );

          if (response.ok) {
            // Mark comment as successfully posted
            comment.status = 'saved';
            comment.ruleId = ruleId;
            successfulComments++;
          } else {
            console.warn(`Failed to post comment: ${response.statusText}`);
            // Keep comment as pending so user can try again later
          }
        } catch (err) {
          console.warn('Error posting individual comment:', err);
          // Keep comment as pending so user can try again later
        }
      }

      // Update localStorage with new comment statuses
      localStorage.setItem('polygonComments', JSON.stringify(existingComments));
      
      if (successfulComments > 0) {
        toast.success(`Rule saved! ${successfulComments} comment(s) also posted to GBIF.`);
      } else if (pendingComments.length > 0) {
        toast.success('Rule saved! Comments remain pending (login required to post to GBIF).');
      } else {
        toast.success('Annotation rule saved to GBIF successfully!');
      }
    } catch (err) {
      console.warn('Error processing pending comments:', err);
      toast.success('Annotation rule saved to GBIF successfully!');
    }
  };
  const [occurrenceCount, setOccurrenceCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Fetch occurrence count when dialog opens
  useEffect(() => {
    const fetchOccurrenceCount = async () => {
      if (!isOpen || !polygon.species) {
        setOccurrenceCount(null);
        return;
      }

      setLoadingCount(true);
      try {
        // Convert coordinates to WKT
        const wktGeometry = coordinatesToWKT(polygon.coordinates);
        
        // Build the GBIF occurrence search URL
        const params = new URLSearchParams({
          taxonKey: polygon.species.key.toString(),
          geometry: wktGeometry,
          limit: '0', // We only want the count
        });

        const response = await fetch(
          `https://api.gbif.org/v1/occurrence/search?${params.toString()}`,
          {
            mode: 'cors',
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          // Silently fail - occurrence count is optional information
          setOccurrenceCount(null);
          setLoadingCount(false);
          return;
        }

        const data = await response.json();
        setOccurrenceCount(data.count || 0);
      } catch (error) {
        // Silently fail - just set count to null without logging errors
        // This is expected to fail sometimes due to CORS or network issues
        setOccurrenceCount(null);
      } finally {
        setLoadingCount(false);
      }
    };

    fetchOccurrenceCount();
  }, [isOpen, polygon.species, polygon.coordinates]);

  const handleSave = async () => {
    console.log('SaveToGBIF: handleSave called');
    
    // Check if user is logged in
    const gbifAuth = localStorage.getItem('gbifAuth');
    const gbifUser = localStorage.getItem('gbifUser');
    
    if (!gbifAuth || !gbifUser) {
      console.log('SaveToGBIF: No GBIF auth found');
      toast.error('⚠️ Please login to GBIF first to save annotation rules', {
        description: 'You need to be authenticated with GBIF to save annotation rules to the database.'
      });
      return;
    }

    if (!polygon.species) {
      console.log('SaveToGBIF: No species selected');
      toast.error('⚠️ Please select a species first', {
        description: 'You must assign a species to this polygon before saving it as an annotation rule.'
      });
      return;
    }

    console.log('SaveToGBIF: Starting save process for polygon:', polygon.id);
    setIsLoading(true);

    try {
      // Convert coordinates to WKT
      const wktGeometry = coordinatesToWKT(polygon.coordinates);
      
      // Prepare the payload
      const payload = {
        projectId: null,
        rulesetId: null,
        taxonKey: polygon.species.key,
        geometry: wktGeometry,
        annotation: annotation,
      };

      // console.log('Saving to GBIF:', payload);

      // Make the API request
      const response = await fetch(
        'https://api.gbif.org/v1/occurrence/experimental/annotation/rule',
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${gbifAuth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GBIF API error:', errorText);
        
        if (response.status === 401) {
          toast.error('Authentication failed. Please login again.');
          localStorage.removeItem('gbifAuth');
          localStorage.removeItem('gbifUser');
        } else if (response.status === 403) {
          toast.error('Access denied. Check your permissions for this project.');
        } else {
          toast.error(`Failed to save rule: ${response.statusText}`);
        }
        return;
      }

      const result = await response.json();
      console.log('Rule saved successfully:', result);
      
      // Post any pending comments for this polygon
      if (result && result.id) {
        console.log('Attempting to post pending comments for rule ID:', result.id);
        await postPendingComments(result.id, gbifAuth);
      } else {
        console.log('No rule ID in response, posting basic success message');
        toast.success('Annotation rule saved to GBIF successfully!');
      }
      
      setIsOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving to GBIF:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getLoginStatus = () => {
    const gbifAuth = localStorage.getItem('gbifAuth');
    const gbifUser = localStorage.getItem('gbifUser');
    return !!(gbifAuth && gbifUser);
  };

  const getButtonTooltip = () => {
    const isLoggedIn = getLoginStatus();
    if (!isLoggedIn && !polygon.species) {
      return "Login to GBIF and select a species first";
    } else if (!isLoggedIn) {
      return "Login to GBIF first";
    } else if (!polygon.species) {
      return "Select a species first";
    }
    return "Save to GBIF";
  };

  const isButtonDisabled = !polygon.species || !getLoginStatus();
  
  // Debug logging
  console.log('SaveToGBIF button state:', {
    hasSpecies: !!polygon.species,
    isLoggedIn: getLoginStatus(),
    isDisabled: isButtonDisabled,
    tooltip: getButtonTooltip()
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div
          onClick={(e) => {
            if (isButtonDisabled) {
              e.preventDefault();
              e.stopPropagation();
              // Show warning toast when disabled button is clicked
              if (!getLoginStatus() && !polygon.species) {
                toast.error('⚠️ Please login to GBIF and select a species first', {
                  description: 'Both authentication and species selection are required to save annotation rules.'
                });
              } else if (!getLoginStatus()) {
                toast.error('⚠️ Please login to GBIF first', {
                  description: 'You need to be authenticated with GBIF to save annotation rules.'
                });
              } else if (!polygon.species) {
                toast.error('⚠️ Please select a species first', {
                  description: 'You must assign a species to this polygon before saving it as an annotation rule.'
                });
              }
            }
          }}
        >
          <Button
            size="icon"
            variant="outline"
            className={`h-9 w-9 ${isButtonDisabled 
              ? 'border-gray-300 text-gray-400 cursor-not-allowed' 
              : 'border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400'
            }`}
            disabled={isButtonDisabled}
            title={getButtonTooltip()}
          >
            <Upload className="w-4 h-4" />
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Rule to GBIF</DialogTitle>
          <DialogDescription>
            Confirm saving this {annotation} annotation rule to GBIF
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Warning Messages */}
          {(!getLoginStatus() || !polygon.species) && (
            <div className="p-3 bg-white border border-red-200 rounded-lg shadow-sm">
              <div className="flex items-start gap-2">
                <div className="text-red-600 text-sm">⚠️</div>
                <div className="text-sm text-red-700">
                  <p className="font-medium">Cannot save to GBIF:</p>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    {!getLoginStatus() && <li>You are not logged into GBIF</li>}
                    {!polygon.species && <li>No species selected for this polygon</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Species Info */}
          {polygon.species && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Species</p>
              <p className="font-medium">{polygon.species.name}</p>
              <p className="text-sm text-gray-600 italic">{polygon.species.scientificName}</p>
              <p className="text-xs text-gray-500 mt-1">Taxon Key: {polygon.species.key}</p>
            </div>
          )}



          {/* Polygon info */}
          <div className="text-sm text-gray-600 space-y-1">
            <p>Geometry: {polygon.coordinates.length} vertices</p>
            {polygon.inverted && (
              <p className="text-amber-600">⚠️ This polygon is inverted (excludes the area inside)</p>
            )}
            {polygon.species && (
              <p className="flex items-center gap-2">
                {loadingCount ? (
                  <>
                    <span>Occurrences affected:</span>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-gray-500">Calculating...</span>
                  </>
                ) : occurrenceCount !== null ? (
                  <>
                    <span>Occurrences affected:</span>
                    <span className="text-gray-900">{occurrenceCount.toLocaleString()}</span>
                  </>
                ) : (
                  <>
                    <span>Occurrences affected:</span>
                    <span className="text-gray-500">Unable to calculate</span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading || !getLoginStatus() || !polygon.species}
              className="flex-1"
            >
              {isLoading ? 'Saving...' : 'Save to GBIF'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PolygonPreview({ coordinates, annotation = 'SUSPICIOUS', isMultiPolygon = false }: { coordinates: [number, number][] | [number, number][][], annotation?: string, isMultiPolygon?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    console.log('🖼️ POLYGON PREVIEW RENDERING (Canvas):', {
      annotation,
      isMultiPolygon,
      polygonCount: isMultiPolygon ? (coordinates as [number, number][][]).length : 1
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Normalize coordinates to array of polygons
    const polygons: [number, number][][] = isMultiPolygon 
      ? (coordinates as [number, number][][])
      : [coordinates as [number, number][]];
    
    if (polygons.length === 0 || polygons[0].length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find bounds across all polygons
    const allCoords = polygons.flat();
    const lats = allCoords.map(c => c[0]);
    const lngs = allCoords.map(c => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;

    // Add padding
    const padding = 4;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    // Scale to fit canvas
    const scale = Math.min(width / lngRange, height / latRange);

    // Draw all polygons
    polygons.forEach(polyCoords => {
      ctx.beginPath();
      polyCoords.forEach((coord, i) => {
        const x = padding + (coord[1] - minLng) * scale;
        const y = padding + (maxLat - coord[0]) * scale; // Flip Y axis
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();

    // Get color based on annotation type
    const annotationColors: { [key: string]: { fill: string; fillRgba: string; stroke: string; strokeRgba: string } } = {
      SUSPICIOUS: { fill: '#ef4444', fillRgba: 'rgba(239, 68, 68, 0.1)', stroke: '#dc2626', strokeRgba: 'rgba(220, 38, 38, 0.6)' },
      NATIVE: { fill: '#10b981', fillRgba: 'rgba(16, 185, 129, 0.1)', stroke: '#059669', strokeRgba: 'rgba(5, 150, 105, 0.6)' },
      MANAGED: { fill: '#3b82f6', fillRgba: 'rgba(59, 130, 246, 0.1)', stroke: '#2563eb', strokeRgba: 'rgba(37, 99, 235, 0.6)' },
      FORMER: { fill: '#a855f7', fillRgba: 'rgba(168, 85, 247, 0.1)', stroke: '#9333ea', strokeRgba: 'rgba(147, 51, 234, 0.6)' },
      VAGRANT: { fill: '#f97316', fillRgba: 'rgba(249, 115, 22, 0.1)', stroke: '#ea580c', strokeRgba: 'rgba(234, 88, 12, 0.6)' },
    };
    const color = annotationColors[annotation.toUpperCase()] || annotationColors.SUSPICIOUS;

      // Fill and stroke each polygon
      ctx.fillStyle = color.fillRgba;
      ctx.fill();
      ctx.strokeStyle = color.strokeRgba;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw points for each polygon
      ctx.fillStyle = color.strokeRgba;
      polyCoords.forEach((coord) => {
        const x = padding + (coord[1] - minLng) * scale;
        const y = padding + (maxLat - coord[0]) * scale;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }, [coordinates, annotation, isMultiPolygon]);

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={80}
      className="border border-gray-200 rounded bg-white"
    />
  );
}

function PolygonCard({ 
  polygon, 
  isEditing, 
  onDelete, 
  onEdit, 
  onToggleInvert,
  onUpdateAnnotation,
  isAddingTo,
  onAddToMultiPolygon
}: { 
  polygon: PolygonData; 
  isEditing: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onToggleInvert: (id: string) => void;
  onUpdateAnnotation?: (id: string, annotation: string) => void;
  isAddingTo?: boolean;
  onAddToMultiPolygon?: (id: string | null) => void;
}) {
  const [annotation, setAnnotation] = useState<string>(polygon.annotation || 'SUSPICIOUS');
  
  // Comment functionality state
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Sync local state with prop changes
  useEffect(() => {
    if (polygon.annotation && polygon.annotation !== annotation) {
      setAnnotation(polygon.annotation);
    }
  }, [polygon.annotation]);

  // Update annotation when it changes
  useEffect(() => {
    if (onUpdateAnnotation && annotation !== polygon.annotation) {
      onUpdateAnnotation(polygon.id, annotation);
    }
  }, [annotation, polygon.id, polygon.annotation, onUpdateAnnotation]);

  // Handle adding comments to polygons
  const handleAddComment = async () => {
    console.log('handleAddComment called');
    
    if (!newComment.trim()) {
      console.log('Comment is empty');
      toast.error('Comment cannot be empty');
      return;
    }

    // Check if localStorage is available
    if (typeof Storage === 'undefined') {
      console.error('localStorage is not available');
      toast.error('Local storage is not available in your browser');
      return;
    }

    setSubmittingComment(true);
    
    try {
      // For local storage, we don't need to be logged in
      // We'll get the username when the rule is saved to GBIF
      let userName = 'Anonymous';
      
      // Try to get username if logged in, but don't require it
      try {
        const gbifAuthStr = localStorage.getItem('gbifAuth');
        if (gbifAuthStr) {
          const gbifAuth = JSON.parse(gbifAuthStr);
          if (gbifAuth.userName) {
            userName = gbifAuth.userName;
          }
        }
      } catch (authErr) {
        console.log('No valid auth found, using anonymous user');
      }

      console.log('Using username:', userName);

      // Store comment locally as "pending" until polygon is saved as a rule to GBIF
      const comment = {
        polygonId: polygon.id,
        comment: newComment.trim(),
        timestamp: new Date().toISOString(),
        user: userName,
        status: 'pending' // Will be 'saved' once the rule is created and comment posted to GBIF
      };
      
      console.log('Comment object created:', comment);
      
      // Get existing comments safely
      let existingComments = [];
      try {
        const commentsStr = localStorage.getItem('polygonComments');
        if (commentsStr) {
          existingComments = JSON.parse(commentsStr);
        }
      } catch (parseErr) {
        console.warn('Error parsing existing comments, starting fresh:', parseErr);
        existingComments = [];
      }
      
      console.log('Existing comments:', existingComments.length);
      
      existingComments.push(comment);
      
      try {
        localStorage.setItem('polygonComments', JSON.stringify(existingComments));
      } catch (storageErr) {
        console.error('Error saving to localStorage:', storageErr);
        throw new Error('Failed to save comment to local storage');
      }
      
      console.log('Comment saved to localStorage successfully');

      toast.success('Comment saved locally. Will be posted to GBIF when rule is saved.');
      
      // Clear the comment input and close dialog
      setNewComment('');
      setCommentDialogOpen(false);
      
    } catch (err) {
      console.error('Error adding comment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to add comment: ${errorMessage}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Get comment count for a polygon
  const getCommentCount = (): number => {
    try {
      const existingComments = JSON.parse(localStorage.getItem('polygonComments') || '[]');
      return existingComments.filter((comment: any) => comment.polygonId === polygon.id).length;
    } catch {
      return 0;
    }
  };

  // Get pending comment count
  const getPendingCommentCount = (): number => {
    try {
      const existingComments = JSON.parse(localStorage.getItem('polygonComments') || '[]');
      return existingComments.filter(
        (comment: any) => comment.polygonId === polygon.id && comment.status === 'pending'
      ).length;
    } catch {
      return 0;
    }
  };

  const polygonCount = polygon.isMultiPolygon 
    ? (polygon.coordinates as [number, number][][]).length 
    : 1;
  const totalVertices = polygon.isMultiPolygon
    ? (polygon.coordinates as [number, number][][]).reduce((sum, poly) => sum + poly.length, 0)
    : (polygon.coordinates as [number, number][]).length;

  return (
    <Card className={`p-4 ${isEditing ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${isAddingTo ? 'ring-2 ring-green-500 bg-green-50' : ''}`}>
      <div className="space-y-3">
        {/* Top section */}
        <div className="flex items-start gap-3">
          {/* Polygon Preview */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <PolygonPreview coordinates={polygon.coordinates} annotation={annotation} isMultiPolygon={polygon.isMultiPolygon} />
            <p className="text-gray-400 text-xs">
              {polygon.isMultiPolygon && <span className="font-medium">Multi: {polygonCount} • </span>}
              {totalVertices} pts
            </p>
          </div>

          {/* Editing Badge and content */}
          <div className="flex-1 min-w-0 flex items-start pt-1">
            {isEditing && (
              <Badge variant="secondary" className="text-xs">
                Editing
              </Badge>
            )}
          </div>

          {/* Delete button */}
          <div className="flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => onDelete(polygon.id)}
                  disabled={isEditing}
                  className="h-9 w-9 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete polygon</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Annotation Type Selector */}
        <div className="space-y-1">
          <Label htmlFor={`annotation-${polygon.id}`} className="text-xs text-gray-600">
            Annotation Type
          </Label>
          <Select value={annotation} onValueChange={setAnnotation}>
            <SelectTrigger id={`annotation-${polygon.id}`} className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SUSPICIOUS">SUSPICIOUS</SelectItem>
              <SelectItem value="MANAGED">MANAGED</SelectItem>
              <SelectItem value="FORMER">FORMER</SelectItem>
              <SelectItem value="VAGRANT">VAGRANT</SelectItem>
              <SelectItem value="NATIVE">NATIVE</SelectItem>
            </SelectContent>
          </Select>
          {annotation !== 'SUSPICIOUS' && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Non-SUSPICIOUS annotations require expert knowledge
            </p>
          )}
        </div>

        {/* Date and Time */}
        <div>
          <p className="text-gray-500 text-xs">
            {new Date(polygon.timestamp).toLocaleDateString()} {new Date(polygon.timestamp).toLocaleTimeString()}
          </p>
        </div>

        {/* Action Buttons - Bottom Row */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
          {onAddToMultiPolygon && (
            <Button
              size="icon"
              variant={isAddingTo ? "default" : "outline"}
              onClick={() => onAddToMultiPolygon(isAddingTo ? null : polygon.id)}
              className={`h-9 w-9 ${isAddingTo ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
            >
              {isAddingTo ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setCommentDialogOpen(true)}
                  className={`h-9 w-9 ${
                    getPendingCommentCount() > 0 
                      ? 'border-amber-300 text-amber-600 hover:bg-amber-50' 
                      : getCommentCount() > 0 
                        ? 'border-blue-300 text-blue-600 hover:bg-blue-50' 
                        : ''
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add comment{getCommentCount() > 0 ? ` (${getPendingCommentCount()} pending)` : ''}</p>
                {getPendingCommentCount() > 0 && (
                  <p className="text-xs text-amber-500">Comments will post to GBIF when rule is saved</p>
                )}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={isEditing ? "default" : "outline"}
                  onClick={() => onEdit(polygon.id)}
                  className="h-9 w-9"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isEditing ? "Done editing" : "Edit polygon"}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => onToggleInvert(polygon.id)}
                  disabled={isEditing}
                  className={`h-9 w-9 ${polygon.inverted ? 'border-purple-300 text-purple-700 hover:bg-purple-50' : ''}`}
                >
                  <Repeat className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Invert polygon (select everything outside)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SaveToGBIFDialog 
                    polygon={polygon}
                    annotation={annotation}
                    onSuccess={() => {
                      // Could refresh annotation rules here if needed
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save to GBIF</p>
              </TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => onDelete(polygon.id)}
                  disabled={isEditing}
                  className="h-9 w-9 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete polygon</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Pending Comment</DialogTitle>
            <DialogDescription>
              Add a comment that will be stored locally and automatically posted to GBIF when this polygon is saved as an annotation rule (GBIF login required for posting).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {getPendingCommentCount() > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  {getPendingCommentCount()} pending comment(s):
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {JSON.parse(localStorage.getItem('polygonComments') || '[]')
                    .filter((comment: any) => comment.polygonId === polygon.id && comment.status === 'pending')
                    .map((comment: any, index: number) => (
                      <p key={index} className="text-xs text-amber-700 bg-white px-2 py-1 rounded">
                        "{comment.comment}" - {comment.user}
                      </p>
                    ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Enter your comment here..."
                className="resize-none"
                rows={4}
              />
              <p className="text-xs text-amber-600">
                💡 Comments are saved locally and don't require login. They'll be posted to GBIF when you save the rule (login required).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCommentDialogOpen(false)}
              disabled={submittingComment}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddComment}
              disabled={!newComment.trim() || submittingComment}
            >
              {submittingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function SavedPolygons({ 
  polygons, 
  onDelete, 
  onEdit, 
  editingPolygonId, 
  onToggleInvert, 
  onImportWKT, 
  onUpdateAnnotation,
  currentPolygon = null,
  isCurrentInverted = false,
  onCurrentAnnotationChange,
  currentAnnotation = 'SUSPICIOUS',
  addToMultiPolygonId = null,
  onAddToMultiPolygon,
}: SavedPolygonsProps) {
  if (polygons.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-700">Active Rules (0)</h3>
          {onImportWKT && <ImportWKTDialog onImport={onImportWKT} />}
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">No active rules yet</p>
          <p className="text-gray-400 text-sm mt-1">Draw a polygon on the map or import WKT</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-gray-700">Active Rules ({polygons.length})</h3>
        {onImportWKT && <ImportWKTDialog onImport={onImportWKT} />}
      </div>
      {polygons.map((polygon) => (
        <PolygonCard
          key={polygon.id}
          polygon={polygon}
          isEditing={editingPolygonId === polygon.id}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggleInvert={onToggleInvert}
          onUpdateAnnotation={onUpdateAnnotation}
          isAddingTo={addToMultiPolygonId === polygon.id}
          onAddToMultiPolygon={onAddToMultiPolygon}
        />
      ))}
    </div>
  );
}

