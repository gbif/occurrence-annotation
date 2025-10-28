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
}: MapComponentProps) {
  const [center, setCenter] = useState<[number, number]>([20, 0]);
  const [zoom, setZoom] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState<'polygon' | 'rectangle'>('polygon');
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [gbifTiles, setGbifTiles] = useState<Array<{ x: number; y: number; z: number; anchor: [number, number]; url: string }>>([]);
  const [isZooming, setIsZooming] = useState(false);
  const [mapTransform, setMapTransform] = useState<string>('');
  const [draggingVertex, setDraggingVertex] = useState<{ polygonId: string; index: number } | null>(null);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [dragCurrent, setDragCurrent] = useState<[number, number] | null>(null);
  const [isEditingCurrent, setIsEditingCurrent] = useState(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  
  // Investigate mode state
  const [isInvestigateMode, setIsInvestigateMode] = useState(false);
  const [investigateRadius, setInvestigateRadius] = useState(5000);
  const [isInvestigateLoading, setIsInvestigateLoading] = useState(false);
  const [investigateResults, setInvestigateResults] = useState<any[]>([]);
  const [isInvestigateDialogOpen, setIsInvestigateDialogOpen] = useState(false);
  const [investigationPoint, setInvestigationPoint] = useState<{ lat: number; lng: number } | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const zoomTimeoutRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationFrameRef = useRef<number | null>(null);

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
  
  // Stable refs for positioning polygons - only update when drag/zoom ends
  const stableCenter = useRef<[number, number]>(center);
  const stableZoom = useRef<number>(zoom);

  // Mirror pigeon-maps transform to SVG overlay
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const syncTransform = () => {
      // Find the pigeon-maps tiles container which gets the transform applied
      const tilesContainer = mapContainerRef.current?.querySelector('.pigeon-tiles') as HTMLElement;
      
      if (tilesContainer) {
        const computedStyle = window.getComputedStyle(tilesContainer);
        const transform = computedStyle.transform;
        
        if (transform && transform !== 'none') {
          setMapTransform(transform);
        } else {
          setMapTransform('');
        }
      } else {
        // If tiles container not found yet, retry on next frame
        setMapTransform('');
      }
      
      animationFrameRef.current = requestAnimationFrame(syncTransform);
    };

    // Small delay to ensure pigeon-maps has initialized
    const timeoutId = setTimeout(() => {
      syncTransform();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

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
        setGbifTiles([]);
        setIsZooming(true);
        
        // Clear any existing timeout
        if (zoomTimeoutRef.current) {
          clearTimeout(zoomTimeoutRef.current);
        }
        
        // Set timeout to end zooming state
        zoomTimeoutRef.current = window.setTimeout(() => {
          setIsZooming(false);
        }, 500);
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

  // Investigate area function
  const investigateArea = async (lat: number, lng: number) => {
    if (!selectedSpecies || !isInvestigateMode) {
      return;
    }
    
    setInvestigationPoint({ lat, lng });
    setIsInvestigateLoading(true);
    setIsInvestigateDialogOpen(true);
    
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
        toast.info(`No occurrences found for ${selectedSpecies.scientificName} within ${investigateRadius/1000}km of this location`);
      } else {
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
      const [ourScreenX, ourScreenY] = latLngToStablePixel(lat, lng);
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

  // Convert world coordinates to pixel coordinates relative to the viewport
  const worldToPixel = (worldX: number, worldY: number): [number, number] => {
    const [centerWorldX, centerWorldY] = latLngToWorld(center[0], center[1], zoom);
    const pixelX = worldX - centerWorldX + mapSize.width / 2;
    const pixelY = worldY - centerWorldY + mapSize.height / 2;
    return [pixelX, pixelY];
  };

  // Convert lat/lng directly to pixel coordinates for SVG
  const latLngToPixel = (lat: number, lng: number): [number, number] => {
    const [worldX, worldY] = latLngToWorld(lat, lng, zoom);
    return worldToPixel(worldX, worldY);
  };

  // Initialize stable refs on mount and update them when drag/zoom ends
  useEffect(() => {
    // Initialize on mount
    if (stableCenter.current[0] === 20 && stableCenter.current[1] === 0 && stableZoom.current === 2) {
      stableCenter.current = center;
      stableZoom.current = zoom;
      return;
    }
    
    // Update when zoom changes (discrete zoom levels)
    if (stableZoom.current !== zoom) {
      stableZoom.current = zoom;
      stableCenter.current = center;
    }
    // Update when transform clears (end of drag)
    else if (!mapTransform && (stableCenter.current[0] !== center[0] || stableCenter.current[1] !== center[1])) {
      stableCenter.current = center;
    }
  }, [center, zoom, mapTransform, gbifTiles.length]);

  // Calculate our own transform offset
  // This is the pixel difference needed to keep stable elements at their geographic positions
  const calculateTransformOffset = (): [number, number] => {
    if (!mapTransform) return [0, 0];
    
    // If we position an element using stable center, but the map is now showing a different center,
    // we need to offset by the world coordinate difference
    const [stableWorldX, stableWorldY] = latLngToWorld(stableCenter.current[0], stableCenter.current[1], zoom);
    const [currentCenterWorldX, currentCenterWorldY] = latLngToWorld(center[0], center[1], zoom);
    
    // Offset in pixels: move by the difference in world coords
    // Negative because if center moved right, we need to move elements left to stay in place
    const offsetX = -(currentCenterWorldX - stableWorldX);
    const offsetY = -(currentCenterWorldY - stableWorldY);
    
    // console.log('Transform offset:', { offsetX, offsetY, stableCenter: stableCenter.current, center });
    
    return [offsetX, offsetY];
  };

  // Stable version - uses stable center/zoom for consistent positioning during drag
  // This is used for all saved polygons and annotation rules
  const latLngToStablePixel = (lat: number, lng: number): [number, number] => {
    const [worldX, worldY] = latLngToWorld(lat, lng, stableZoom.current);
    const [centerWorldX, centerWorldY] = latLngToWorld(stableCenter.current[0], stableCenter.current[1], stableZoom.current);
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
    
    // Inverse Web Mercator transformation
    const worldYNorm = worldY / scale;
    const mercatorY = Math.PI * (1 - 2 * worldYNorm);
    const latRad = 2 * (Math.atan(Math.exp(mercatorY)) - Math.PI / 4);
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

  // Helper to convert pixel coordinates to lat/lng
  // Uses stable center/zoom for consistency with transformed rendering
  const pixelToLatLng = (x: number, y: number): [number, number] => {
    const stableZoomValue = stableZoom.current;
    const stableCenterValue = stableCenter.current;
    
    const [centerWorldX, centerWorldY] = latLngToWorld(stableCenterValue[0], stableCenterValue[1], stableZoomValue);
    const worldX = centerWorldX + (x - mapSize.width / 2);
    const worldY = centerWorldY + (y - mapSize.height / 2);
    
    const scale = 256 * Math.pow(2, stableZoomValue);
    const lng = (worldX / scale) * 360 - 180;
    const worldYNorm = worldY / scale;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * worldYNorm)));
    const lat = latRad * 180 / Math.PI;
    
    return [lat, lng];
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
    const [lat, lng] = pixelToLatLng(x, y);
    
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
    const [lat, lng] = pixelToLatLng(x, y);
    
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
            const latLng = pixelToLatLng(x, y);
            console.log('🗺️ Container calculated coordinates:', latLng);
            handleMapClick({ latLng });
          }
        }
      }}
    >
      <Map
        center={center}
        zoom={zoom}
        onBoundsChanged={({ center, zoom: newZoom }) => {
          // Clamp center to Web Mercator bounds
          const clampedCenter: [number, number] = [
            clampLatitude(center[0]), // Clamp latitude
            center[1] // Longitude can wrap around
          ];
          
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
          {/* Apply calculated transform to keep stable elements in sync during drag */}
          <g
            style={{
              transform: mapTransform ? `translate(${calculateTransformOffset()[0]}px, ${calculateTransformOffset()[1]}px)` : 'none',
              transformOrigin: '0 0',
            }}
          >
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
                  const outerPixels = polygonWithHoles.outer.map(([lat, lng]) => latLngToStablePixel(lat, lng));
                  path += `M ${outerPixels.map(([x, y]) => `${x},${y}`).join(' L ')} Z `;
                  
                  // Holes
                  polygonWithHoles.holes.forEach((hole) => {
                    const holePixels = hole.map(([lat, lng]) => latLngToStablePixel(lat, lng));
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
                  const holePixels = polyCoords.map(([lat, lng]) => latLngToStablePixel(lat, lng));
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
                          const [x, y] = latLngToStablePixel(lat, lng);
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

            {/* DEBUG: Coordinate markers for annotation polygons */}
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
                      {/* Coordinate marker point */}
                      <circle
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#ff0000"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                      {/* Coordinate label */}
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

            {/* DEBUG: Map reference grid points */}
            {(() => {
              const refPoints = [];
              const centerLat = center[0];
              const centerLng = center[1];
              
              // Calculate current map bounds at the current zoom level
              const WEB_MERCATOR_MAX_LAT = 85.0511287798;
              const mapBounds = {
                north: Math.min(WEB_MERCATOR_MAX_LAT, centerLat + (90 / Math.pow(2, zoom - 1))),
                south: Math.max(-WEB_MERCATOR_MAX_LAT, centerLat - (90 / Math.pow(2, zoom - 1))),
                east: centerLng + (180 / Math.pow(2, zoom - 1)),
                west: centerLng - (180 / Math.pow(2, zoom - 1))
              };
              
              // Add center point marker
              const [centerX, centerY] = latLngToStablePixel(centerLat, centerLng);
              refPoints.push(
                <g key="center-point">
                  <circle
                    cx={centerX}
                    cy={centerY}
                    r="6"
                    fill="#ff00ff"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={centerX + 10}
                    y={centerY - 10}
                    fontSize="12"
                    fill="#ff00ff"
                    fontWeight="bold"
                    style={{ fontFamily: 'monospace' }}
                  >
                    CENTER: {centerLat.toFixed(6)}, {centerLng.toFixed(6)}
                  </text>
                  <text
                    x={centerX + 10}
                    y={centerY + 5}
                    fontSize="10"
                    fill="#ff00ff"
                    style={{ fontFamily: 'monospace' }}
                  >
                    Zoom: {zoom} | Bounds: {mapBounds.north.toFixed(2)}°N to {mapBounds.south.toFixed(2)}°S
                  </text>
                </g>
              );

              // Add specific test markers for Web Mercator limits and coordinate debugging
              const testPoints = [
                { lat: 85.0511287798, lng: 0, label: '85.05°N (WM Max)', color: '#ff0000' },
                { lat: -85.0511287798, lng: 0, label: '85.05°S (WM Min)', color: '#ff0000' },
                { lat: 84, lng: 0, label: '84°N', color: '#ff4444' },
                { lat: -84, lng: 0, label: '84°S', color: '#ff4444' },
                { lat: 80, lng: 0, label: '80°N', color: '#00ff00' },
                { lat: -80, lng: 0, label: '80°S', color: '#00ff00' },
                { lat: 60, lng: 0, label: '60°N', color: '#44ff44' },
                { lat: -60, lng: 0, label: '60°S', color: '#44ff44' },
                { lat: 0, lng: 0, label: 'Equator', color: '#0000ff' },
              ];

              testPoints.forEach((point, idx) => {
                const [x, y] = latLngToStablePixel(point.lat, point.lng);
                
                refPoints.push(
                  <g key={`test-point-${idx}`}>
                    {/* Crosshair for precise positioning */}
                    <line x1={x-10} y1={y} x2={x+10} y2={y} stroke={point.color} strokeWidth="2" opacity="0.8" />
                    <line x1={x} y1={y-10} x2={x} y2={y+10} stroke={point.color} strokeWidth="2" opacity="0.8" />
                    <circle
                      cx={x}
                      cy={y}
                      r="8"
                      fill={point.color}
                      stroke="#ffffff"
                      strokeWidth="2"
                      opacity="0.8"
                    />
                    <text
                      x={x + 12}
                      y={y - 12}
                      fontSize="11"
                      fill={point.color}
                      fontWeight="bold"
                      style={{ fontFamily: 'monospace' }}
                    >
                      {point.label}
                    </text>
                  </g>
                );
              });

              // Add Web Mercator limit lines using OUR calculation
              const limitNorth = 85.0511287798;
              const limitSouth = -85.0511287798;
              
              // Create horizontal lines at Web Mercator limits
              const leftEdge = centerLng - (180 / Math.pow(2, zoom - 1));
              const rightEdge = centerLng + (180 / Math.pow(2, zoom - 1));
              
              // Our calculated North limit line (RED)
              const [northStartX, northStartY] = latLngToStablePixel(limitNorth, leftEdge);
              const [northEndX, northEndY] = latLngToStablePixel(limitNorth, rightEdge);
              refPoints.push(
                <line
                  key="north-limit-ours"
                  x1={northStartX}
                  y1={northStartY}
                  x2={northEndX}
                  y2={northEndY}
                  stroke="#ff0000"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  opacity="0.7"
                />
              );
              
              // Our calculated South limit line (RED)
              const [southStartX, southStartY] = latLngToStablePixel(limitSouth, leftEdge);
              const [southEndX, southEndY] = latLngToStablePixel(limitSouth, rightEdge);
              refPoints.push(
                <line
                  key="south-limit-ours"
                  x1={southStartX}
                  y1={southStartY}
                  x2={southEndX}
                  y2={southEndY}
                  stroke="#ff0000"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  opacity="0.7"
                />
              );

              // Add actual tile boundary markers using standard Web Mercator tile math
              // This will show us where tiles SHOULD end according to standard formulas
              const currentTileZ = Math.floor(zoom);
              if (currentTileZ >= 1) {
                // Find the northernmost and southernmost tile bounds at current zoom
                const maxTileY = 0; // Northernmost tile at y=0
                const minTileY = Math.pow(2, currentTileZ) - 1; // Southernmost tile
                
                // Calculate actual tile boundaries
                const actualNorthLimit = tileToLatLngWebMercator(0, maxTileY, currentTileZ)[0];
                const actualSouthLimit = tileToLatLngWebMercator(0, minTileY + 1, currentTileZ)[0]; // +1 for southern edge
                
                // Only log if there's a significant mismatch
                const northDiff = Math.abs(limitNorth - actualNorthLimit);
                const southDiff = Math.abs(limitSouth - actualSouthLimit);
                if (northDiff > 1 || southDiff > 1) {
                  console.log('⚠️ COORDINATE MISMATCH:', {
                    northMismatch: northDiff.toFixed(2) + '° difference',
                    southMismatch: southDiff.toFixed(2) + '° difference',
                    gbifTilesLoaded: gbifTiles.length > 0 ? 'YES' : 'NO'
                  });
                }
                
                // Draw ACTUAL tile boundary lines (BLUE)
                const [actualNorthStartX, actualNorthStartY] = latLngToStablePixel(actualNorthLimit, leftEdge);
                const [actualNorthEndX, actualNorthEndY] = latLngToStablePixel(actualNorthLimit, rightEdge);
                refPoints.push(
                  <line
                    key="north-limit-actual"
                    x1={actualNorthStartX}
                    y1={actualNorthStartY}
                    x2={actualNorthEndX}
                    y2={actualNorthEndY}
                    stroke="#0000ff"
                    strokeWidth="3"
                    strokeDasharray="10,5"
                    opacity="0.9"
                  />
                );
                
                const [actualSouthStartX, actualSouthStartY] = latLngToStablePixel(actualSouthLimit, leftEdge);
                const [actualSouthEndX, actualSouthEndY] = latLngToStablePixel(actualSouthLimit, rightEdge);
                refPoints.push(
                  <line
                    key="south-limit-actual"
                    x1={actualSouthStartX}
                    y1={actualSouthStartY}
                    x2={actualSouthEndX}
                    y2={actualSouthEndY}
                    stroke="#0000ff"
                    strokeWidth="3"
                    strokeDasharray="10,5"
                    opacity="0.9"
                  />
                );
              }

              // Create a small grid of reference points around the center
              for (let latOffset = -0.01; latOffset <= 0.01; latOffset += 0.01) {
                for (let lngOffset = -0.01; lngOffset <= 0.01; lngOffset += 0.01) {
                  if (latOffset === 0 && lngOffset === 0) continue; // Skip center (already added)
                  
                  const refLat = centerLat + latOffset;
                  const refLng = centerLng + lngOffset;
                  const [x, y] = latLngToStablePixel(refLat, refLng);
                  
                  refPoints.push(
                    <g key={`ref-${refLat.toFixed(3)}-${refLng.toFixed(3)}`}>
                      <circle
                        cx={x}
                        cy={y}
                        r="3"
                        fill="#0000ff"
                        stroke="#ffffff"
                        strokeWidth="1"
                        opacity="0.7"
                      />
                      <text
                        x={x + 6}
                        y={y + 3}
                        fontSize="8"
                        fill="#0000ff"
                        style={{ fontFamily: 'monospace' }}
                      >
                        {`${refLat.toFixed(3)}, ${refLng.toFixed(3)}`}
                      </text>
                    </g>
                  );
                }
              }
              return refPoints;
            })()}

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
                  const [x1, y1] = latLngToStablePixel(point[0], point[1]);
                  const [x2, y2] = latLngToStablePixel(nextPoint[0], nextPoint[1]);
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
                  const [x, y] = latLngToStablePixel(point[0], point[1]);
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
            // Calculate pixel radius based on investigate radius and current zoom
            // More generous scaling to make size differences more visible
            const metersPerPixelAtEquator = 40075016.686 / (256 * Math.pow(2, zoom));
            
            // Get current center latitude for more accurate calculation
            const latCorrectionFactor = Math.cos(center[0] * Math.PI / 180);
            const metersPerPixel = metersPerPixelAtEquator / latCorrectionFactor;
            
            // Calculate base pixel radius
            const basePixelRadius = investigateRadius / metersPerPixel;
            
            // Apply more dramatic scaling with wider min/max range and better visibility
            // Scale factor makes differences more pronounced at different zoom levels
            const scaleFactor = Math.max(0.5, Math.min(3, zoom / 8)); // More responsive scaling
            const pixelRadius = Math.max(8, Math.min(200, basePixelRadius * scaleFactor));
            
            // Make crosshair size proportional to circle size
            const crosshairSize = Math.max(4, Math.min(20, pixelRadius * 0.3));
            
            console.log('🎯 Cursor Debug:', { 
              investigateRadius, 
              zoom, 
              metersPerPixel: metersPerPixel.toFixed(1), 
              basePixelRadius: basePixelRadius.toFixed(1), 
              scaleFactor: scaleFactor.toFixed(2),
              finalPixelRadius: pixelRadius.toFixed(1) 
            });
            
            return (
              <g className="pointer-events-none">
                {/* Outer circle representing search radius */}
                <circle
                  cx={mousePosition.x}
                  cy={mousePosition.y}
                  r={pixelRadius}
                  fill="rgba(59, 130, 246, 0.08)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="4,2"
                />
                {/* Inner crosshair */}
                <g stroke="#3b82f6" strokeWidth="1.5">
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
                  r="2"
                  fill="#3b82f6"
                />
                {/* Radius label */}
                <text
                  x={mousePosition.x + pixelRadius + 5}
                  y={mousePosition.y - 5}
                  fontSize="11"
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
                onClick={() => setIsInvestigateMode(!isInvestigateMode)}
                disabled={!selectedSpecies}
                title={selectedSpecies ? "Click on map to investigate area for occurrences" : "Select a species first"}
                className={isInvestigateMode ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                <Search className="w-5 h-5" />
              </Button>

              {/* Radius Controls - only show when in investigate mode */}
              {isInvestigateMode && (
                <div 
                  className="flex items-center gap-1 bg-gray-50 rounded px-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
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
                  <span className="text-xs font-medium min-w-[3rem] text-center">
                    {(investigateRadius / 1000).toFixed(0)}km
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInvestigateRadius(Math.min(20000, investigateRadius + 1000));
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    disabled={investigateRadius >= 20000}
                    title="Increase radius"
                  >
                    <Plus className="w-3 h-3" />
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

