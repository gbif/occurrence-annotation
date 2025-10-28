import { useState, useRef, useEffect, useCallback } from 'react';
import { Map, Overlay } from 'pigeon-maps';
import { PolygonData } from '../App';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { Trash2, Square, Check, X, Edit2, Search, Plus, Minus, ExternalLink, Loader2, MapPin, Calendar, User, Database, Eye, Hand, Repeat, GitBranch, Scissors } from 'lucide-react';
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
  onToggleInvert?: (id: string) => void;
  onEditPolygon?: (id: string) => void;
  onDeletePolygon?: (id: string) => void;
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
  onToggleInvert,
  onEditPolygon,
  onDeletePolygon,
}: MapComponentProps) {
  const [center, setCenter] = useState<[number, number]>([20, 0]);
  const [zoom, setZoom] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState<'polygon' | 'rectangle' | 'latband'>('polygon');
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [gbifTiles, setGbifTiles] = useState<Array<{ x: number; y: number; z: number; anchor: [number, number]; url: string }>>([]);
  const [isZooming, setIsZooming] = useState(false);
  const [isMoveToolActive, setIsMoveToolActive] = useState(false);
  const [draggingPolygon, setDraggingPolygon] = useState<{ id: string; startPos: [number, number]; startCoords: [number, number][] | [number, number][][] } | null>(null);
  const [draggingVertex, setDraggingVertex] = useState<{ polygonId: string; index: number } | null>(null);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [dragCurrent, setDragCurrent] = useState<[number, number] | null>(null);
  const [isEditingCurrent, setIsEditingCurrent] = useState(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  
  // Drag detection state for preventing investigation during map drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartTime, setDragStartTime] = useState<number>(0);
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Investigate mode state
  const [isInvestigateMode, setIsInvestigateMode] = useState(false);
  const [investigateRadius, setInvestigateRadius] = useState(100000); // Default 100km radius
  const [isInvestigateLoading, setIsInvestigateLoading] = useState(false);
  const [investigateResults, setInvestigateResults] = useState<any[]>([]);
  const [isInvestigateDialogOpen, setIsInvestigateDialogOpen] = useState(false);
  const [investigationPoint, setInvestigationPoint] = useState<{ lat: number; lng: number } | null>(null);
  
  // Latitude band state
  const [latBandUpper, setLatBandUpper] = useState(3); // Upper bound (north)
  const [latBandLower, setLatBandLower] = useState(-3); // Lower bound (south)
  const [showLatBandControls, setShowLatBandControls] = useState(false);
  
  // Refs for map interaction
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
        // Set zooming state immediately to prevent polygon re-rendering
        setIsZooming(true);
        
        // Clear any existing timeout
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
        
        // Extended timeout to ensure zoom is completely finished before re-rendering polygons
        zoomTimeoutRef.current = window.setTimeout(() => {
          setIsZooming(false);
        }, 500); // Increased from 100ms to 500ms for more stable rendering
      };
      
      // Drag detection event handlers to prevent investigation during map drag
      const handleMouseDown = (e: MouseEvent) => {
        setDragStartTime(Date.now());
        setDragStartPosition({ x: e.clientX, y: e.clientY });
        setIsDragging(false);
      };
      
      const handleMouseMove = (e: MouseEvent) => {
        if (dragStartPosition) {
          const deltaX = Math.abs(e.clientX - dragStartPosition.x);
          const deltaY = Math.abs(e.clientY - dragStartPosition.y);
          const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          // Consider it a drag if moved more than 10 pixels (increased from 5)
          if (dragDistance > 10) {
            setIsDragging(true);
          }
        }
      };
      
      const handleMouseUp = () => {
        // Reset drag state after a short delay to allow click event to process
        setTimeout(() => {
          setDragStartPosition(null);
          setDragStartTime(0);
          setIsDragging(false);
        }, 50);
      };
      
      // Touch event handlers for mobile
      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          const touch = e.touches[0];
          setDragStartTime(Date.now());
          setDragStartPosition({ x: touch.clientX, y: touch.clientY });
          setIsDragging(false);
        }
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1 && dragStartPosition) {
          const touch = e.touches[0];
          const deltaX = Math.abs(touch.clientX - dragStartPosition.x);
          const deltaY = Math.abs(touch.clientY - dragStartPosition.y);
          const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          // Consider it a drag if moved more than 5 pixels
          if (dragDistance > 5) {
            setIsDragging(true);
          }
        }
      };
      
      const handleTouchEnd = () => {
        // Reset drag state after a short delay to allow click event to process
        setTimeout(() => {
          setDragStartPosition(null);
          setDragStartTime(0);
          setIsDragging(false);
        }, 50);
      };
      
      updateSize();
      window.addEventListener('resize', updateSize);
      mapContainerRef.current.addEventListener('wheel', handleWheel);
      
      // Add drag detection event listeners
      mapContainerRef.current.addEventListener('mousedown', handleMouseDown);
      mapContainerRef.current.addEventListener('mousemove', handleMouseMove);
      mapContainerRef.current.addEventListener('mouseup', handleMouseUp);
      mapContainerRef.current.addEventListener('touchstart', handleTouchStart);
      mapContainerRef.current.addEventListener('touchmove', handleTouchMove);
      mapContainerRef.current.addEventListener('touchend', handleTouchEnd);
      
      const currentRef = mapContainerRef.current;
      
      return () => {
        window.removeEventListener('resize', updateSize);
        if (currentRef) {
          currentRef.removeEventListener('wheel', handleWheel);
          currentRef.removeEventListener('mousedown', handleMouseDown);
          currentRef.removeEventListener('mousemove', handleMouseMove);
          currentRef.removeEventListener('mouseup', handleMouseUp);
          currentRef.removeEventListener('touchstart', handleTouchStart);
          currentRef.removeEventListener('touchmove', handleTouchMove);
          currentRef.removeEventListener('touchend', handleTouchEnd);
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
    setInvestigateResults([]); // Clear previous results
    setIsInvestigateDialogOpen(true); // Open dialog immediately
    
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
        `limit=20`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch GBIF occurrences');
      }
      
      const data = await response.json();
      console.log('🔍 GBIF response:', data);
      
      if (data.results.length === 0) {
        // No results found
        setInvestigateResults([]);
        toast.info(`No occurrences found for ${selectedSpecies.scientificName} within ${investigateRadius/1000}km of this location`);
        return;
      }
      
      // Show initial results count
      toast.success(`Found ${data.results.length} occurrence(s) for ${selectedSpecies.scientificName}. Loading details...`);
      
      // Process occurrences one by one and update the dialog as we go
      const enrichedOccurrences: any[] = [];
      
      for (let i = 0; i < data.results.length; i++) {
        const occurrence = data.results[i];
        
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
          
          const enrichedOccurrence = {
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
          
          enrichedOccurrences.push(enrichedOccurrence);
          
          // Update results in real-time as each occurrence is processed
          setInvestigateResults([...enrichedOccurrences]);
          
        } catch (err) {
          console.error('Error fetching dataset info:', err);
          // Add the occurrence without enriched data
          enrichedOccurrences.push(occurrence);
          setInvestigateResults([...enrichedOccurrences]);
        }
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
    const timeSinceMouseDown = Date.now() - dragStartTime;
    
    console.log('🗺️ MapComponent: handleMapClick called with:', { 
      lat, lng, isInvestigateMode, dialogOpen: isInvestigateDialogOpen, 
      isDragging, timeSinceMouseDown 
    });
    
    // Don't trigger investigation if this was a drag event or held too long (>200ms)
    if (isDragging || timeSinceMouseDown > 200) {
      console.log('🗺️ MapComponent: Ignoring click - was a drag event or held too long');
      return;
    }
    
    // Don't trigger investigation if dialog is open
    if (isInvestigateDialogOpen) {
      console.log('🗺️ MapComponent: Ignoring click - dialog is open');
      return;
    }
    
    // Handle investigate mode - search for occurrences in clicked area
    if (isInvestigateMode) {
      console.log('🗺️ MapComponent: Investigate mode click detected at:', { lat, lng });
      
      // Prevent multiple clicks while investigation is in progress
      if (isInvestigateLoading) {
        console.log('🗺️ MapComponent: Investigation already in progress, ignoring click');
        toast.info('Investigation already in progress...');
        return;
      }
      
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
    
    // Check if coordinates are within valid map bounds before adding to drawing points
    if (!isWithinBounds(lat, lng)) {
      console.log('🚫 Click outside valid map bounds, ignoring:', { lat, lng });
      toast.error('Cannot draw outside map boundaries');
      return;
    }
    
    setDrawingPoints([...drawingPoints, latLng]);
  };

  const startDrawing = (mode: 'polygon' | 'rectangle' | 'latband') => {
    setDrawingMode(mode);
    setIsDrawing(true);
    setDrawingPoints([]);
    setIsDraggingShape(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  const createLatitudeBand = () => {
    // Add small buffer to avoid map edges (0.4 degrees)
    const buffer = 0.4;
    const minLng = -180 + buffer;
    const maxLng = 180 - buffer;
    
    const northLat = Math.min(85, latBandUpper); // Clamp to avoid pole issues
    const southLat = Math.max(-85, latBandLower);
    
    // Create a simple rectangle spanning the full longitude range
    const bandCoords: [number, number][] = [
      [southLat, minLng],  // Southwest corner
      [northLat, minLng],  // Northwest corner  
      [northLat, maxLng],  // Northeast corner
      [southLat, maxLng],  // Southeast corner
      [southLat, minLng]   // Close the polygon
    ];
    
    onPolygonChange && onPolygonChange(bandCoords);
    setIsDrawing(false); // Make it an active current polygon
    setShowLatBandControls(true);
  };

  const adjustLatitudeBandUpper = (delta: number) => {
    const newUpper = Math.max(latBandLower + 0.5, Math.min(85, latBandUpper + delta)); // Keep at least 0.5° above lower bound
    setLatBandUpper(newUpper);
    
    // Recreate the band with new parameters
    const buffer = 0.4;
    const minLng = -180 + buffer;
    const maxLng = 180 - buffer;
    
    const northLat = Math.min(85, newUpper);
    const southLat = Math.max(-85, latBandLower);
    
    const bandCoords: [number, number][] = [
      [southLat, minLng],
      [northLat, minLng],
      [northLat, maxLng],
      [southLat, maxLng],
      [southLat, minLng]
    ];
    
    onPolygonChange && onPolygonChange(bandCoords);
  };

  const adjustLatitudeBandLower = (delta: number) => {
    const newLower = Math.min(latBandUpper - 0.5, Math.max(-85, latBandLower + delta)); // Keep at least 0.5° below upper bound
    setLatBandLower(newLower);
    
    // Recreate the band with new parameters
    const buffer = 0.4;
    const minLng = -180 + buffer;
    const maxLng = 180 - buffer;
    
    const northLat = Math.min(85, latBandUpper);
    const southLat = Math.max(-85, newLower);
    
    const bandCoords: [number, number][] = [
      [southLat, minLng],
      [northLat, minLng],
      [northLat, maxLng],
      [southLat, maxLng],
      [southLat, minLng]
    ];
    
    onPolygonChange && onPolygonChange(bandCoords);
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
    
    // For latitude band, the coordinates are already set by createLatitudeBand
    // Just need to finish the drawing state
    if (drawingMode === 'latband') {
      setIsDrawing(false);
      setDrawingPoints([]);
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
    setShowLatBandControls(false);
    
    // Clear current polygon if it was a latitude band
    if (drawingMode === 'latband') {
      onPolygonChange && onPolygonChange(null);
    }
  };

  const clearCurrentPolygon = () => {
    onPolygonChange(null);
    setIsEditingCurrent(false);
    setShowLatBandControls(false);
  };

  // Function to automatically add midpoint vertices to make editing easier
  const densifyPolygon = (coordinates: [number, number][]): [number, number][] => {
    if (coordinates.length < 3) return coordinates;
    
    const densified: [number, number][] = [];
    
    for (let i = 0; i < coordinates.length; i++) {
      const current = coordinates[i];
      const next = coordinates[(i + 1) % coordinates.length];
      
      // Add the current vertex
      densified.push(current);
      
      // Add midpoint between current and next vertex
      const midLat = (current[0] + next[0]) / 2;
      const midLng = (current[1] + next[1]) / 2;
      densified.push([midLat, midLng]);
    }
    
    return densified;
  };

  // Auto-densify polygon when editing starts (with safety check to prevent infinite loops)
  useEffect(() => {
    if (editingPolygonId && onUpdatePolygon) {
      const polygon = savedPolygons.find(p => p.id === editingPolygonId);
      if (polygon) {
        if (polygon.isMultiPolygon) {
          // Check if any part already has too many vertices
          const coords = polygon.coordinates as [number, number][][];
          const shouldDensify = coords.every(part => part.length < 10);
          
          if (shouldDensify) {
            const densifiedCoords = coords.map(part => densifyPolygon(part));
            onUpdatePolygon(editingPolygonId, densifiedCoords);
          }
        } else {
          // Check if polygon already has too many vertices
          const coords = polygon.coordinates as [number, number][];
          const shouldDensify = coords.length < 10;
          
          if (shouldDensify) {
            const densifiedCoords = densifyPolygon(coords);
            onUpdatePolygon(editingPolygonId, densifiedCoords);
          }
        }
      }
    }
  }, [editingPolygonId, onUpdatePolygon, savedPolygons]);

  // Cancel polygon dragging when move tool is deactivated
  useEffect(() => {
    if (!isMoveToolActive && draggingPolygon) {
      setDraggingPolygon(null);
    }
  }, [isMoveToolActive, draggingPolygon]);

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
  
  // Clamp latitude to Web Mercator valid range (for existing systems)
  const clampLatitude = (lat: number): number => {
    return Math.max(-WEB_MERCATOR_MAX_LAT, Math.min(WEB_MERCATOR_MAX_LAT, lat));
  };

  // Clamp longitude to valid range (-180 to 180) (for existing systems)
  const clampLongitude = (lng: number): number => {
    // Normalize longitude to -180 to 180 range
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    return lng;
  };

  // Clamp coordinates to valid map bounds (kept for legacy/import systems)
  const clampCoordinates = (lat: number, lng: number): [number, number] => {
    return [clampLatitude(lat), clampLongitude(lng)];
  };

  // Check if coordinates are within valid bounds
  const isWithinBounds = (lat: number, lng: number): boolean => {
    return lat >= -WEB_MERCATOR_MAX_LAT && 
           lat <= WEB_MERCATOR_MAX_LAT && 
           lng >= -180 && 
           lng <= 180;
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

  // Unified coordinate conversion - all polygons use the same system for synchronized movement
  const latLngToPixel = useCallback((lat: number, lng: number): [number, number] => {
    // Always use current map state for smooth synchronous movement
    const [worldX, worldY] = latLngToWorld(lat, lng, zoom);
    const [centerWorldX, centerWorldY] = latLngToWorld(center[0], center[1], zoom);
    const x = (worldX - centerWorldX) + mapSize.width / 2;
    const y = (worldY - centerWorldY) + mapSize.height / 2;
    
    return [x, y];
  }, [mapSize.width, mapSize.height, center, zoom]); // Always stay in sync with live map state

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

  const handleOverlayMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle rectangle dragging
    if (isDraggingShape && dragStart) {
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const latLng = pixelToCurrentLatLng(x, y);
      
      // Only update if within bounds
      if (isWithinBounds(latLng[0], latLng[1])) {
        setDragCurrent(latLng);
      }
      return;
    }
    
    // Handle vertex dragging
    if (draggingVertex) {
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newLatLng = pixelToCurrentLatLng(x, y);
      
      // Only allow vertex movement if it stays within bounds
      if (!isWithinBounds(newLatLng[0], newLatLng[1])) {
        return; // Ignore movement outside bounds
      }
      
      if (draggingVertex.polygonId === 'current' && currentPolygon) {
        const newCoordinates = [...currentPolygon];
        newCoordinates[draggingVertex.index] = newLatLng;
        onPolygonChange(newCoordinates);
      } else if (onUpdatePolygon) {
        // Handle saved polygon vertex dragging
        const polygon = savedPolygons.find(p => p.id === draggingVertex.polygonId);
        if (polygon) {
          if (polygon.isMultiPolygon) {
            // For multipolygon, we need to find which part and vertex
            const coords = polygon.coordinates as [number, number][][];
            let totalIndex = 0;
            for (let partIndex = 0; partIndex < coords.length; partIndex++) {
              if (totalIndex + coords[partIndex].length > draggingVertex.index) {
                const vertexInPart = draggingVertex.index - totalIndex;
                const newCoords = [...coords];
                newCoords[partIndex] = [...newCoords[partIndex]];
                newCoords[partIndex][vertexInPart] = newLatLng;
                onUpdatePolygon(draggingVertex.polygonId, newCoords);
                break;
              }
              totalIndex += coords[partIndex].length;
            }
          } else {
            const coords = polygon.coordinates as [number, number][];
            const newCoords = [...coords];
            newCoords[draggingVertex.index] = newLatLng;
            onUpdatePolygon(draggingVertex.polygonId, newCoords);
          }
        }
      }
      return;
    }
    
    // Handle polygon dragging
    if (draggingPolygon && onUpdatePolygon) {
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const currentPos: [number, number] = [e.clientX - rect.left, e.clientY - rect.top];
      
      // Convert pixel delta to lat/lng delta
      const startLatLng = pixelToCurrentLatLng(draggingPolygon.startPos[0], draggingPolygon.startPos[1]);
      const currentLatLng = pixelToCurrentLatLng(currentPos[0], currentPos[1]);
      const deltaLat = currentLatLng[0] - startLatLng[0];
      const deltaLng = currentLatLng[1] - startLatLng[1];
      
      // Check if moving would keep all coordinates within bounds
      const wouldStayInBounds = (coords: [number, number][] | [number, number][][]): boolean => {
        if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
          // Multipolygon
          return (coords as [number, number][][]).every(part =>
            part.every(([lat, lng]) => isWithinBounds(lat + deltaLat, lng + deltaLng))
          );
        } else {
          // Single polygon
          return (coords as [number, number][]).every(([lat, lng]) => 
            isWithinBounds(lat + deltaLat, lng + deltaLng)
          );
        }
      };

      // Only apply movement if all coordinates would stay within bounds
      if (!wouldStayInBounds(draggingPolygon.startCoords)) {
        return; // Ignore movement that would go out of bounds
      }

      // Apply delta to all coordinates
      if (Array.isArray(draggingPolygon.startCoords[0]) && Array.isArray(draggingPolygon.startCoords[0][0])) {
        // Multipolygon
        const newCoords = (draggingPolygon.startCoords as [number, number][][]).map(part =>
          part.map(([lat, lng]) => [lat + deltaLat, lng + deltaLng] as [number, number])
        );
        onUpdatePolygon(draggingPolygon.id, newCoords);
      } else {
        // Single polygon
        const newCoords = (draggingPolygon.startCoords as [number, number][]).map(([lat, lng]) => 
          [lat + deltaLat, lng + deltaLng] as [number, number]
        );
        onUpdatePolygon(draggingPolygon.id, newCoords);
      }
      return;
    }
  }, [isDraggingShape, dragStart, draggingVertex, currentPolygon, onPolygonChange, onUpdatePolygon, savedPolygons, draggingPolygon, pixelToCurrentLatLng]);

  // Global mouse event handlers for vertex/polygon dragging
  useEffect(() => {
    if (!draggingVertex && !draggingPolygon) return;
    
    // Global mouse move handler for vertex dragging
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const mouseEvent = {
        clientX: e.clientX,
        clientY: e.clientY,
        preventDefault: () => {},
        stopPropagation: () => {}
      } as React.MouseEvent;
      
      handleOverlayMouseMove(mouseEvent);
    };
    
    // Global mouse up handler
    const handleGlobalMouseUp = () => {
      if (draggingVertex) {
        setDraggingVertex(null);
      }
      if (draggingPolygon) {
        setDraggingPolygon(null);
      }
    };
    
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingVertex, draggingPolygon, handleOverlayMouseMove]);

  // Bulk vertex operations for editing mode
  const addMidpointVertices = () => {
    if (!editingPolygonId || !onUpdatePolygon) return;
    
    const polygon = savedPolygons.find(p => p.id === editingPolygonId);
    if (!polygon) return;

    if (polygon.isMultiPolygon) {
      const coords = polygon.coordinates as [number, number][][];
      const newCoords = coords.map(part => {
        if (part.length >= 100) {
          toast.error('Cannot add more vertices: polygon part already has 100+ vertices');
          return part;
        }
        
        const newPart: [number, number][] = [];
        for (let i = 0; i < part.length; i++) {
          newPart.push(part[i]);
          
          // Add midpoint between current and next vertex
          const nextIndex = (i + 1) % part.length;
          const current = part[i];
          const next = part[nextIndex];
          const midLat = (current[0] + next[0]) / 2;
          const midLng = (current[1] + next[1]) / 2;
          newPart.push([midLat, midLng]);
        }
        return newPart;
      });
      onUpdatePolygon(editingPolygonId, newCoords);
    } else {
      const coords = polygon.coordinates as [number, number][];
      if (coords.length >= 100) {
        toast.error('Cannot add more vertices: polygon already has 100+ vertices');
        return;
      }
      
      const newCoords: [number, number][] = [];
      for (let i = 0; i < coords.length; i++) {
        newCoords.push(coords[i]);
        
        // Add midpoint between current and next vertex
        const nextIndex = (i + 1) % coords.length;
        const current = coords[i];
        const next = coords[nextIndex];
        const midLat = (current[0] + next[0]) / 2;
        const midLng = (current[1] + next[1]) / 2;
        newCoords.push([midLat, midLng]);
      }
      onUpdatePolygon(editingPolygonId, newCoords);
    }
    toast.success('Added midpoint vertices');
  };

  const removeMidpointVertices = () => {
    if (!editingPolygonId || !onUpdatePolygon) return;
    
    const polygon = savedPolygons.find(p => p.id === editingPolygonId);
    if (!polygon) return;

    if (polygon.isMultiPolygon) {
      const coords = polygon.coordinates as [number, number][][];
      const newCoords = coords.map(part => {
        if (part.length <= 6) {
          toast.error('Cannot remove more vertices: polygon part must have at least 3 vertices');
          return part;
        }
        
        // Keep every other vertex, but ensure we keep at least 3
        const newPart = part.filter((_, index) => index % 2 === 0);
        return newPart.length >= 3 ? newPart : part;
      });
      onUpdatePolygon(editingPolygonId, newCoords);
    } else {
      const coords = polygon.coordinates as [number, number][];
      if (coords.length <= 6) {
        toast.error('Cannot remove more vertices: polygon must have at least 3 vertices');
        return;
      }
      
      // Keep every other vertex, but ensure we keep at least 3
      const newCoords = coords.filter((_, index) => index % 2 === 0);
      if (newCoords.length >= 3) {
        onUpdatePolygon(editingPolygonId, newCoords);
      }
    }
    toast.success('Removed vertices');
  };

  const handleOverlayMouseUp = () => {
    // Handle rectangle creation
    if (isDraggingShape && dragStart && dragCurrent) {
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
    }
    
    // Handle vertex drag end
    if (draggingVertex) {
      setDraggingVertex(null);
    }
    
    // Handle polygon drag end
    if (draggingPolygon) {
      setDraggingPolygon(null);
    }
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

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle vertex dragging in the container
    if (draggingVertex) {
      handleOverlayMouseMove(e);
      return;
    }
    
    // Handle polygon dragging in the container
    if (draggingPolygon && onUpdatePolygon) {
      handleOverlayMouseMove(e);
    }
  };

  const handleMouseUp = () => {
    // Handle vertex drag end
    if (draggingVertex) {
      setDraggingVertex(null);
    }
    
    // Handle polygon drag end
    if (draggingPolygon) {
      setDraggingPolygon(null);
    }
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
        
        // Handle any dragging (vertex or polygon)
        if (draggingVertex || draggingPolygon) {
          handleOverlayMouseMove(e);
        } else {
          handleMouseMove(e);
        }
      }}
      onMouseUp={handleMouseUp}
      onMouseDown={() => {
        console.log('🗺️ Map interaction started - polygons will move synchronously');
      }}
      onMouseLeave={() => {
        setMousePosition(null);
        handleMouseUp();
        console.log('🗺️ Map interaction ended via mouse leave');
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
        minZoom={1}
        maxZoom={18}
        onBoundsChanged={({ center, zoom: newZoom }) => {
          // Set zooming state if zoom level changed significantly
          if (Math.abs(newZoom - zoom) > 0.1) {
            setIsZooming(true);
            
            // Clear any existing timeout
            if (zoomTimeoutRef.current) {
              clearTimeout(zoomTimeoutRef.current);
            }
            
            // Set timeout to end zooming state after zoom stabilizes
            zoomTimeoutRef.current = window.setTimeout(() => {
              setIsZooming(false);
            }, 500);
          }
          
          // Clamp center to Web Mercator bounds
          const clampedCenter: [number, number] = [
            clampLatitude(center[0]), // Clamp latitude
            center[1] // Longitude can wrap around
          ];
          
          // Debug logging for synchronized movement
          console.log('🗺️ BOUNDS CHANGED - Polygons will update after zoom completes:', {
            newCenter: `${JSON.stringify(clampedCenter)}`,
            newZoom: newZoom,
            isZooming: Math.abs(newZoom - zoom) > 0.1,
            testPolygonLocation: 'NYC [40.7589, -73.9851]',
            status: 'Polygons frozen during zoom, will update after 500ms delay'
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
        dprs={[1, 2]} // Prioritize map tile rendering
        metaWheelZoom={false} // Disable meta+wheel for more predictable behavior
      >
        {/* PRIORITY 1: Base map tiles are rendered first automatically by pigeon-maps */}
        
        {/* PRIORITY 2: GBIF Occurrence Tiles as Overlays - render early */}
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

        {/* PRIORITY 3: Test polygon - render after tiles but before user polygons */}
        {/* TEST POLYGON: Fixed geographic coordinates with consistent size - COMMENTED OUT FOR PRODUCTION
        {!isZooming && (
          <Overlay anchor={[40.7589, -73.9851]} offset={[0, 0]}>
            <div style={{ pointerEvents: 'none' }}>
              <svg width="400" height="400" style={{ overflow: 'visible' }}>
                {(() => {
                  // Calculate geographic size that stays consistent across zoom levels
                  // Define polygon in terms of lat/lng offsets (about 2-3 degrees = ~200-300km)
                  const testPolygonCoords: [number, number][] = [
                    [40.7589, -73.9851],        // anchor point (NYC center)
                    [40.7589, -71.9851],        // ~200km east
                    [42.7589, -71.9851],        // ~200km north, ~200km east  
                    [42.7589, -75.9851],        // ~200km north, ~200km west
                    [40.7589, -75.9851],        // back to west side (~200km west)
                  ];
                  
                  // Convert all coordinates to pixels relative to anchor
                  const anchorLat = 40.7589;
                  const anchorLng = -73.9851;
                  
                  const pixelPoints = testPolygonCoords.map(([lat, lng]) => {
                    // Calculate offset from anchor in meters, then convert to pixels
                    const latDiff = lat - anchorLat;
                    const lngDiff = lng - anchorLng;
                    
                    // Rough conversion: 1 degree ≈ 111km, adjust for latitude
                    const metersPerDegLat = 111000;
                    const metersPerDegLng = 111000 * Math.cos(anchorLat * Math.PI / 180);
                    
                    const offsetMetersY = latDiff * metersPerDegLat;
                    const offsetMetersX = lngDiff * metersPerDegLng;
                    
                    // Convert meters to pixels at current zoom
                    const metersPerPixel = 40075016.686 / (256 * Math.pow(2, zoom)) / Math.cos(anchorLat * Math.PI / 180);
                    const pixelX = offsetMetersX / metersPerPixel;
                    const pixelY = -offsetMetersY / metersPerPixel; // Negative because SVG Y increases downward
                    
                    return `${pixelX},${pixelY}`;
                  }).join(' ');
                  
                  // Calculate text position that scales with zoom
                  const metersPerPixel = 40075016.686 / (256 * Math.pow(2, zoom)) / Math.cos(anchorLat * Math.PI / 180);
                  const textOffset = 50000 / metersPerPixel; // 50km offset for text
                  const fontSize = Math.max(10, Math.min(24, 16 * Math.pow(2, zoom - 8))); // Scale font with zoom
                  
                  return (
                    <>
                      <polygon
                        points={pixelPoints}
                        fill="rgba(255, 0, 0, 0.3)"
                        stroke="#ff0000"
                        strokeWidth="3"
                        strokeDasharray="10,5"
                      />
                      <text x={textOffset} y={textOffset} fill="#ff0000" fontSize={fontSize} fontWeight="bold">
                        TEST POLYGON
                      </text>
                      <text x={textOffset} y={textOffset + fontSize + 5} fill="#ff0000" fontSize={fontSize * 0.8}>
                        Geographic size ~200km²
                      </text>
                      <text x={textOffset} y={textOffset + 2 * (fontSize + 5)} fill="#ff0000" fontSize={fontSize * 0.8}>
                        Should NOT change size on zoom
                      </text>
                    </>
                  );
                })()}
              </svg>
            </div>
          </Overlay>
        )}
        */}

        {/* PRIORITY 4: Annotation rule polygons - render before user polygons for proper layering */}
        {!isZooming && showAnnotationRules && annotationRules.map((rule) => {
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
          
          // Find the first coordinate to use as anchor point
          const firstPolygon = rule.multiPolygon.polygons[0];
          if (!firstPolygon || !firstPolygon.outer || firstPolygon.outer.length === 0) {
            return null;
          }
          
          const [anchorLat, anchorLng] = firstPolygon.outer[0];
          
          return (
            <Overlay key={`rule-overlay-${rule.id}`} anchor={[anchorLat, anchorLng]} offset={[0, 0]}>
              <div style={{ pointerEvents: 'none' }}>
                <svg width="8000" height="8000" style={{ overflow: 'visible' }}>
                  {(() => {
                    // Build SVG path for all polygons in the multipolygon using geographic coordinates
                    const [anchorPixelX, anchorPixelY] = latLngToPixel(anchorLat, anchorLng);
                    let path = '';
                    
                    // Render each polygon
                    rule.multiPolygon!.polygons.forEach((polygonWithHoles) => {
                      // Outer ring
                      const outerPixels = polygonWithHoles.outer.map(([lat, lng]) => {
                        const [pixelX, pixelY] = latLngToPixel(lat, lng);
                        const offsetX = pixelX - anchorPixelX;
                        const offsetY = pixelY - anchorPixelY;
                        return [offsetX, offsetY];
                      });
                      path += `M ${outerPixels.map(([x, y]) => `${x},${y}`).join(' L ')} Z `;
                      
                      // Holes
                      polygonWithHoles.holes.forEach((hole) => {
                        const holePixels = hole.map(([lat, lng]) => {
                          const [pixelX, pixelY] = latLngToPixel(lat, lng);
                          const offsetX = pixelX - anchorPixelX;
                          const offsetY = pixelY - anchorPixelY;
                          return [offsetX, offsetY];
                        });
                        path += `M ${holePixels.map(([x, y]) => `${x},${y}`).join(' L ')} Z `;
                      });
                    });
                    
                    return (
                      <path
                        d={path}
                        fill={colorSet.fill}
                        fillOpacity="0.15"
                        stroke={colorSet.stroke}
                        strokeWidth="2.5"
                        strokeDasharray="8,4"
                        fillRule="evenodd"
                      />
                    );
                  })()}
                </svg>
              </div>
            </Overlay>
          );
        })}

        {/* PRIORITY 5: Saved polygons - render after annotation rules */}
        {!isZooming && savedPolygons.map((polygonData) => {
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
          
          // Normalize coordinates to array of polygons
          const polygonParts: [number, number][][] = polygonData.isMultiPolygon 
            ? (polygonData.coordinates as [number, number][][])
            : [polygonData.coordinates as [number, number][]];

          // Use the first coordinate of the first part as anchor
          const firstPart = polygonParts[0];
          if (!firstPart || firstPart.length === 0) return null;
          
          const [anchorLat, anchorLng] = firstPart[0];
          const isEditing = editingPolygonId === polygonData.id;
          
          return (
            <Overlay key={`overlay-${polygonData.id}`} anchor={[anchorLat, anchorLng]} offset={[0, 0]}>
              <div 
                style={{ 
                  pointerEvents: 'auto',
                  cursor: draggingPolygon?.id === polygonData.id ? 'grabbing' : 
                          draggingVertex ? 'default' : 
                          isEditing && isMoveToolActive ? 'grab' : 'default'
                }}
                onMouseDown={(e) => {
                  // Only allow polygon dragging when in editing mode AND move tool is active
                  if (!isEditing || !isMoveToolActive || draggingVertex) return;
                  
                  e.stopPropagation();
                  const rect = mapContainerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  
                  const startPos: [number, number] = [e.clientX - rect.left, e.clientY - rect.top];
                  setDraggingPolygon({
                    id: polygonData.id,
                    startPos,
                    startCoords: polygonData.coordinates
                  });
                }}
              >
                <svg width="4000" height="4000" style={{ overflow: 'visible' }}>
                  {polygonData.inverted ? (
                    (() => {
                      // Create inverted polygon using SVG path with fillRule="evenodd"
                      const margin = 200000; // Large margin in pixels
                      let pathStr = `M ${-margin},${-margin} L ${margin},${-margin} L ${margin},${margin} L ${-margin},${margin} Z`;
                      
                      // Add all polygon parts as holes
                      polygonParts.forEach(polyCoords => {
                        // Use the exact same coordinate conversion as the drawing preview
                        const [anchorPixelX, anchorPixelY] = latLngToPixel(anchorLat, anchorLng);
                        
                        const pixelPoints = polyCoords.map(([lat, lng]) => {
                          // Use the exact same coordinate conversion as the drawing preview
                          const [pixelX, pixelY] = latLngToPixel(lat, lng);
                          
                          // Calculate offset relative to anchor point
                          const offsetX = pixelX - anchorPixelX;
                          const offsetY = pixelY - anchorPixelY;
                          
                          return `${offsetX},${offsetY}`;
                        }).join(' ');
                        
                        pathStr += ` M ${pixelPoints} Z`;
                      });
                      
                      return (
                        <path
                          d={pathStr}
                          fill={color.fill}
                          fillOpacity="0.1"
                          stroke={color.stroke}
                          strokeWidth="2"
                          fillRule="evenodd"
                        />
                      );
                    })()
                  ) : (
                    <>
                      {polygonParts.map((polyCoords, partIndex) => {
                        // Use the exact same coordinate conversion as the drawing preview
                        const [anchorPixelX, anchorPixelY] = latLngToPixel(anchorLat, anchorLng);
                        
                        const pixelPoints = polyCoords.map(([lat, lng]) => {
                          // Use the exact same coordinate conversion as the drawing preview
                          const [pixelX, pixelY] = latLngToPixel(lat, lng);
                          
                          // Calculate offset relative to anchor point
                          const offsetX = pixelX - anchorPixelX;
                          const offsetY = pixelY - anchorPixelY;
                          
                          return `${offsetX},${offsetY}`;
                        }).join(' ');
                        
                        return (
                          <polygon
                            key={`${polygonData.id}-part-${partIndex}`}
                            points={pixelPoints}
                            fill={color.fill}
                            fillOpacity="0.1"
                            stroke={color.stroke}
                            strokeWidth="2"
                          />
                        );
                      })}
                    </>
                  )}
                  
                  {/* Render vertices when editing */}
                  {isEditing && !isZooming && !draggingPolygon && polygonParts.map((polyCoords, partIndex) => {
                    const [anchorPixelX, anchorPixelY] = latLngToPixel(anchorLat, anchorLng);
                    
                    return polyCoords.map((coord, vertexIndex) => {
                      const [lat, lng] = coord;
                      const [pixelX, pixelY] = latLngToPixel(lat, lng);
                      const offsetX = pixelX - anchorPixelX;
                      const offsetY = pixelY - anchorPixelY;
                      
                      // Calculate global vertex index for multipolygon
                      let globalVertexIndex = vertexIndex;
                      for (let i = 0; i < partIndex; i++) {
                        globalVertexIndex += polygonParts[i].length;
                      }
                      
                      return (
                        <circle
                          key={`vertex-${partIndex}-${vertexIndex}`}
                          cx={offsetX}
                          cy={offsetY}
                          r="6"
                          fill="white"
                          stroke={color.stroke}
                          strokeWidth="2"
                          style={{ 
                            cursor: 'move',
                            pointerEvents: 'auto',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDraggingVertex({ 
                              polygonId: polygonData.id, 
                              index: globalVertexIndex 
                            });
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Don't allow deletion if polygon would have less than 3 vertices
                            const totalVertices = polygonParts.reduce((sum, part) => sum + part.length, 0);
                            if (totalVertices <= 3) {
                              toast.error('Cannot delete vertex: polygon must have at least 3 vertices');
                              return;
                            }
                            
                            // Remove the vertex
                            if (onUpdatePolygon) {
                              if (polygonData.isMultiPolygon) {
                                const coords = polygonData.coordinates as [number, number][][];
                                const newCoords = [...coords];
                                newCoords[partIndex] = newCoords[partIndex].filter((_, i) => i !== vertexIndex);
                                
                                // Remove empty parts
                                const filteredCoords = newCoords.filter(part => part.length >= 3);
                                if (filteredCoords.length > 0) {
                                  onUpdatePolygon(polygonData.id, filteredCoords);
                                }
                              } else {
                                const coords = polygonData.coordinates as [number, number][];
                                const newCoords = coords.filter((_, i) => i !== vertexIndex);
                                if (newCoords.length >= 3) {
                                  onUpdatePolygon(polygonData.id, newCoords);
                                }
                              }
                            }
                          }}
                        />
                      );
                    });
                  })}
                  
                  {/* Render edge midpoints for adding vertices when editing */}
                  {isEditing && !isZooming && !draggingPolygon && !draggingVertex && polygonParts.map((polyCoords, partIndex) => {
                    const [anchorPixelX, anchorPixelY] = latLngToPixel(anchorLat, anchorLng);
                    
                    return polyCoords.map((coord, vertexIndex) => {
                      const nextIndex = (vertexIndex + 1) % polyCoords.length;
                      const [lat1, lng1] = coord;
                      const [lat2, lng2] = polyCoords[nextIndex];
                      
                      // Calculate midpoint
                      const midLat = (lat1 + lat2) / 2;
                      const midLng = (lng1 + lng2) / 2;
                      
                      const [midPixelX, midPixelY] = latLngToPixel(midLat, midLng);
                      const offsetX = midPixelX - anchorPixelX;
                      const offsetY = midPixelY - anchorPixelY;
                      
                      return (
                        <circle
                          key={`edge-${partIndex}-${vertexIndex}`}
                          cx={offsetX}
                          cy={offsetY}
                          r="4"
                          fill={color.fill}
                          stroke={color.stroke}
                          strokeWidth="1"
                          style={{ 
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            opacity: 0.7
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            
                            // Add new vertex at midpoint
                            if (onUpdatePolygon) {
                              if (polygonData.isMultiPolygon) {
                                const coords = polygonData.coordinates as [number, number][][];
                                const newCoords = [...coords];
                                newCoords[partIndex] = [
                                  ...newCoords[partIndex].slice(0, nextIndex),
                                  [midLat, midLng] as [number, number],
                                  ...newCoords[partIndex].slice(nextIndex)
                                ];
                                onUpdatePolygon(polygonData.id, newCoords);
                              } else {
                                const coords = polygonData.coordinates as [number, number][];
                                const newCoords = [
                                  ...coords.slice(0, nextIndex),
                                  [midLat, midLng] as [number, number],
                                  ...coords.slice(nextIndex)
                                ];
                                onUpdatePolygon(polygonData.id, newCoords);
                              }
                            }
                          }}
                        />
                      );
                    });
                  })}
                </svg>
              </div>
            </Overlay>
          );
        })}

        {/* PRIORITY 6: Current user-drawn polygon - render last for top visibility */}
        {!isZooming && currentPolygon && currentPolygon.length >= 3 && (() => {
          // Use the first coordinate as anchor point
          const [anchorLat, anchorLng] = currentPolygon[0];
          
          return (
            <Overlay anchor={[anchorLat, anchorLng]} offset={[0, 0]}>
              <div style={{ pointerEvents: 'auto' }}>
                <svg width="2000" height="2000" style={{ overflow: 'visible' }}>
                  {(() => {
                    // Convert all coordinates to pixels relative to anchor - USE SAME METHOD AS DRAWING PREVIEW
                    const [anchorPixelX, anchorPixelY] = latLngToPixel(anchorLat, anchorLng);
                    
                    const pixelPoints = currentPolygon.map(([lat, lng]) => {
                      // Use the exact same coordinate conversion as the drawing preview
                      const [pixelX, pixelY] = latLngToPixel(lat, lng);
                      
                      // Calculate offset relative to anchor point
                      const offsetX = pixelX - anchorPixelX;
                      const offsetY = pixelY - anchorPixelY;
                      
                      return `${offsetX},${offsetY}`;
                    }).join(' ');
                    
                    const annotationColors: { [key: string]: { fill: string; stroke: string } } = {
                      SUSPICIOUS: { fill: '#ef4444', stroke: '#dc2626' },
                      NATIVE: { fill: '#10b981', stroke: '#059669' },
                      MANAGED: { fill: '#3b82f6', stroke: '#2563eb' },
                      FORMER: { fill: '#a855f7', stroke: '#9333ea' },
                      VAGRANT: { fill: '#f97316', stroke: '#ea580c' },
                    };
                    const color = annotationColors[currentAnnotation.toUpperCase()] || annotationColors.SUSPICIOUS;
                    
                    return (
                      <>
                        {isCurrentInverted ? (
                          (() => {
                            // Create inverted polygon using SVG path with fillRule="evenodd"
                            const margin = 100000; // Large margin in pixels
                            let pathStr = `M ${-margin},${-margin} L ${margin},${-margin} L ${margin},${margin} L ${-margin},${margin} Z`;
                            pathStr += ` M ${pixelPoints} Z`;
                            
                            return (
                              <path
                                d={pathStr}
                                fill={color.fill}
                                fillOpacity="0.2"
                                stroke={color.stroke}
                                strokeWidth="2"
                                fillRule="evenodd"
                              />
                            );
                          })()
                        ) : (
                          <polygon
                            points={pixelPoints}
                            fill={color.fill}
                            fillOpacity="0.2"
                            stroke={color.stroke}
                            strokeWidth="2"
                          />
                        )}
                        
                        {/* Render vertices for current polygon */}
                        {!draggingPolygon && currentPolygon.map((coord, vertexIndex) => {
                          const [lat, lng] = coord;
                          const [pixelX, pixelY] = latLngToPixel(lat, lng);
                          const offsetX = pixelX - anchorPixelX;
                          const offsetY = pixelY - anchorPixelY;
                          
                          return (
                            <circle
                              key={`current-vertex-${vertexIndex}`}
                              cx={offsetX}
                              cy={offsetY}
                              r="6"
                              fill="white"
                              stroke={color.stroke}
                              strokeWidth="2"
                              style={{ 
                                cursor: 'move',
                                pointerEvents: 'auto',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setDraggingVertex({ 
                                  polygonId: 'current', 
                                  index: vertexIndex 
                                });
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCurrentVertexRightClick(e, vertexIndex);
                              }}
                            />
                          );
                        })}
                        
                        {/* Render edge midpoints for adding vertices to current polygon */}
                        {!draggingPolygon && !draggingVertex && currentPolygon.map((coord, vertexIndex) => {
                          const nextIndex = (vertexIndex + 1) % currentPolygon.length;
                          const [lat1, lng1] = coord;
                          const [lat2, lng2] = currentPolygon[nextIndex];
                          
                          // Calculate midpoint
                          const midLat = (lat1 + lat2) / 2;
                          const midLng = (lng1 + lng2) / 2;
                          
                          const [midPixelX, midPixelY] = latLngToPixel(midLat, midLng);
                          const offsetX = midPixelX - anchorPixelX;
                          const offsetY = midPixelY - anchorPixelY;
                          
                          return (
                            <circle
                              key={`current-edge-${vertexIndex}`}
                              cx={offsetX}
                              cy={offsetY}
                              r="4"
                              fill={color.fill}
                              stroke={color.stroke}
                              strokeWidth="1"
                              style={{ 
                                cursor: 'pointer',
                                pointerEvents: 'auto',
                                opacity: 0.7
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleCurrentEdgeClick(e, vertexIndex);
                              }}
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </Overlay>
          );
        })()}

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

      {/* SVG Overlay for Drawing Points and Interactive Elements ONLY */}
      {mapSize.width > 0 && mapSize.height > 0 && (
        <svg 
          ref={svgRef}
          className="absolute inset-0 pointer-events-none w-full h-full z-[1]"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          {/* Simplified SVG - polygons now rendered as Overlays above */}
          <g>
            {/* NOTE: Saved polygons and current polygon now rendered as Map Overlays for perfect synchronization */}
            {/* NOTE: Annotation rule polygons now rendered as Map Overlays for perfect synchronization */}

            {/* REMOVED: Saved polygons - now rendered as Map Overlays for perfect synchronization */}

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

            {/* REMOVED: Saved Polygon Edge Midpoints - now using polygon drag instead */}

            {/* REMOVED: Saved Polygon Vertices - now using polygon drag instead */}



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

            {/* REMOVED: Current polygon - now rendered as Map Overlay for perfect synchronization */}

            {/* REMOVED: Current Polygon Vertices - TODO: implement editing overlay */}
            
            {/* REMOVED: currentPolygon?.map - now rendered as Map Overlay */}

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

      {/* Map Controls - Always visible */}
      <div 
        className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 flex flex-col gap-2 z-20"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drawing Tools - Always visible */}
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
            <Button 
              onClick={() => {
                createLatitudeBand();
              }} 
              size="icon" 
              variant="outline"
              title="Create Latitude Band"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h18M3 16h18"/>
              </svg>
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
                className="flex flex-col gap-1 bg-white rounded border shadow-sm px-1 py-1 relative z-30"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 relative z-40"
                  style={{ pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInvestigateRadius(Math.min(100000, investigateRadius + 1000));
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={investigateRadius >= 100000}
                  title="Increase radius"
                >
                  <Plus className="w-3 h-3" />
                </Button>
                <span className="text-xs font-medium text-center py-1 relative z-40" style={{ pointerEvents: 'none' }}>
                  {(investigateRadius / 1000).toFixed(0)}km
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 relative z-40"
                  style={{ pointerEvents: 'auto' }}
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
            
            {/* Current polygon controls */}
            {currentPolygon && (
              <>
                {/* Latitude Band Controls - separate upper/lower when band is active */}
                {showLatBandControls && (
                  <div className="flex flex-col gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-1">
                    <span className="text-xs font-medium text-blue-700 text-center">Latitude Band</span>
                    
                    {/* Upper bound controls */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-blue-600 w-8">N:</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-blue-600 hover:bg-blue-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustLatitudeBandUpper(1);
                        }}
                        title="Move upper bound north"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <span className="text-xs font-medium text-blue-700 min-w-[2.5rem] text-center">
                        {latBandUpper.toFixed(1)}°
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-blue-600 hover:bg-blue-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustLatitudeBandUpper(-1);
                        }}
                        title="Move upper bound south"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Lower bound controls */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-blue-600 w-8">S:</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-blue-600 hover:bg-blue-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustLatitudeBandLower(1);
                        }}
                        title="Move lower bound north"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <span className="text-xs font-medium text-blue-700 min-w-[2.5rem] text-center">
                        {latBandLower.toFixed(1)}°
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-blue-600 hover:bg-blue-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustLatitudeBandLower(-1);
                        }}
                        title="Move lower bound south"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
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

            {/* Edit buttons for existing polygons */}
            {savedPolygons.length > 0 && !editingPolygonId && (
              <>
                <div className="w-full h-px bg-gray-200 my-1" />
                <div className="px-2 py-1 text-xs text-gray-600 font-medium">Edit:</div>
                {savedPolygons.map((polygon) => (
                  <Button
                    key={polygon.id}
                    onClick={() => onEditPolygon && onEditPolygon(polygon.id)}
                    size="icon"
                    variant="outline"
                    title={`Edit polygon ${polygon.id.slice(0, 8)}...`}
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                ))}
              </>
            )}

            {/* Editing Tools - show when in edit mode */}
            {editingPolygonId && (
              <>
                <div className="w-full h-px bg-gray-200 my-1" />
                <div className="px-2 py-1 text-xs text-gray-600 font-medium">Tools:</div>
                <Button 
                  onClick={() => onEditPolygon && onEditPolygon(editingPolygonId)}
                  size="icon" 
                  variant="default"
                  title="Done editing"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button 
                  onClick={() => setIsMoveToolActive(!isMoveToolActive)}
                  size="icon" 
                  variant={isMoveToolActive ? "default" : "outline"}
                  title={isMoveToolActive ? "Disable move tool" : "Enable move tool - drag polygon to move"}
                  className={isMoveToolActive ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  <Hand className="w-5 h-5" />
                </Button>
                <Button 
                  onClick={addMidpointVertices} 
                  size="icon" 
                  variant="outline"
                  title="Add midpoint vertices to all edges"
                >
                  <GitBranch className="w-5 h-5" />
                </Button>
                <Button 
                  onClick={removeMidpointVertices} 
                  size="icon" 
                  variant="outline"
                  title="Remove alternating vertices"
                >
                  <Scissors className="w-5 h-5" />
                </Button>
                {onToggleInvert && (
                  <Button 
                    onClick={() => onToggleInvert(editingPolygonId)}
                    size="icon" 
                    variant="outline"
                    title="Invert polygon (toggle inside/outside)"
                  >
                    <Repeat className="w-5 h-5" />
                  </Button>
                )}
                {onDeletePolygon && (
                  <Button 
                    onClick={() => onDeletePolygon(editingPolygonId)}
                    size="icon" 
                    variant="outline"
                    title="Delete polygon"
                    className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="px-2 py-1 text-xs text-gray-600 whitespace-nowrap">
              {drawingMode === 'polygon' && `${drawingPoints.length} pts`}
              {drawingMode === 'rectangle' && drawingPoints.length === 0 && '1st corner'}
              {drawingMode === 'rectangle' && drawingPoints.length === 1 && '2nd corner'}
              {drawingMode === 'latband' && 'Latitude band created'}
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

      {/* Investigation Results Dialog */}
      <Dialog open={isInvestigateDialogOpen} onOpenChange={setIsInvestigateDialogOpen}>
        <DialogContent 
          className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isInvestigateLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <MapPin className="w-5 h-5" />
              )}
              Area Investigation Results
              {isInvestigateLoading && (
                <span className="text-sm font-normal text-gray-500">(Loading...)</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedSpecies && investigationPoint && (
                <>
                  {isInvestigateLoading ? 'Searching for' : 'Occurrences of'} <em>{selectedSpecies.scientificName}</em> near{' '}
                  {investigationPoint.lat.toFixed(4)}, {investigationPoint.lng.toFixed(4)} 
                  ({(investigateRadius/1000)}km radius)
                  {!isInvestigateLoading && investigateResults.length > 0 && (
                    <span className="block mt-1 text-green-600">
                      Found {investigateResults.length} occurrence{investigateResults.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="pr-4 space-y-4">
              {isInvestigateLoading ? (
                <>
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Searching for occurrences...</span>
                  </div>
                  {investigateResults.length > 0 && (
                    <>
                      <div className="text-sm text-gray-600 text-center">
                        Loading details for {investigateResults.length} occurrence{investigateResults.length !== 1 ? 's' : ''}...
                      </div>
                      {investigateResults.map((occurrence) => (
                        <Card key={occurrence.key} className="p-4 opacity-80">
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
                                  <Database className="w-8 h-8 text-gray-400" />
                                </div>
                              )}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium text-gray-900 truncate">
                                    {occurrence.scientificName}
                                  </h4>
                                  <div className="text-sm text-gray-500 space-y-1 mt-1">
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {occurrence.decimalLatitude?.toFixed(4)}, {occurrence.decimalLongitude?.toFixed(4)}
                                      {investigationPoint && (
                                        <span className="ml-2">
                                          ({getDistanceString(occurrence.decimalLatitude, occurrence.decimalLongitude)})
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {formatDate(occurrence.eventDate)}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Loading...
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </>
                  )}
                </>
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
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </div>
  );
}

