import { useState, useRef, useEffect } from 'react';
import { Map, Overlay } from 'pigeon-maps';
import { PolygonData } from '../App';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { Trash2, Square, Check, X, Edit2, Search, Plus, Minus, ExternalLink, Loader2, MapPin, Calendar, User, Database, Eye } from 'lucide-react';
import { AnnotationRule } from './AnnotationRules';
import { toast } from 'sonner';

interface MapComponentProps {
  selectedSpecies: {
    name: string;
    scientificName: string;
    key: number;
  } | null;
  savedPolygons: PolygonData[];
  currentPolygon: [number, number][] | null;
  isCurrentInverted?: boolean;
  currentAnnotation?: string;
  onPolygonChange: (coords: [number, number][] | null) => void;
  annotationRules?: AnnotationRule[];
  showAnnotationRules?: boolean;
  editingPolygonId?: string | null;
  onUpdatePolygon?: (id: string, coordinates: [number, number][] | [number, number][][]) => void;
  onStopEditing?: () => void;
  onSaveAndEdit: () => void;
  onAutoSave?: (coords: [number, number][]) => void;
  onNavigateToLocation?: (lat: number, lng: number, zoom?: number) => void;

}

// Tile conversion helpers for Web Mercator (EPSG:3857)
function latLngToTileWebMercator(lat: number, lng: number, zoom: number): [number, number] {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
  return [x, y];
}

function tileToLatLngWebMercator(x: number, y: number, zoom: number): [number, number] {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  const lng = x / Math.pow(2, zoom) * 360 - 180;
  return [lat, lng];
}

// GBIF base map tile provider - Web Mercator (EPSG:3857)
const gbifTileProvider = (x: number, y: number, z: number) => {
  const url = `https://tile.gbif.org/3857/omt/${z}/${x}/${y}@2x.png?style=gbif-geyser-en`;
  return url;
};

export function MapComponent({
  selectedSpecies,
  savedPolygons,
  currentPolygon,
  isCurrentInverted = false,
  currentAnnotation = 'SUSPICIOUS',
  onPolygonChange,
  annotationRules = [],
  showAnnotationRules = true,
  editingPolygonId = null,
  onUpdatePolygon,
  onSaveAndEdit,
  onAutoSave,
  onNavigateToLocation,
}: MapComponentProps) {
  const [center, setCenter] = useState<[number, number]>([20, 0]);
  const [zoom, setZoom] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState<'polygon' | 'rectangle'>('polygon');
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [gbifTiles, setGbifTiles] = useState<Array<{ x: number; y: number; z: number; anchor: [number, number]; url: string }>>([]);
  const [isZooming, setIsZooming] = useState(false);
  const [draggingVertex, setDraggingVertex] = useState<{ polygonId: string; index: number } | null>(null);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [dragCurrent, setDragCurrent] = useState<[number, number] | null>(null);
  const [isEditingCurrent, setIsEditingCurrent] = useState(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  
  // Investigate mode state
  const [isInvestigateMode, setIsInvestigateMode] = useState(false);
  const [investigateRadius, setInvestigateRadius] = useState(20000); // Default 20km radius
  const [isInvestigateLoading, setIsInvestigateLoading] = useState(false);
  const [investigateResults, setInvestigateResults] = useState<any[]>([]);
  const [isInvestigateDialogOpen, setIsInvestigateDialogOpen] = useState(false);
  const [investigationPoint, setInvestigationPoint] = useState<{ lat: number; lng: number } | null>(null);
  
  // Frozen map state for stable polygon rendering during interactions
  const [frozenMapState, setFrozenMapState] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const zoomTimeoutRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Debug logging for current annotation
  useEffect(() => {
    if (currentPolygon && currentPolygon.length > 0) {
      const annotationColors: { [key: string]: { fill: string; stroke: string } } = {
        SUSPICIOUS: { fill: '#ef4444', stroke: '#dc2626' },
        NATIVE: { fill: '#10b981', stroke: '#059669' },
        MANAGED: { fill: '#3b82f6', stroke: '#2563eb' },
        FORMER: { fill: '#a855f7', stroke: '#9333ea' },
        VAGRANT: { fill: '#f97316', stroke: '#ea580c' },
      };
      const color = annotationColors[currentAnnotation.toUpperCase()] || annotationColors.SUSPICIOUS;
      console.log('🎨 ACTIVE POLYGON DEBUG:', {
        annotationType: currentAnnotation,
        fillColor: color.fill,
        strokeColor: color.stroke,
        isInverted: isCurrentInverted,
        polygonPoints: currentPolygon.length
      });
    }
  }, [currentPolygon, currentAnnotation, isCurrentInverted]);

  useEffect(() => {
    if (mapContainerRef.current) {
      const updateSize = () => {
        if (mapContainerRef.current) {
          setMapSize({
            width: mapContainerRef.current.offsetWidth,
            height: mapContainerRef.current.offsetHeight,
          });
        }
      };
      
      // Listen for wheel events to detect zoom before it happens
      const handleWheel = () => {
        // Only clear tiles on more significant zoom changes to reduce flicker
        setIsZooming(true);
        
        // Clear any existing timeout
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
        
        // Set timeout to end zooming state - reduced for snappier response
        zoomTimeoutRef.current = window.setTimeout(() => {
          setIsZooming(false);
        }, 150);
      };
      
      updateSize();
      window.addEventListener('resize', updateSize);
      mapContainerRef.current.addEventListener('wheel', handleWheel);
      
      const currentRef = mapContainerRef.current;
      
      return () => {
        window.removeEventListener('resize', updateSize);
        if (currentRef) {
          currentRef.removeEventListener('wheel', handleWheel);
        }
        // Cleanup zoom timeout on unmount
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
      };
    }
  }, []);

  // Update GBIF tiles when map moves or species changes
  useEffect(() => {
    if (!selectedSpecies || mapSize.width === 0 || isZooming) {
      if (isZooming) {
        setGbifTiles([]);
      }
      if (!selectedSpecies || mapSize.width === 0) {
        setGbifTiles([]);
        if (!selectedSpecies) {
          console.log('🧹 SPECIES CLEARED - GBIF tiles removed');
        }
      }
      return;
    }

    console.log('🐾 SPECIES LOADED:', {
      name: selectedSpecies.name,
      scientificName: selectedSpecies.scientificName,
      key: selectedSpecies.key,
      status: '⏳ Loading GBIF occurrence tiles...'
    });

    const tileZoom = Math.max(0, Math.min(14, Math.floor(zoom)));
    const [centerX, centerY] = latLngToTileWebMercator(center[0], center[1], tileZoom);
    
    // Limit the number of tiles to prevent performance issues
    const tilesX = Math.min(6, Math.ceil(mapSize.width / 256) + 1);
    const tilesY = Math.min(6, Math.ceil(mapSize.height / 256) + 1);
    
    const newTiles = [];
    for (let dx = -Math.floor(tilesX / 2); dx <= Math.ceil(tilesX / 2); dx++) {
      for (let dy = -Math.floor(tilesY / 2); dy <= Math.ceil(tilesY / 2); dy++) {
        const x = centerX + dx;
        const y = centerY + dy;
        const maxTile = Math.pow(2, tileZoom);
        
        if (x >= 0 && x < maxTile && y >= 0 && y < maxTile) {
          // Get the northwest corner of the tile as anchor point
          const anchor = tileToLatLngWebMercator(x, y, tileZoom);
          const url = `https://api.gbif.org/v2/map/occurrence/adhoc/${tileZoom}/${x}/${y}@2x.png?srs=EPSG:3857&style=scaled.circles&mode=GEO_CENTROID&taxonKey=${selectedSpecies.key}&hasGeospatialIssue=false`;
          
          newTiles.push({ x, y, z: tileZoom, anchor, url });
        }
      }
    }
    
    setGbifTiles(newTiles);
    console.log('📍 GBIF TILES LOADED:', {
      tileCount: newTiles.length,
      species: selectedSpecies?.name || 'Unknown',
      zoom: zoom,
      status: '🔍 Check coordinate alignment NOW'
    });
  }, [zoom, center, mapSize, selectedSpecies, isZooming]);

  // Handle external navigation requests
  useEffect(() => {
    if (onNavigateToLocation) {
      // Expose navigation function globally
      (window as any).__navigateToLocation = (lat: number, lng: number, zoom?: number) => {
        setCenter([lat, lng]);
        if (zoom !== undefined) {
          setZoom(zoom);
        }
      };
    }
    return () => {
      (window as any).__navigateToLocation = undefined;
    };
  }, [onNavigateToLocation]);

  // Clear GBIF tiles when zoom level changes significantly to reduce flicker
  useEffect(() => {
    // Clear tiles on significant zoom changes to improve performance
    setGbifTiles([]);
  }, [zoom]);

  // Investigate area function
  const investigateArea = async (lat: number, lng: number) => {
    if (!selectedSpecies || !isInvestigateMode) {
      return;
    }
    
    setInvestigationPoint({ lat, lng });
    setIsInvestigateLoading(true);
    // Don't open dialog immediately - wait to see if we have results
    
    console.log('🔍 Starting area investigation at:', { lat, lng, radius: investigateRadius });
    
    try {
      // Use a simple bounding box for the search
      const radiusInDegrees = investigateRadius / 111000; // Rough conversion: 1 degree ≈ 111km
      const latAdjustment = radiusInDegrees;
      const lngAdjustment = radiusInDegrees / Math.cos(lat * Math.PI / 180); // Adjust longitude for latitude
      
      const north = lat + latAdjustment;
      const south = lat - latAdjustment;
      const east = lng + lngAdjustment;
      const west = lng - lngAdjustment;
      
      console.log('🔍 Search bounds:', { north, south, east, west, radiusKm: investigateRadius/1000 });
      
      // Search for occurrences within the bounding box
      const apiUrl = `https://api.gbif.org/v1/occurrence/search?` +
        `taxonKey=${selectedSpecies.key}&` +
        `hasCoordinate=true&` +
        `decimalLatitude=${south},${north}&` +
        `decimalLongitude=${west},${east}&` +
        `limit=50`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch GBIF occurrences');
      }
      
      const data = await response.json();
      console.log('🔍 GBIF response:', data);
      
      // Fetch additional dataset information for each occurrence
      const enrichedOccurrences = await Promise.all(
        data.results.map(async (occurrence: any) => {
          try {
            // Fetch dataset info
            const datasetResponse = await fetch(
              `https://api.gbif.org/v1/dataset/${occurrence.datasetKey}`
            );
            
            let datasetInfo = {};
            if (datasetResponse.ok) {
              const dataset = await datasetResponse.json();
              datasetInfo = {
                datasetTitle: dataset.title,
                publisher: dataset.publishingOrganizationTitle || dataset.publisher
              };
            }
            
            return {
              key: occurrence.key,
              scientificName: occurrence.scientificName,
              decimalLatitude: occurrence.decimalLatitude,
              decimalLongitude: occurrence.decimalLongitude,
              eventDate: occurrence.eventDate,
              recordedBy: occurrence.recordedBy,
              datasetKey: occurrence.datasetKey,
              basisOfRecord: occurrence.basisOfRecord,
              coordinateUncertaintyInMeters: occurrence.coordinateUncertaintyInMeters,
              media: occurrence.media || [],
              ...datasetInfo
            };
          } catch (err) {
            console.error('Error fetching dataset info:', err);
            return occurrence;
          }
        })
      );
      
      setInvestigateResults(enrichedOccurrences);
      
      if (enrichedOccurrences.length === 0) {
        // No results - just show toast message, don't open dialog
        toast.info(`No occurrences found for ${selectedSpecies.scientificName} within ${investigateRadius/1000}km of this location`);
      } else {
        // Found results - open dialog and show success message
        setIsInvestigateDialogOpen(true);
        toast.success(`Found ${enrichedOccurrences.length} occurrence(s) for ${selectedSpecies.scientificName}`);
      }
      
    } catch (error) {
      console.error('Error investigating area:', error);
      toast.error('Failed to search for occurrences in this area');
      setInvestigateResults([]);
    } finally {
      setIsInvestigateLoading(false);
    }
  };

  // Helper functions for investigate results
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getDistanceString = (lat: number, lng: number) => {
    if (!investigationPoint) return '';
    
    // Calculate distance using Haversine formula
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat - investigationPoint.lat) * Math.PI / 180;
    const dLng = (lng - investigationPoint.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(investigationPoint.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    if (distance < 1000) {
      return `${Math.round(distance)}m away`;
    } else {
      return `${(distance / 1000).toFixed(1)}km away`;
    }
  };

  const handleMapClick = ({ latLng }: { latLng: [number, number] }) => {
    const [lat, lng] = latLng;
    console.log('🗺️ MapComponent: handleMapClick called with:', { lat, lng, isInvestigateMode, dialogOpen: isInvestigateDialogOpen });
    
    // Don't trigger investigation if dialog is open
    if (isInvestigateDialogOpen) {
      console.log('🗺️ MapComponent: Ignoring click - dialog is open');
      return;
    }
    
    // Handle investigate mode - search for occurrences in clicked area
    if (isInvestigateMode) {
      console.log('🗺️ MapComponent: Investigate mode click detected at:', { lat, lng });
      investigateArea(lat, lng);
      return;
    }
    
    // Only log clicks near the map edges where coordinate issues occur
    if (Math.abs(lat) > 80) {
      const [ourScreenX, ourScreenY] = latLngToPixel(lat, lng);
      const roundTripLatLng = pixelToCurrentLatLng(ourScreenX, ourScreenY);
      const latError = Math.abs(lat - roundTripLatLng[0]);
      
      console.log('🖱️ EDGE CLICK TEST:', {
        clicked: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
        coordinateError: latError.toFixed(4) + '°',
        status: latError > 0.1 ? '❌ MISALIGNED' : '✅ ALIGNED'
      });
    }
    
    if (!isDrawing) {
      console.log('🗺️ MapComponent: Not in drawing mode, ignoring click');
      return;
    }
    setDrawingPoints([...drawingPoints, latLng]);
  };

  const startDrawing = (mode: 'polygon' | 'rectangle') => {
    setDrawingMode(mode);
    setIsDrawing(true);
    setDrawingPoints([]);
    setIsDraggingShape(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const finishDrawing = (points?: [number, number][]) => {
    const pointsToUse = points || drawingPoints;
    
    if (drawingMode === 'polygon' && pointsToUse.length < 3) {
      alert('Please add at least 3 points to create a polygon');
      return;
    }
    
    if (drawingMode === 'rectangle' && pointsToUse.length !== 2) {
      alert('Please click two opposite corners to create a rectangle');
      return;
    }
    
    let finalPoints = pointsToUse;
    
    // Convert rectangle to polygon (4 corners)
    if (drawingMode === 'rectangle' && pointsToUse.length === 2) {
      const [p1, p2] = pointsToUse;
      finalPoints = [
        [p1[0], p1[1]], // top-left
        [p1[0], p2[1]], // top-right
        [p2[0], p2[1]], // bottom-right
        [p2[0], p1[1]], // bottom-left
      ];
    }
    
    // Auto-save the polygon immediately
    if (onAutoSave) {
      onAutoSave(finalPoints);
    } else {
      onPolygonChange(finalPoints);
    }
    
    setDrawingPoints([]);
    setIsDrawing(false);
  };

  const cancelDrawing = () => {
    setDrawingPoints([]);
    setIsDrawing(false);
    setIsDraggingShape(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const clearCurrentPolygon = () => {
    onPolygonChange(null);
    setIsEditingCurrent(false);
  };

  // Handlers for current polygon editing
  const handleCurrentVertexMouseDown = (e: React.MouseEvent, vertexIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingVertex({ polygonId: 'current', index: vertexIndex });
  };

  const handleCurrentEdgeClick = (e: React.MouseEvent, edgeStartIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!currentPolygon) return;
    
    // Calculate midpoint
    const point1 = currentPolygon[edgeStartIndex];
    const point2 = currentPolygon[(edgeStartIndex + 1) % currentPolygon.length];
    const midLat = (point1[0] + point2[0]) / 2;
    const midLng = (point1[1] + point2[1]) / 2;
    
    // Insert new vertex
    const newCoordinates = [
      ...currentPolygon.slice(0, edgeStartIndex + 1),
      [midLat, midLng] as [number, number],
      ...currentPolygon.slice(edgeStartIndex + 1),
    ];
    
    onPolygonChange(newCoordinates);
  };

  const handleCurrentVertexRightClick = (e: React.MouseEvent, vertexIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!currentPolygon) return;
    
    if (currentPolygon.length <= 3) {
      toast.error('Cannot delete vertex: polygon must have at least 3 vertices');
      return;
    }
    
    const newCoordinates = currentPolygon.filter((_, i) => i !== vertexIndex);
    onPolygonChange(newCoordinates);
  };

  // Web Mercator projection limits (poles are at infinity)
  const WEB_MERCATOR_MAX_LAT = 85.0511287798;
  
  // Clamp latitude to Web Mercator valid range
  const clampLatitude = (lat: number): number => {
    return Math.max(-WEB_MERCATOR_MAX_LAT, Math.min(WEB_MERCATOR_MAX_LAT, lat));
  };
  
  // Convert lat/lng to Web Mercator world coordinates  
  // Using the exact formula that matches most mapping libraries including pigeon-maps
  const latLngToWorld = (lat: number, lng: number, zoom: number): [number, number] => {
    // Clamp latitude to prevent infinity at poles
    const clampedLat = clampLatitude(lat);
    
    const scale = 256 * Math.pow(2, zoom);
    const worldX = (lng + 180) / 360 * scale;
    
    // More precise Web Mercator Y calculation
    const latRad = clampedLat * Math.PI / 180;
    // Using the standard Web Mercator formula: y = ln(tan(π/4 + φ/2))
    const mercatorY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const worldY = (1 - mercatorY / Math.PI) / 2 * scale;
    
    // Debug logging for coordinate transformation
    if (Math.abs(lat - clampedLat) > 0.001) {
      console.log('🌐 Coordinate clamping:', { original: lat, clamped: clampedLat, limit: WEB_MERCATOR_MAX_LAT });
    }
    
    return [worldX, worldY];
  };

  // Simplified coordinate conversion that always uses current map state
  // This should eliminate the scaling/drifting issues
  const latLngToPixel = (lat: number, lng: number): [number, number] => {
    // Always use current live map state for immediate responsiveness
    const [worldX, worldY] = latLngToWorld(lat, lng, zoom);
    const [centerWorldX, centerWorldY] = latLngToWorld(center[0], center[1], zoom);
    const x = (worldX - centerWorldX) + mapSize.width / 2;
    const y = (worldY - centerWorldY) + mapSize.height / 2;
    return [x, y];
  };

  // Stable coordinate conversion for polygon rendering - uses frozen state during map interactions
  const latLngToStablePixel = (lat: number, lng: number): [number, number] => {
    // Use frozen map state during interactions to prevent polygon drift
    const mapState = isMapInteracting && frozenMapState ? frozenMapState : { center, zoom };
    
    const [worldX, worldY] = latLngToWorld(lat, lng, mapState.zoom);
    const [centerWorldX, centerWorldY] = latLngToWorld(mapState.center[0], mapState.center[1], mapState.zoom);
    const x = (worldX - centerWorldX) + mapSize.width / 2;
    const y = (worldY - centerWorldY) + mapSize.height / 2;
    return [x, y];
  };

  // Convert pixel coords to lat/lng (for current view)
  const pixelToCurrentLatLng = (x: number, y: number): [number, number] => {
    const [centerWorldX, centerWorldY] = latLngToWorld(center[0], center[1], zoom);
    const worldX = centerWorldX + (x - mapSize.width / 2);
    const worldY = centerWorldY + (y - mapSize.height / 2);
    
    const scale = 256 * Math.pow(2, zoom);
    const lng = (worldX / scale) * 360 - 180;
    
    // Exact inverse of latLngToWorld Web Mercator transformation
    const worldYNorm = worldY / scale;
    const mercatorY = Math.PI * (1 - 2 * worldYNorm);
    // This is the exact inverse of: mercatorY = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
    const latRad = 2 * Math.atan(Math.exp(mercatorY)) - Math.PI / 2;
    const lat = clampLatitude(latRad * 180 / Math.PI);
    
    return [lat, lng];
  };

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    // Don't start drawing if we're already dragging a vertex
    if (draggingVertex) return;
    
    if (!isDrawing) return;
    if (drawingMode !== 'rectangle') return; // Only for rectangle mode
    
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const latLng = pixelToCurrentLatLng(x, y);
    
    setIsDraggingShape(true);
    setDragStart(latLng);
    setDragCurrent(latLng);
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    // Handle rectangle dragging
    if (isDraggingShape && dragStart) {
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const latLng = pixelToCurrentLatLng(x, y);
      
      setDragCurrent(latLng);
      return;
    }
    
    // Handle vertex dragging
    if (draggingVertex) {
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const latLng = pixelToCurrentLatLng(x, y);
      
      if (draggingVertex.polygonId === 'current') {
        // Update current polygon
        if (!currentPolygon) return;
        const newCoordinates = currentPolygon.map((coord, i) =>
          i === draggingVertex.index ? latLng : coord
        );
        onPolygonChange(newCoordinates);
      } else {
        // Update saved polygon
        const polygon = savedPolygons.find(p => p.id === draggingVertex.polygonId);
        if (!polygon || !onUpdatePolygon) return;
        
        // Handle both single polygon and multipolygon coordinates
        if (Array.isArray(polygon.coordinates[0]) && Array.isArray(polygon.coordinates[0][0])) {
          // This is a multipolygon - not handling vertex editing for multipolygons yet
          return;
        } else {
          // This is a single polygon
          const coords = polygon.coordinates as [number, number][];
          const newCoordinates = coords.map((coord, i) =>
            i === draggingVertex.index ? latLng : coord
          );
          onUpdatePolygon(draggingVertex.polygonId, newCoordinates);
        }
      }
    }
  };

  const handleOverlayMouseUp = () => {
    if (!isDraggingShape || !dragStart || !dragCurrent) return;
    
    // Only create rectangle if drag was significant (more than 5 pixels)
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (rect) {
      const [x1, y1] = latLngToPixel(dragStart[0], dragStart[1]);
      const [x2, y2] = latLngToPixel(dragCurrent[0], dragCurrent[1]);
      const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      
      if (distance > 5) {
        finishDrawing([dragStart, dragCurrent]);
      }
    }
    
    setIsDraggingShape(false);
    setDragStart(null);
    setDragCurrent(null);
    setDraggingVertex(null);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    if (drawingMode === 'rectangle') return; // Rectangle uses drag instead
    
    // Get click position relative to map container
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [lat, lng] = pixelToCurrentLatLng(x, y);
    
    // console.log('Click at pixel:', x, y);
    // console.log('Converted to lat/lng:', lat, lng);
    // console.log('Current center:', center, 'zoom:', zoom);
    
    setDrawingPoints([...drawingPoints, [lat, lng]]);
  };

  const handleOverlayDoubleClick = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    finishDrawing();
  };

  const handleVertexMouseDown = (e: React.MouseEvent, polygonId: string, vertexIndex: number) => {
    e.stopPropagation();
    // console.log('Vertex mousedown:', polygonId, vertexIndex);
    setDraggingVertex({ polygonId, index: vertexIndex });
  };

  const handleVertexRightClick = (e: React.MouseEvent, polygonId: string, vertexIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!onUpdatePolygon) return;
    
    const polygon = savedPolygons.find(p => p.id === polygonId);
    if (!polygon) return;
    
    // Handle both single polygon and multipolygon coordinates
    if (Array.isArray(polygon.coordinates[0]) && Array.isArray(polygon.coordinates[0][0])) {
      // This is a multipolygon - not handling vertex editing for multipolygons yet
      return;
    } else {
      // This is a single polygon
      const coords = polygon.coordinates as [number, number][];
      if (coords.length <= 3) {
        // Don't allow deletion if it would result in less than 3 vertices
        toast.error('Cannot delete vertex - polygon must have at least 3 vertices');
        return;
      }
      
      const newCoordinates = coords.filter((_, i) => i !== vertexIndex);
      onUpdatePolygon(polygonId, newCoordinates);
      toast.success('Vertex deleted');
    }
  };

  const handleEdgeClick = (e: React.MouseEvent, polygonId: string, afterIndex: number) => {
    e.stopPropagation();
    
    if (!onUpdatePolygon) return;
    
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [lat, lng] = pixelToCurrentLatLng(x, y);
    
    const polygon = savedPolygons.find(p => p.id === polygonId);
    if (!polygon) return;
    
    // Decode part and index from afterIndex
    const partIndex = Math.floor(afterIndex / 10000);
    const localIndex = afterIndex % 10000;
    
    if (polygon.isMultiPolygon) {
      const parts = polygon.coordinates as [number, number][][];
      const newParts = parts.map((part, i) => {
        if (i === partIndex) {
          const newPart = [...part];
          newPart.splice(localIndex + 1, 0, [lat, lng]);
          return newPart;
        }
        return part;
      });
      onUpdatePolygon(polygonId, newParts);
    } else {
      const coords = polygon.coordinates as [number, number][];
      const newCoordinates = [...coords];
      newCoordinates.splice(localIndex + 1, 0, [lat, lng]);
      onUpdatePolygon(polygonId, newCoordinates);
    }
    toast.success('Vertex added');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingVertex || !onUpdatePolygon) return;
    
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [lat, lng] = pixelToCurrentLatLng(x, y);
    
    const polygon = savedPolygons.find(p => p.id === draggingVertex.polygonId);
    if (!polygon) return;
    
    // Decode part and index from draggingVertex.index
    const partIndex = Math.floor(draggingVertex.index / 10000);
    const localIndex = draggingVertex.index % 10000;
    
    if (polygon.isMultiPolygon) {
      const parts = polygon.coordinates as [number, number][][];
      const newParts = parts.map((part, i) => {
        if (i === partIndex) {
          const newPart = [...part];
          newPart[localIndex] = [lat, lng];
          return newPart;
        }
        return part;
      });
      onUpdatePolygon(draggingVertex.polygonId, newParts);
    } else {
      const coords = polygon.coordinates as [number, number][];
      const newCoordinates = [...coords];
      newCoordinates[localIndex] = [lat, lng];
      onUpdatePolygon(draggingVertex.polygonId, newCoordinates);
    }
  };

  const handleMouseUp = () => {
    setDraggingVertex(null);
  };

  return (
    <div 
      ref={mapContainerRef} 
      className={`relative w-full h-full overflow-hidden ${isInvestigateMode ? 'cursor-none' : ''}`}
      style={{ 
        contain: 'layout style',
        cursor: isInvestigateMode ? 'none' : 'default'
      }}
      onMouseMove={(e) => {
        // Track mouse position for investigate mode cursor
        if (isInvestigateMode) {
          const rect = mapContainerRef.current?.getBoundingClientRect();
          if (rect) {
            setMousePosition({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
            });
          }
        }
        handleMouseMove(e);
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setMousePosition(null);
        handleMouseUp();
      }}
      onClick={(e) => {
        console.log('🗺️ Container div clicked! isInvestigateMode:', isInvestigateMode, 'dialogOpen:', isInvestigateDialogOpen, 'event:', e);
        
        // Don't process clicks when dialog is open
        if (isInvestigateDialogOpen) {
          console.log('🗺️ Ignoring container click - dialog is open');
          return;
        }
        
        if (isInvestigateMode) {
          console.log('🗺️ Processing investigate mode click');
          // Calculate approximate lat/lng from pixel coordinates
          const rect = mapContainerRef.current?.getBoundingClientRect();
          if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            console.log('🗺️ Click coordinates:', { x, y, rect });
            const latLng = pixelToCurrentLatLng(x, y);
            console.log('🗺️ Container calculated coordinates:', latLng);
            handleMapClick({ latLng });
          }
        }
      }}
    >
      <Map
        center={center}
        zoom={zoom}
        animate={true}
        animateMaxScreens={5}
        zoomSnap={true}
        mouseEvents={true}
        touchEvents={true}
        onBoundsChanged={({ center, zoom: newZoom }) => {
          // Clamp center to Web Mercator bounds
          const clampedCenter: [number, number] = [
            clampLatitude(center[0]), // Clamp latitude
            center[1] // Longitude can wrap around
          ];
          
          // Debug logging for polygon drift debugging
          console.log('🗺️ BOUNDS CHANGED:', {
            oldCenter: `${JSON.stringify(center)}`,
            newCenter: `${JSON.stringify(clampedCenter)}`,
            oldZoom: zoom,
            newZoom: newZoom,
            isDragging: 'checking polygon behavior...'
          });
          
          // Log if clamping occurred
          if (Math.abs(center[0] - clampedCenter[0]) > 0.001) {
            console.log('🗺️ Map center clamped:', { 
              original: center[0], 
              clamped: clampedCenter[0], 
              reason: 'Web Mercator latitude limit' 
            });
          }
          
          setCenter(clampedCenter);
          setZoom(newZoom);
        }}
        onClick={(event) => {
          console.log('🗺️ Map onClick event triggered:', event);
          handleMapClick(event);
        }}
        provider={gbifTileProvider}
        attribution={false}
      >
        {/* GBIF Occurrence Tiles as Overlays */}
        {!isZooming && gbifTiles.map((tile) => {
          const [nwLat, nwLng] = tile.anchor;
          const scaleFactor = Math.pow(2, zoom - tile.z);
          const displaySize = 256 * scaleFactor;
          
          return (
            <Overlay 
              key={`gbif-${tile.z}-${tile.x}-${tile.y}`} 
              anchor={[nwLat, nwLng]} 
              offset={[0, 0]}
            >
              <div style={{ pointerEvents: 'none' }}>
                <img
                  src={tile.url}
                  alt=""
                  style={{
                    width: `${displaySize}px`,
                    height: `${displaySize}px`,
                    opacity: 0.7,
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </Overlay>
          );
        })}


      </Map>

      {/* Click capture layer for drawing when overlays are present */}
      {isDrawing && (
        <div 
          className="absolute inset-0 cursor-crosshair z-[5]"
          onClick={handleOverlayClick}
          onDoubleClick={handleOverlayDoubleClick}
          onMouseDown={handleOverlayMouseDown}
          onMouseMove={handleOverlayMouseMove}
          onMouseUp={handleOverlayMouseUp}
        />
      )}

      {/* SVG Overlay for Polygons and Vertices */}
      {mapSize.width > 0 && mapSize.height > 0 && (
        <svg 
          ref={svgRef}
          className="absolute inset-0 pointer-events-none w-full h-full z-[1]"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          {/* Simplified SVG without complex transforms */}
          <g>
            {/* Annotation rule polygons */}
            {showAnnotationRules && annotationRules.map((rule) => {
              if (!rule.multiPolygon) {
                return null;
              }
              
              // Color based on annotation type
              const colors = {
                SUSPICIOUS: { fill: '#ef4444', stroke: '#dc2626' }, // red
                NATIVE: { fill: '#10b981', stroke: '#059669' }, // green
                MANAGED: { fill: '#3b82f6', stroke: '#2563eb' }, // blue
                FORMER: { fill: '#a855f7', stroke: '#9333ea' }, // purple
                VAGRANT: { fill: '#f97316', stroke: '#ea580c' }, // orange
              };
              const colorSet = colors[rule.annotation.toUpperCase() as keyof typeof colors] || { fill: '#6b7280', stroke: '#4b5563' };
              
              // Build SVG path for all polygons in the multipolygon
              const buildPath = () => {
                let path = '';
                
                // Render each polygon
                rule.multiPolygon!.polygons.forEach((polygonWithHoles) => {
                  // Outer ring
                  const outerPixels = polygonWithHoles.outer.map(([lat, lng]) => latLngToPixel(lat, lng));
                  path += `M ${outerPixels.map(([x, y]) => `${x},${y}`).join(' L ')} Z `;
                  
                  // Holes
                  polygonWithHoles.holes.forEach((hole) => {
                    const holePixels = hole.map(([lat, lng]) => latLngToPixel(lat, lng));
                    path += `M ${holePixels.map(([x, y]) => `${x},${y}`).join(' L ')} Z `;
                  });
                });
                
                return path;
              };
              
              return (
                <path
                  key={`rule-${rule.id}`}
                  d={buildPath()}
                  fill={colorSet.fill}
                  fillOpacity="0.15"
                  stroke={colorSet.stroke}
                  strokeWidth="2.5"
                  strokeDasharray="8,4"
                  fillRule="evenodd"
                />
              );
            })}

            {/* Saved polygons */}
            {savedPolygons.map((polygonData) => {
              // Get color based on annotation type
              const annotation = polygonData.annotation || 'SUSPICIOUS';
              const annotationColors: { [key: string]: { fill: string; stroke: string } } = {
                SUSPICIOUS: { fill: '#ef4444', stroke: '#dc2626' }, // red
                NATIVE: { fill: '#10b981', stroke: '#059669' }, // green
                MANAGED: { fill: '#3b82f6', stroke: '#2563eb' }, // blue
                FORMER: { fill: '#a855f7', stroke: '#9333ea' }, // purple
                VAGRANT: { fill: '#f97316', stroke: '#ea580c' }, // orange
              };
              const color = annotationColors[annotation.toUpperCase()] || annotationColors.SUSPICIOUS;
              const isEditing = editingPolygonId === polygonData.id;
              
              // Normalize coordinates to array of polygons
              const polygonParts: [number, number][][] = polygonData.isMultiPolygon 
                ? (polygonData.coordinates as [number, number][][])
                : [polygonData.coordinates as [number, number][]];

              if (polygonData.inverted) {
                // Use SVG canvas as outer boundary (much larger to ensure coverage)
                const margin = 10000; // Large margin to cover any viewport
                let pathStr = `M ${-margin},${-margin} L ${mapSize.width + margin},${-margin} L ${mapSize.width + margin},${mapSize.height + margin} L ${-margin},${mapSize.height + margin} Z`;
                
                // Add all polygon parts as holes
                polygonParts.forEach(polyCoords => {
                  const holePixels = polyCoords.map(([lat, lng]) => latLngToPixel(lat, lng));
                  pathStr += ` M ${holePixels.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
                });
                
                return (
                  <path
                    key={polygonData.id}
                    d={pathStr}
                    fill={color.fill}
                    fillOpacity="0.1"
                    stroke={color.stroke}
                    strokeWidth="2"
                    fillRule="evenodd"
                  />
                );
              } else {
                return (
                  <g key={polygonData.id}>
                    {polygonParts.map((polyCoords, partIndex) => (
                      <polygon
                        key={`${polygonData.id}-part-${partIndex}`}
                        points={polyCoords.map(([lat, lng]) => {
                          const [x, y] = latLngToPixel(lat, lng);
                          return `${x},${y}`;
                        }).join(' ')}
                        fill={color.fill}
                        fillOpacity={isEditing ? "0.15" : "0.1"}
                        stroke={color.stroke}
                        strokeWidth={isEditing ? "3" : "2"}
                        strokeDasharray={isEditing ? "5,5" : "none"}
                      />
                    ))}
                  </g>
                );
              }
            })}

            {/* DEBUG: Coordinate markers for annotation polygons - COMMENTED OUT */}
            {/*
            {savedPolygons.map((polygonData) => {
              // Show debugging markers for the first few vertices of each polygon
              const polygonParts: [number, number][][] = polygonData.isMultiPolygon 
                ? (polygonData.coordinates as [number, number][][])
                : [polygonData.coordinates as [number, number][]];
              
              return polygonParts.map((polyCoords, partIndex) => 
                polyCoords.slice(0, 3).map((coord, vertexIndex) => { // Show first 3 vertices for debugging
                  const [lat, lng] = coord;
                  const [x, y] = latLngToStablePixel(lat, lng);
                  
                  return (
                    <g key={`debug-${polygonData.id}-${partIndex}-${vertexIndex}`}>
                      <circle
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#ff0000"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                      <text
                        x={x + 8}
                        y={y - 8}
                        fontSize="10"
                        fill="#000000"
                        stroke="#ffffff"
                        strokeWidth="0.5"
                        style={{ fontFamily: 'monospace' }}
                      >
                        {`${lat.toFixed(4)}, ${lng.toFixed(4)}`}
                      </text>
                    </g>
                  );
                })
              );
            })}
            */}

            {/* DEBUG: Map reference grid points - COMMENTED OUT FOR CLEANER VIEW */}

            {/* Saved Polygon Edge Midpoints (for adding vertices) */}
            {savedPolygons.map((polygon) => {
              const isEditing = editingPolygonId === polygon.id;
              if (!isEditing) return null;
              
              // Normalize coordinates to array of polygons
              const polygonParts: [number, number][][] = polygon.isMultiPolygon 
                ? (polygon.coordinates as [number, number][][])
                : [polygon.coordinates as [number, number][]];
              
              // Get color based on annotation type
              const annotation = polygon.annotation || 'SUSPICIOUS';
              const annotationColors: { [key: string]: string } = {
                SUSPICIOUS: '#dc2626',
                NATIVE: '#059669',
                MANAGED: '#2563eb',
                FORMER: '#9333ea',
                VAGRANT: '#ea580c',
              };
              const edgeColor = annotationColors[annotation.toUpperCase()] || '#3b82f6';
              
              return polygonParts.map((polyCoords, partIndex) => 
                polyCoords.map((point, index) => {
                  const nextIndex = (index + 1) % polyCoords.length;
                  const nextPoint = polyCoords[nextIndex];
                  
                  // Calculate midpoint
                  const [x1, y1] = latLngToPixel(point[0], point[1]);
                  const [x2, y2] = latLngToPixel(nextPoint[0], nextPoint[1]);
                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;
                  const edgeKey = `edge-${polygon.id}-${partIndex}-${index}`;
                  
                  return (
                    <g key={edgeKey}>
                      {/* Invisible thick line for easier clicking */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="transparent"
                        strokeWidth="12"
                        className="cursor-pointer pointer-events-auto"
                        onClick={(e) => handleEdgeClick(e, polygon.id, partIndex * 10000 + index)}
                      />
                      {/* Visible midpoint */}
                      <circle
                        cx={midX}
                        cy={midY}
                        r="5"
                        fill={edgeColor}
                        fillOpacity="0.8"
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer pointer-events-auto transition-opacity hover:fill-opacity-100"
                        onClick={(e) => handleEdgeClick(e, polygon.id, partIndex * 10000 + index)}
                      >
                        <title>Click to add vertex (Part {partIndex + 1})</title>
                      </circle>
                    </g>
                  );
                })
              );
            })}

            {/* Saved Polygon Vertices */}
            {savedPolygons.map((polygon) => {
              const isEditing = editingPolygonId === polygon.id;
              
              // Normalize coordinates to array of polygons
              const polygonParts: [number, number][][] = polygon.isMultiPolygon 
                ? (polygon.coordinates as [number, number][][])
                : [polygon.coordinates as [number, number][]];
              
              // Get color based on annotation type
              const annotation = polygon.annotation || 'SUSPICIOUS';
              const annotationColors: { [key: string]: string } = {
                SUSPICIOUS: '#dc2626',
                NATIVE: '#059669',
                MANAGED: '#2563eb',
                FORMER: '#9333ea',
                VAGRANT: '#ea580c',
              };
              const vertexColor = isEditing ? annotationColors[annotation.toUpperCase()] || '#3b82f6' : (polygon.inverted ? "#ef4444" : annotationColors[annotation.toUpperCase()] || "#10b981");
              
              return polygonParts.map((polyCoords, partIndex) => 
                polyCoords.map((point, index) => {
                  const [x, y] = latLngToPixel(point[0], point[1]);
                  const encodedIndex = partIndex * 10000 + index;
                  const isBeingDragged = draggingVertex?.polygonId === polygon.id && draggingVertex?.index === encodedIndex;
                  
                  return (
                    <g key={`saved-${polygon.id}-${partIndex}-${index}`}>
                      {/* Outer pulsing ring for editable vertices */}
                      {isEditing && !isBeingDragged && (
                        <circle
                          cx={x}
                          cy={y}
                          r="10"
                          fill="none"
                          stroke={vertexColor}
                          strokeWidth="1.5"
                          strokeOpacity="0.4"
                          className="pointer-events-none"
                          style={{
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                          }}
                        />
                      )}
                      {/* Main vertex circle */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isEditing ? "7" : "3"}
                        fill={vertexColor}
                        stroke={isEditing ? "white" : "none"}
                        strokeWidth={isEditing ? (isBeingDragged ? "3" : "2.5") : "0"}
                        className={isEditing ? "cursor-move pointer-events-auto" : "pointer-events-none"}
                        onMouseDown={(e) => {
                          if (isEditing) {
                            e.stopPropagation();
                            e.preventDefault();
                            handleVertexMouseDown(e, polygon.id, encodedIndex);
                          }
                        }}
                        onContextMenu={(e) => isEditing ? handleVertexRightClick(e, polygon.id, encodedIndex) : undefined}
                        style={{ 
                          cursor: isEditing ? 'move' : 'default',
                          filter: isBeingDragged ? `drop-shadow(0 0 4px ${vertexColor})` : 'none'
                        }}
                      >
                        {isEditing && <title>Drag to move • Right-click to delete (Part {partIndex + 1})</title>}
                      </circle>
                    </g>
                  );
                })
              );
            })}



          </g>

          {/* Non-transformed group for current drawing - uses current view coords */}
          <g>
            {/* Drag preview for rectangle */}
            {isDraggingShape && dragStart && dragCurrent && (
              (() => {
                const [x1, y1] = latLngToPixel(dragStart[0], dragStart[1]);
                const [x2, y2] = latLngToPixel(dragCurrent[0], dragCurrent[1]);
                return (
                  <rect
                    x={Math.min(x1, x2)}
                    y={Math.min(y1, y2)}
                    width={Math.abs(x2 - x1)}
                    height={Math.abs(y2 - y1)}
                    fill="#3b82f6"
                    fillOpacity="0.1"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                );
              })()
            )}

            {/* Drawing preview */}
            {drawingPoints.length > 0 && (
              <>
                {drawingMode === 'polygon' && drawingPoints.length > 1 && (
                  <polyline
                    points={drawingPoints.map(([lat, lng]) => {
                      const [x, y] = latLngToPixel(lat, lng);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                )}
                {drawingMode === 'rectangle' && drawingPoints.length === 2 && (() => {
                  const [p1, p2] = drawingPoints;
                  const [x1, y1] = latLngToPixel(p1[0], p1[1]);
                  const [x2, y2] = latLngToPixel(p2[0], p2[1]);
                  return (
                    <rect
                      x={Math.min(x1, x2)}
                      y={Math.min(y1, y2)}
                      width={Math.abs(x2 - x1)}
                      height={Math.abs(y2 - y1)}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                  );
                })()}
              </>
            )}

            {/* Drawing Points */}
            {drawingPoints.map((point, index) => {
              const [x, y] = latLngToPixel(point[0], point[1]);
              return (
                <g key={`drawing-${index}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="2"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
                  />
                </g>
              );
            })}

            {/* Current polygon */}
            {currentPolygon && currentPolygon.length >= 3 && (
              <>
                {isCurrentInverted ? (
                  (() => {
                    const margin = 10000;
                    let pathStr = `M ${-margin},${-margin} L ${mapSize.width + margin},${-margin} L ${mapSize.width + margin},${mapSize.height + margin} L ${-margin},${mapSize.height + margin} Z`;
                    
                    const holePixels = currentPolygon.map(([lat, lng]) => latLngToPixel(lat, lng));
                    pathStr += ` M ${holePixels.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
                    
                    return (
                      <path
                        d={pathStr}
                        fill="#ef4444"
                        fillOpacity="0.2"
                        stroke="#ef4444"
                        strokeWidth="2"
                        fillRule="evenodd"
                      />
                    );
                  })()
                ) : (
                  <polygon
                    points={currentPolygon.map(([lat, lng]) => {
                      const [x, y] = latLngToPixel(lat, lng);
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="#3b82f6"
                    fillOpacity="0.2"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                )}
              </>
            )}

            {/* Current Polygon Vertices */}
            {isEditingCurrent && currentPolygon && currentPolygon.map((point, index) => {
              const nextIndex = (index + 1) % currentPolygon.length;
              const nextPoint = currentPolygon[nextIndex];
              
              const [x1, y1] = latLngToPixel(point[0], point[1]);
              const [x2, y2] = latLngToPixel(nextPoint[0], nextPoint[1]);
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              
              return (
                <g key={`current-edge-${index}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth="12"
                    className="cursor-pointer pointer-events-auto"
                    onClick={(e) => handleCurrentEdgeClick(e, index)}
                  />
                  <circle
                    cx={midX}
                    cy={midY}
                    r="4"
                    fill="#3b82f6"
                    fillOpacity="0.5"
                    stroke="white"
                    strokeWidth="1.5"
                    className="cursor-pointer pointer-events-auto"
                    onClick={(e) => handleCurrentEdgeClick(e, index)}
                  >
                    <title>Click to add vertex</title>
                  </circle>
                </g>
              );
            })}
            
            {currentPolygon?.map((point, index) => {
              const [x, y] = latLngToPixel(point[0], point[1]);
              return (
                <circle
                  key={`current-${index}`}
                  cx={x}
                  cy={y}
                  r={isEditingCurrent ? "7" : "4"}
                  fill="#3b82f6"
                  stroke={isEditingCurrent ? "white" : "none"}
                  strokeWidth={isEditingCurrent ? "2.5" : "0"}
                  className={isEditingCurrent ? "cursor-move pointer-events-auto" : "pointer-events-none"}
                  onMouseDown={(e) => isEditingCurrent ? handleCurrentVertexMouseDown(e, index) : undefined}
                  onContextMenu={(e) => isEditingCurrent ? handleCurrentVertexRightClick(e, index) : undefined}
                  style={{ cursor: isEditingCurrent ? 'move' : 'default' }}
                >
                  {isEditingCurrent && <title>Drag to move • Right-click to delete</title>}
                </circle>
              );
            })}

          </g>

          {/* Custom Investigation Cursor */}
          {isInvestigateMode && mousePosition && (() => {
            // Calculate accurate pixel radius based on current zoom and geographic location
            const metersPerPixelAtEquator = 40075016.686 / (256 * Math.pow(2, zoom));
            
            // Get mouse position latitude for more accurate calculation at that specific location
            const mouseLat = investigationPoint?.lat || center[0];
            const latCorrectionFactor = Math.cos(mouseLat * Math.PI / 180);
            const metersPerPixel = metersPerPixelAtEquator / latCorrectionFactor;
            
            // Calculate true geographic pixel radius (no artificial limits)
            const pixelRadius = investigateRadius / metersPerPixel;
            
            // Only apply minimal constraints for usability - much wider range
            const constrainedPixelRadius = Math.max(2, Math.min(1000, pixelRadius));
            
            // Make crosshair size proportional to circle size, with reasonable bounds
            const crosshairSize = Math.max(3, Math.min(30, constrainedPixelRadius * 0.25));
            
            // Adjust stroke width based on size for better visibility
            const strokeWidth = constrainedPixelRadius < 10 ? 1 : constrainedPixelRadius < 50 ? 2 : 3;
            
            console.log('🎯 Cursor Geographic Accuracy:', { 
              investigateRadius: `${investigateRadius}m`, 
              zoom, 
              mouseLat: mouseLat.toFixed(4),
              metersPerPixel: metersPerPixel.toFixed(1), 
              truePixelRadius: pixelRadius.toFixed(1),
              displayPixelRadius: constrainedPixelRadius.toFixed(1),
              crosshairSize: crosshairSize.toFixed(1)
            });
            
            return (
              <g className="pointer-events-none">
                {/* Outer circle representing true geographic search radius */}
                <circle
                  cx={mousePosition.x}
                  cy={mousePosition.y}
                  r={constrainedPixelRadius}
                  fill="rgba(59, 130, 246, 0.08)"
                  stroke="#3b82f6"
                  strokeWidth={strokeWidth}
                  strokeDasharray={constrainedPixelRadius < 20 ? "2,1" : "4,2"}
                />
                {/* Inner crosshair */}
                <g stroke="#3b82f6" strokeWidth={Math.max(1, strokeWidth * 0.75)}>
                  <line
                    x1={mousePosition.x - crosshairSize}
                    y1={mousePosition.y}
                    x2={mousePosition.x + crosshairSize}
                    y2={mousePosition.y}
                  />
                  <line
                    x1={mousePosition.x}
                    y1={mousePosition.y - crosshairSize}
                    x2={mousePosition.x}
                    y2={mousePosition.y + crosshairSize}
                  />
                </g>
                {/* Center dot */}
                <circle
                  cx={mousePosition.x}
                  cy={mousePosition.y}
                  r={Math.max(1.5, strokeWidth * 0.75)}
                  fill="#3b82f6"
                />
                {/* Radius label - position based on circle size */}
                <text
                  x={mousePosition.x + constrainedPixelRadius + 8}
                  y={mousePosition.y - 8}
                  fontSize={constrainedPixelRadius < 30 ? "10" : "12"}
                  fill="#3b82f6"
                  fontWeight="500"
                  className="pointer-events-none select-none"
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  {(investigateRadius / 1000).toFixed(0)}km
                </text>
              </g>
            );
          })()}

        </svg>
      )}

      {/* Investigate Mode Indicator */}
      {isInvestigateMode && (
        <div className="absolute top-4 right-4 bg-blue-600 text-white rounded-lg shadow-lg p-3 z-20">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span className="text-sm font-medium">Investigate Mode</span>
          </div>
          <p className="text-xs mt-1 opacity-90">Click anywhere to search for occurrences</p>
        </div>
      )}

      {/* Drawing Controls - only show when not editing */}
      {!editingPolygonId && (
        <div 
          className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 flex flex-col gap-2 z-10"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {!isDrawing ? (
            <>
              <Button 
                onClick={() => startDrawing('polygon')} 
                size="icon" 
                variant="outline"
                title="Draw Polygon"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L20 7L17 17L7 17L4 7Z"/>
                </svg>
              </Button>
              <Button 
                onClick={() => startDrawing('rectangle')} 
                size="icon" 
                variant="outline"
                title="Draw Rectangle"
              >
                <Square className="w-5 h-5" />
              </Button>
              
              {/* Investigate Area Tool */}
              <Button
                variant={isInvestigateMode ? "default" : "outline"}
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsInvestigateMode(!isInvestigateMode);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={!selectedSpecies}
                title={selectedSpecies ? "Click on map to investigate area for occurrences" : "Select a species first"}
                className={isInvestigateMode ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                <Search className="w-5 h-5" />
              </Button>

              {/* Radius Controls - vertically below investigate button when active */}
              {isInvestigateMode && (
                <div 
                  className="flex flex-col gap-1 bg-white rounded border shadow-sm px-1 py-1"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInvestigateRadius(Math.min(50000, investigateRadius + 1000));
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={investigateRadius >= 50000}
                    title="Increase radius"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                  <span className="text-xs font-medium text-center py-1">
                    {(investigateRadius / 1000).toFixed(0)}km
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInvestigateRadius(Math.max(1000, investigateRadius - 1000));
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={investigateRadius <= 1000}
                    title="Decrease radius"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                </div>
              )}
              
              {currentPolygon && (
                <>
                  <Button 
                    onClick={onSaveAndEdit} 
                    variant="outline"
                    size="icon"
                    title="Save and Edit Polygon"
                    className="border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={clearCurrentPolygon} 
                    variant="outline" 
                    size="icon"
                    title="Clear Current"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <div className="px-2 py-1 text-xs text-gray-600 whitespace-nowrap">
                {drawingMode === 'polygon' && `${drawingPoints.length} pts`}
                {drawingMode === 'rectangle' && drawingPoints.length === 0 && '1st corner'}
                {drawingMode === 'rectangle' && drawingPoints.length === 1 && '2nd corner'}
                {drawingMode === 'polygon' && drawingPoints.length === 0 && 'Click to start drawing'}
                {drawingMode === 'polygon' && drawingPoints.length === 1 && 'Continue adding points'}
              </div>
              {drawingMode === 'polygon' && (
                <Button 
                  onClick={() => finishDrawing()} 
                  size="icon" 
                  variant="default"
                  title="Finish Polygon"
                  disabled={drawingPoints.length < 3}
                >
                  <Check className="w-4 h-4" />
                </Button>
              )}
              <Button 
                onClick={cancelDrawing} 
                variant="outline" 
                size="icon"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Investigation Results Dialog */}
      <Dialog open={isInvestigateDialogOpen} onOpenChange={setIsInvestigateDialogOpen}>
        <DialogContent 
          className="max-w-4xl max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Area Investigation Results
            </DialogTitle>
            <DialogDescription>
              {selectedSpecies && investigationPoint && (
                <>
                  Occurrences of <em>{selectedSpecies.scientificName}</em> near{' '}
                  {investigationPoint.lat.toFixed(4)}, {investigationPoint.lng.toFixed(4)} 
                  ({(investigateRadius/1000)}km radius)
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {isInvestigateLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Searching for occurrences...</span>
              </div>
            ) : investigateResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No occurrences found in this area</p>
                <p className="text-sm">Try investigating a different location</p>
              </div>
            ) : (
              <div className="space-y-4">
                {investigateResults.map((occurrence) => (
                  <Card key={occurrence.key} className="p-4">
                    <div className="flex gap-4">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        {occurrence.media && occurrence.media.length > 0 && occurrence.media[0].identifier ? (
                          <img
                            src={occurrence.media[0].identifier}
                            alt={occurrence.media[0].title || 'Occurrence image'}
                            className="w-24 h-24 object-cover rounded border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-100 rounded border flex items-center justify-center">
                            <Eye className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Occurrence Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{occurrence.scientificName}</h4>
                            <p className="text-xs text-gray-500">
                              GBIF Key: {occurrence.key}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {occurrence.basisOfRecord || 'Unknown'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-600">
                                {occurrence.decimalLatitude?.toFixed(4)}, {occurrence.decimalLongitude?.toFixed(4)}
                              </span>
                            </div>
                            <div className="text-gray-500">
                              {getDistanceString(occurrence.decimalLatitude, occurrence.decimalLongitude)}
                            </div>
                            {occurrence.coordinateUncertaintyInMeters && (
                              <div className="text-gray-500">
                                ±{occurrence.coordinateUncertaintyInMeters}m uncertainty
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-600">
                                {formatDate(occurrence.eventDate)}
                              </span>
                            </div>
                            {occurrence.recordedBy && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-600 truncate">
                                  {occurrence.recordedBy}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Dataset Information */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Database className="w-3 h-3 text-gray-400" />
                            <span className="text-xs font-medium">Dataset</span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {occurrence.datasetTitle || 'Unknown dataset'}
                          </p>
                          {occurrence.publisher && (
                            <p className="text-xs text-gray-500">
                              Published by: {occurrence.publisher}
                            </p>
                          )}
                        </div>

                        {/* Links */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => window.open(`https://www.gbif.org/occurrence/${occurrence.key}`, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View on GBIF
                          </Button>
                          {occurrence.datasetKey && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => window.open(`https://www.gbif.org/dataset/${occurrence.datasetKey}`, '_blank')}
                            >
                              <Database className="w-3 h-3 mr-1" />
                              Dataset
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </div>
  );
}

