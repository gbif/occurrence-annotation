import { useState, useRef, useEffect, useCallback } from 'react';import { useState, useRef, useEffect, useCallback } from 'react';

import Map, { Layer, Source, MapRef } from 'react-map-gl/maplibre';import Map, { Layer, Source, MapRef } from 'react-map-gl/maplibre';

import type { MapLayerMouseEvent } from 'maplibre-gl';import type { GeoJSONSource } from 'maplibre-gl';

import { PolygonData } from '../App';import { PolygonData } from '../App';

import { Button } from './ui/button';import { Button } from './ui/button';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

import { ScrollArea } from './ui/scroll-area';import { ScrollArea } from './ui/scroll-area';

import { Badge } from './ui/badge';import { Badge } from './ui/badge';

import { Card } from './ui/card';import { Card } from './ui/card';

import { Separator } from './ui/separator';import { Separator } from './ui/separator';

import { Trash2, Square, Check, X, Edit2, Search, Plus, Minus, ExternalLink, Loader2, MapPin, Calendar, User, Database, Eye } from 'lucide-react';import { Trash2, Square, Check, X, Edit2, Search, Plus, Minus, ExternalLink, Loader2, MapPin, Calendar, User, Database, Eye } from 'lucide-react';

import { AnnotationRule } from './AnnotationRules';import { AnnotationRule } from './AnnotationRules';

import { toast } from 'sonner';import { toast } from 'sonner';

import 'maplibre-gl/dist/maplibre-gl.css';import 'maplibre-gl/dist/maplibre-gl.css';



interface MapComponentProps {interface MapComponentProps {

  selectedSpecies: {  selectedSpecies: {

    name: string;    name: string;

    scientificName: string;    scientificName: string;

    key: number;    key: number;

  } | null;  } | null;

  savedPolygons: PolygonData[];  savedPolygons: PolygonData[];

  currentPolygon: [number, number][] | null;  currentPolygon: [number, number][] | null;

  isCurrentInverted?: boolean;  isCurrentInverted?: boolean;

  currentAnnotation?: string;  currentAnnotation?: string;

  onPolygonChange: (coords: [number, number][] | null) => void;  onPolygonChange: (coords: [number, number][] | null) => void;

  annotationRules?: AnnotationRule[];  annotationRules?: AnnotationRule[];

  showAnnotationRules?: boolean;  showAnnotationRules?: boolean;

  editingPolygonId?: string | null;  editingPolygonId?: string | null;

  onUpdatePolygon?: (id: string, coordinates: [number, number][] | [number, number][][]) => void;  onUpdatePolygon?: (id: string, coordinates: [number, number][] | [number, number][][]) => void;

  onStopEditing?: () => void;  onStopEditing?: () => void;

  onSaveAndEdit: () => void;  onSaveAndEdit: () => void;

  onAutoSave?: (coords: [number, number][]) => void;  onAutoSave?: (coords: [number, number][]) => void;

  onNavigateToLocation?: (lat: number, lng: number, zoom?: number) => void;  onNavigateToLocation?: (lat: number, lng: number, zoom?: number) => void;

}

}

// Map style with GBIF tiles

const mapStyle = {// Tile conversion helpers for Web Mercator (EPSG:3857)

  version: 8,function latLngToTileWebMercator(lat: number, lng: number, zoom: number): [number, number] {

  sources: {  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));

    'gbif-base': {  const latRad = lat * Math.PI / 180;

      type: 'raster' as const,  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));

      tiles: ['https://tile.gbif.org/3857/omt/{z}/{x}/{y}@2x.png?style=gbif-geyser-en'],  return [x, y];

      tileSize: 256,}

      attribution: 'GBIF'

    }function tileToLatLngWebMercator(x: number, y: number, zoom: number): [number, number] {

  },  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);

  layers: [  const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

    {  const lng = x / Math.pow(2, zoom) * 360 - 180;

      id: 'gbif-base',  return [lat, lng];

      type: 'raster' as const,}

      source: 'gbif-base',

      minzoom: 0,// GBIF base map tile provider - Web Mercator (EPSG:3857)

      maxzoom: 22const gbifTileProvider = (x: number, y: number, z: number) => {

    }  const url = `https://tile.gbif.org/3857/omt/${z}/${x}/${y}@2x.png?style=gbif-geyser-en`;

  ]  return url;

};};



// Helper function to convert coordinates for GeoJSONexport function MapComponent({

function formatPolygonForGeoJSON(coords: [number, number][]): [number, number][][] {  selectedSpecies,

  // Ensure the polygon is closed  savedPolygons,

  const closedCoords = [...coords];  currentPolygon,

  if (closedCoords.length > 0 &&   isCurrentInverted = false,

      (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||   currentAnnotation = 'SUSPICIOUS',

       closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1])) {  onPolygonChange,

    closedCoords.push(closedCoords[0]);  annotationRules = [],

  }  showAnnotationRules = true,

    editingPolygonId = null,

  // GeoJSON expects [lng, lat] format  onUpdatePolygon,

  return [closedCoords.map(([lat, lng]) => [lng, lat])];  onSaveAndEdit,

}  onAutoSave,

  onNavigateToLocation,

// Annotation colors}: MapComponentProps) {

const annotationColors: { [key: string]: { fill: string; stroke: string } } = {  const [center, setCenter] = useState<[number, number]>([20, 0]);

  SUSPICIOUS: { fill: '#ef4444', stroke: '#dc2626' },  const [zoom, setZoom] = useState(2);

  NATIVE: { fill: '#10b981', stroke: '#059669' },  const [isDrawing, setIsDrawing] = useState(false);

  MANAGED: { fill: '#3b82f6', stroke: '#2563eb' },  const [drawingMode, setDrawingMode] = useState<'polygon' | 'rectangle'>('polygon');

  FORMER: { fill: '#a855f7', stroke: '#9333ea' },  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);

  VAGRANT: { fill: '#f97316', stroke: '#ea580c' },  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

};  const [gbifTiles, setGbifTiles] = useState<Array<{ x: number; y: number; z: number; anchor: [number, number]; url: string }>>([]);

  const [isZooming, setIsZooming] = useState(false);

export function MapComponent({  const [mapTransform, setMapTransform] = useState<string>('');

  selectedSpecies,  const [draggingVertex, setDraggingVertex] = useState<{ polygonId: string; index: number } | null>(null);

  savedPolygons,  const [isDraggingShape, setIsDraggingShape] = useState(false);

  currentPolygon,  const [dragStart, setDragStart] = useState<[number, number] | null>(null);

  isCurrentInverted = false,  const [dragCurrent, setDragCurrent] = useState<[number, number] | null>(null);

  currentAnnotation = 'SUSPICIOUS',  const [isEditingCurrent, setIsEditingCurrent] = useState(false);

  onPolygonChange,  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  annotationRules = [],  

  showAnnotationRules = true,  // Investigate mode state

  editingPolygonId = null,  const [isInvestigateMode, setIsInvestigateMode] = useState(false);

  onUpdatePolygon,  const [investigateRadius, setInvestigateRadius] = useState(20000); // Default 20km radius

  onSaveAndEdit,  const [isInvestigateLoading, setIsInvestigateLoading] = useState(false);

  onAutoSave,  const [investigateResults, setInvestigateResults] = useState<any[]>([]);

  onNavigateToLocation,  const [isInvestigateDialogOpen, setIsInvestigateDialogOpen] = useState(false);

}: MapComponentProps) {  const [investigationPoint, setInvestigationPoint] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<MapRef>(null);  

  const [viewState, setViewState] = useState({  const mapContainerRef = useRef<HTMLDivElement>(null);

    longitude: 0,  const zoomTimeoutRef = useRef<number | null>(null);

    latitude: 20,  const svgRef = useRef<SVGSVGElement>(null);

    zoom: 2  const animationFrameRef = useRef<number | null>(null);

  });

    // Debug logging for current annotation

  const [isDrawing, setIsDrawing] = useState(false);  useEffect(() => {

  const [drawingMode, setDrawingMode] = useState<'polygon' | 'rectangle'>('polygon');    if (currentPolygon && currentPolygon.length > 0) {

  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);      const annotationColors: { [key: string]: { fill: string; stroke: string } } = {

  const [draggingVertex, setDraggingVertex] = useState<{ polygonId: string; index: number } | null>(null);        SUSPICIOUS: { fill: '#ef4444', stroke: '#dc2626' },

  const [isDraggingShape, setIsDraggingShape] = useState(false);        NATIVE: { fill: '#10b981', stroke: '#059669' },

  const [dragStart, setDragStart] = useState<[number, number] | null>(null);        MANAGED: { fill: '#3b82f6', stroke: '#2563eb' },

  const [isEditingCurrent, setIsEditingCurrent] = useState(false);        FORMER: { fill: '#a855f7', stroke: '#9333ea' },

          VAGRANT: { fill: '#f97316', stroke: '#ea580c' },

  // Investigate mode state      };

  const [isInvestigateMode, setIsInvestigateMode] = useState(false);      const color = annotationColors[currentAnnotation.toUpperCase()] || annotationColors.SUSPICIOUS;

  const [investigateRadius, setInvestigateRadius] = useState(20000);      console.log('🎨 ACTIVE POLYGON DEBUG:', {

  const [isInvestigateLoading, setIsInvestigateLoading] = useState(false);        annotationType: currentAnnotation,

  const [investigateResults, setInvestigateResults] = useState<any[]>([]);        fillColor: color.fill,

  const [isInvestigateDialogOpen, setIsInvestigateDialogOpen] = useState(false);        strokeColor: color.stroke,

  const [investigationPoint, setInvestigationPoint] = useState<{ lat: number; lng: number } | null>(null);        isInverted: isCurrentInverted,

        polygonPoints: currentPolygon.length

  // Handle map click for drawing polygons      });

  const handleMapClick = useCallback((event: MapLayerMouseEvent) => {    }

    if (!isDrawing && !isInvestigateMode) return;  }, [currentPolygon, currentAnnotation, isCurrentInverted]);

      

    const { lngLat } = event;  // Stable refs for positioning polygons - only update when drag/zoom ends

    const coords: [number, number] = [lngLat.lat, lngLat.lng];  const stableCenter = useRef<[number, number]>(center);

      const stableZoom = useRef<number>(zoom);

    console.log('🗺️ Map click:', { lat: lngLat.lat, lng: lngLat.lng, isDrawing, isInvestigateMode });

      // Mirror pigeon-maps transform to SVG overlay

    if (isInvestigateMode) {  useEffect(() => {

      setInvestigationPoint({ lat: lngLat.lat, lng: lngLat.lng });    if (!mapContainerRef.current) return;

      setIsInvestigateLoading(true);

      // Simulate investigation    const syncTransform = () => {

      setTimeout(() => {      // Find the pigeon-maps tiles container which gets the transform applied

        setIsInvestigateLoading(false);      const tilesContainer = mapContainerRef.current?.querySelector('.pigeon-tiles') as HTMLElement;

        setIsInvestigateDialogOpen(true);      

        setInvestigateResults([      if (tilesContainer) {

          {        const computedStyle = window.getComputedStyle(tilesContainer);

            species: 'Sample Species',        const transform = computedStyle.transform;

            scientificName: 'Samplius demonstratus',        

            date: '2024-01-15',        if (transform && transform !== 'none') {

            distance: Math.floor(Math.random() * 5000)          setMapTransform(transform);

          }        } else {

        ]);          setMapTransform('');

      }, 1000);        }

      return;      } else {

    }        // If tiles container not found yet, retry on next frame

            setMapTransform('');

    if (isDrawing) {      }

      if (drawingMode === 'polygon') {      

        const newPoints = [...drawingPoints, coords];      animationFrameRef.current = requestAnimationFrame(syncTransform);

        setDrawingPoints(newPoints);    };

        onPolygonChange(newPoints);

        console.log('🎨 Added point to polygon:', newPoints.length, 'points');    // Small delay to ensure pigeon-maps has initialized

      } else if (drawingMode === 'rectangle') {    const timeoutId = setTimeout(() => {

        if (drawingPoints.length === 0) {      syncTransform();

          setDrawingPoints([coords]);    }, 100);

        } else if (drawingPoints.length === 1) {

          const [startLat, startLng] = drawingPoints[0];    return () => {

          const [endLat, endLng] = coords;      clearTimeout(timeoutId);

                if (animationFrameRef.current) {

          const rectangleCoords: [number, number][] = [        cancelAnimationFrame(animationFrameRef.current);

            [startLat, startLng],      }

            [startLat, endLng],    };

            [endLat, endLng],  }, []);

            [endLat, startLng],

            [startLat, startLng] // Close the rectangle  useEffect(() => {

          ];    if (mapContainerRef.current) {

                const updateSize = () => {

          setDrawingPoints(rectangleCoords);        if (mapContainerRef.current) {

          onPolygonChange(rectangleCoords);          setMapSize({

          setIsDrawing(false);            width: mapContainerRef.current.offsetWidth,

          console.log('🎨 Completed rectangle drawing');            height: mapContainerRef.current.offsetHeight,

        }          });

      }        }

    }      };

  }, [isDrawing, isInvestigateMode, drawingMode, drawingPoints, onPolygonChange]);      

      // Listen for wheel events to detect zoom before it happens

  // Handle double click to finish polygon drawing      const handleWheel = () => {

  const handleMapDoubleClick = useCallback((event: MapLayerMouseEvent) => {        // Only clear tiles on more significant zoom changes to reduce flicker

    event.preventDefault();        setIsZooming(true);

    if (isDrawing && drawingMode === 'polygon' && drawingPoints.length > 2) {        

      setIsDrawing(false);        // Clear any existing timeout

      // Close the polygon by adding the first point at the end        if (zoomTimeoutRef.current) {

      const closedPolygon = [...drawingPoints, drawingPoints[0]];          clearTimeout(zoomTimeoutRef.current);

      onPolygonChange(closedPolygon);        }

      console.log('🎨 Finished polygon drawing with', closedPolygon.length, 'points');        

    }        // Set timeout to end zooming state - reduced for snappier response

  }, [isDrawing, drawingMode, drawingPoints, onPolygonChange]);        zoomTimeoutRef.current = window.setTimeout(() => {

          setIsZooming(false);

  // Start drawing        }, 150);

  const startDrawing = (mode: 'polygon' | 'rectangle') => {      };

    setDrawingMode(mode);      

    setIsDrawing(true);      updateSize();

    setDrawingPoints([]);      window.addEventListener('resize', updateSize);

    onPolygonChange([]);      mapContainerRef.current.addEventListener('wheel', handleWheel);

    console.log('🎨 Started drawing mode:', mode);      

  };      const currentRef = mapContainerRef.current;

      

  // Cancel drawing      return () => {

  const cancelDrawing = () => {        window.removeEventListener('resize', updateSize);

    setIsDrawing(false);        if (currentRef) {

    setDrawingPoints([]);          currentRef.removeEventListener('wheel', handleWheel);

    onPolygonChange(null);        }

    console.log('🎨 Cancelled drawing');        // Cleanup zoom timeout on unmount

  };        if (zoomTimeoutRef.current) {

          clearTimeout(zoomTimeoutRef.current);

  // Save current polygon        }

  const saveCurrentPolygon = () => {      };

    if (currentPolygon && currentPolygon.length > 2) {    }

      onSaveAndEdit();  }, []);

      setIsDrawing(false);

      setDrawingPoints([]);  // Update GBIF tiles when map moves or species changes

      console.log('🎨 Saved current polygon');  useEffect(() => {

      toast.success('Polygon saved successfully!');    if (!selectedSpecies || mapSize.width === 0 || isZooming) {

    }      if (isZooming) {

  };        setGbifTiles([]);

      }

  // Create GeoJSON for current drawing polygon      if (!selectedSpecies || mapSize.width === 0) {

  const currentPolygonGeoJSON = currentPolygon && currentPolygon.length > 2 ? {        setGbifTiles([]);

    type: 'FeatureCollection' as const,        if (!selectedSpecies) {

    features: [{          console.log('🧹 SPECIES CLEARED - GBIF tiles removed');

      type: 'Feature' as const,        }

      properties: {      }

        id: 'current',      return;

        annotation: currentAnnotation,    }

        inverted: isCurrentInverted

      },    console.log('🐾 SPECIES LOADED:', {

      geometry: {      name: selectedSpecies.name,

        type: 'Polygon' as const,      scientificName: selectedSpecies.scientificName,

        coordinates: formatPolygonForGeoJSON(currentPolygon)      key: selectedSpecies.key,

      }      status: '⏳ Loading GBIF occurrence tiles...'

    }]    });

  } : null;

    const tileZoom = Math.max(0, Math.min(14, Math.floor(zoom)));

  // Create GeoJSON for saved polygons    const [centerX, centerY] = latLngToTileWebMercator(center[0], center[1], tileZoom);

  const savedPolygonsGeoJSON = {    

    type: 'FeatureCollection' as const,    // Limit the number of tiles to prevent performance issues

    features: savedPolygons.map(polygon => ({    const tilesX = Math.min(6, Math.ceil(mapSize.width / 256) + 1);

      type: 'Feature' as const,    const tilesY = Math.min(6, Math.ceil(mapSize.height / 256) + 1);

      properties: {    

        id: polygon.id,    const newTiles = [];

        annotation: polygon.annotation || 'SUSPICIOUS',    for (let dx = -Math.floor(tilesX / 2); dx <= Math.ceil(tilesX / 2); dx++) {

        inverted: polygon.inverted || false,      for (let dy = -Math.floor(tilesY / 2); dy <= Math.ceil(tilesY / 2); dy++) {

        species: polygon.species?.name || 'Unknown'        const x = centerX + dx;

      },        const y = centerY + dy;

      geometry: {        const maxTile = Math.pow(2, tileZoom);

        type: 'Polygon' as const,        

        coordinates: Array.isArray(polygon.coordinates[0])         if (x >= 0 && x < maxTile && y >= 0 && y < maxTile) {

          ? (polygon.coordinates as [number, number][][]).map(ring =>           // Get the northwest corner of the tile as anchor point

              ring.map(([lat, lng]) => [lng, lat])          const anchor = tileToLatLngWebMercator(x, y, tileZoom);

            )          const url = `https://api.gbif.org/v2/map/occurrence/adhoc/${tileZoom}/${x}/${y}@2x.png?srs=EPSG:3857&style=scaled.circles&mode=GEO_CENTROID&taxonKey=${selectedSpecies.key}&hasGeospatialIssue=false`;

          : formatPolygonForGeoJSON(polygon.coordinates as [number, number][])          

      }          newTiles.push({ x, y, z: tileZoom, anchor, url });

    }))        }

  };      }

    }

  // Log current polygon state for debugging    

  useEffect(() => {    setGbifTiles(newTiles);

    if (currentPolygon && currentPolygon.length > 0) {    console.log('📍 GBIF TILES LOADED:', {

      const color = annotationColors[currentAnnotation.toUpperCase()] || annotationColors.SUSPICIOUS;      tileCount: newTiles.length,

      console.log('🎨 ACTIVE POLYGON DEBUG:', {      species: selectedSpecies?.name || 'Unknown',

        annotationType: currentAnnotation,      zoom: zoom,

        fillColor: color.fill,      status: '🔍 Check coordinate alignment NOW'

        strokeColor: color.stroke,    });

        isInverted: isCurrentInverted,  }, [zoom, center, mapSize, selectedSpecies, isZooming]);

        polygonPoints: currentPolygon.length

      });  // Handle external navigation requests

    }  useEffect(() => {

  }, [currentPolygon, currentAnnotation, isCurrentInverted]);    if (onNavigateToLocation) {

      // Expose navigation function globally

  // Navigation effect      (window as any).__navigateToLocation = (lat: number, lng: number, zoom?: number) => {

  useEffect(() => {        setCenter([lat, lng]);

    if (onNavigateToLocation && mapRef.current) {        if (zoom !== undefined) {

      // This effect can be used for programmatic navigation          setZoom(zoom);

      // Example: mapRef.current.flyTo({ center: [lng, lat], zoom: newZoom });        }

    }      };

  }, [onNavigateToLocation]);    }

    return () => {

  return (      (window as any).__navigateToLocation = undefined;

    <div className="relative w-full h-full">    };

      {/* Drawing Controls */}  }, [onNavigateToLocation]);

      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">

        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">  // Clear GBIF tiles when zoom level changes significantly (not just on wheel events)

          <div className="flex gap-2">  useEffect(() => {

            <Button    const previousZoom = stableZoom.current;

              variant={isDrawing && drawingMode === 'polygon' ? 'default' : 'outline'}    const zoomDifference = Math.abs(zoom - previousZoom);

              size="sm"    

              onClick={() => isDrawing ? cancelDrawing() : startDrawing('polygon')}    // Only clear tiles if zoom changed by more than 0.5 levels to reduce flicker

              className="h-8"    if (zoomDifference > 0.5) {

            >      setGbifTiles([]);

              {isDrawing && drawingMode === 'polygon' ? (    }

                <>  }, [zoom]);

                  <X className="w-4 h-4 mr-1" />

                  Cancel  // Investigate area function

                </>  const investigateArea = async (lat: number, lng: number) => {

              ) : (    if (!selectedSpecies || !isInvestigateMode) {

                'Draw Polygon'      return;

              )}    }

            </Button>    

            <Button    setInvestigationPoint({ lat, lng });

              variant={isDrawing && drawingMode === 'rectangle' ? 'default' : 'outline'}    setIsInvestigateLoading(true);

              size="sm"    // Don't open dialog immediately - wait to see if we have results

              onClick={() => isDrawing ? cancelDrawing() : startDrawing('rectangle')}    

              className="h-8"    console.log('🔍 Starting area investigation at:', { lat, lng, radius: investigateRadius });

            >    

              {isDrawing && drawingMode === 'rectangle' ? (    try {

                <>      // Use a simple bounding box for the search

                  <X className="w-4 h-4 mr-1" />      const radiusInDegrees = investigateRadius / 111000; // Rough conversion: 1 degree ≈ 111km

                  Cancel      const latAdjustment = radiusInDegrees;

                </>      const lngAdjustment = radiusInDegrees / Math.cos(lat * Math.PI / 180); // Adjust longitude for latitude

              ) : (      

                <>      const north = lat + latAdjustment;

                  <Square className="w-4 h-4 mr-1" />      const south = lat - latAdjustment;

                  Rectangle      const east = lng + lngAdjustment;

                </>      const west = lng - lngAdjustment;

              )}      

            </Button>      console.log('🔍 Search bounds:', { north, south, east, west, radiusKm: investigateRadius/1000 });

          </div>      

                // Search for occurrences within the bounding box

          {isDrawing && (      const apiUrl = `https://api.gbif.org/v1/occurrence/search?` +

            <div className="mt-2 flex gap-2">        `taxonKey=${selectedSpecies.key}&` +

              <Button        `hasCoordinate=true&` +

                variant="outline"        `decimalLatitude=${south},${north}&` +

                size="sm"        `decimalLongitude=${west},${east}&` +

                onClick={saveCurrentPolygon}        `limit=50`;

                disabled={!currentPolygon || currentPolygon.length < 3}      

                className="h-8"      const response = await fetch(apiUrl);

              >      

                <Check className="w-4 h-4 mr-1" />      if (!response.ok) {

                Save        throw new Error('Failed to fetch GBIF occurrences');

              </Button>      }

              {drawingMode === 'polygon' && (      

                <div className="text-xs text-gray-600 flex items-center">      const data = await response.json();

                  Double-click to finish      console.log('🔍 GBIF response:', data);

                </div>      

              )}      // Fetch additional dataset information for each occurrence

            </div>      const enrichedOccurrences = await Promise.all(

          )}        data.results.map(async (occurrence: any) => {

        </div>          try {

            // Fetch dataset info

        {/* Investigate Mode Toggle */}            const datasetResponse = await fetch(

        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">              `https://api.gbif.org/v1/dataset/${occurrence.datasetKey}`

          <Button            );

            variant={isInvestigateMode ? 'default' : 'outline'}            

            size="sm"            let datasetInfo = {};

            onClick={() => setIsInvestigateMode(!isInvestigateMode)}            if (datasetResponse.ok) {

            className="h-8"              const dataset = await datasetResponse.json();

          >              datasetInfo = {

            <Search className="w-4 h-4 mr-1" />                datasetTitle: dataset.title,

            {isInvestigateMode ? 'Exit Investigate' : 'Investigate'}                publisher: dataset.publishingOrganizationTitle || dataset.publisher

          </Button>              };

        </div>            }

      </div>            

            return {

      {/* Species Info Panel */}              key: occurrence.key,

      {selectedSpecies && (              scientificName: occurrence.scientificName,

        <div className="absolute top-4 right-4 z-10">              decimalLatitude: occurrence.decimalLatitude,

          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-sm">              decimalLongitude: occurrence.decimalLongitude,

            <h3 className="font-semibold text-sm">{selectedSpecies.name}</h3>              eventDate: occurrence.eventDate,

            <p className="text-xs text-gray-600 italic">{selectedSpecies.scientificName}</p>              recordedBy: occurrence.recordedBy,

            <p className="text-xs text-gray-500 mt-1">Key: {selectedSpecies.key}</p>              datasetKey: occurrence.datasetKey,

          </div>              basisOfRecord: occurrence.basisOfRecord,

        </div>              coordinateUncertaintyInMeters: occurrence.coordinateUncertaintyInMeters,

      )}              media: occurrence.media || [],

              ...datasetInfo

      {/* Map */}            };

      <Map          } catch (err) {

        ref={mapRef}            console.error('Error fetching dataset info:', err);

        {...viewState}            return occurrence;

        onMove={evt => setViewState(evt.viewState)}          }

        onClick={handleMapClick}        })

        onDblClick={handleMapDoubleClick}      );

        style={{ width: '100%', height: '100%' }}      

        mapStyle={mapStyle}      setInvestigateResults(enrichedOccurrences);

        attributionControl={false}      

        doubleClickZoom={!isDrawing} // Disable zoom on double click when drawing      if (enrichedOccurrences.length === 0) {

      >        // No results - just show toast message, don't open dialog

        {/* Saved Polygons Layer */}        toast.info(`No occurrences found for ${selectedSpecies.scientificName} within ${investigateRadius/1000}km of this location`);

        {savedPolygons.length > 0 && (      } else {

          <Source id="saved-polygons" type="geojson" data={savedPolygonsGeoJSON}>        // Found results - open dialog and show success message

            <Layer        setIsInvestigateDialogOpen(true);

              id="saved-polygons-fill"        toast.success(`Found ${enrichedOccurrences.length} occurrence(s) for ${selectedSpecies.scientificName}`);

              type="fill"      }

              paint={{      

                'fill-color': [    } catch (error) {

                  'case',      console.error('Error investigating area:', error);

                  ['==', ['get', 'annotation'], 'NATIVE'], annotationColors.NATIVE.fill,      toast.error('Failed to search for occurrences in this area');

                  ['==', ['get', 'annotation'], 'MANAGED'], annotationColors.MANAGED.fill,      setInvestigateResults([]);

                  ['==', ['get', 'annotation'], 'FORMER'], annotationColors.FORMER.fill,    } finally {

                  ['==', ['get', 'annotation'], 'VAGRANT'], annotationColors.VAGRANT.fill,      setIsInvestigateLoading(false);

                  annotationColors.SUSPICIOUS.fill    }

                ],  };

                'fill-opacity': 0.3

              }}  // Helper functions for investigate results

            />  const formatDate = (dateString?: string) => {

            <Layer    if (!dateString) return 'Unknown date';

              id="saved-polygons-stroke"    try {

              type="line"      return new Date(dateString).toLocaleDateString();

              paint={{    } catch {

                'line-color': [      return dateString;

                  'case',    }

                  ['==', ['get', 'annotation'], 'NATIVE'], annotationColors.NATIVE.stroke,  };

                  ['==', ['get', 'annotation'], 'MANAGED'], annotationColors.MANAGED.stroke,

                  ['==', ['get', 'annotation'], 'FORMER'], annotationColors.FORMER.stroke,  const getDistanceString = (lat: number, lng: number) => {

                  ['==', ['get', 'annotation'], 'VAGRANT'], annotationColors.VAGRANT.stroke,    if (!investigationPoint) return '';

                  annotationColors.SUSPICIOUS.stroke    

                ],    // Calculate distance using Haversine formula

                'line-width': 2    const R = 6371000; // Earth's radius in meters

              }}    const dLat = (lat - investigationPoint.lat) * Math.PI / 180;

            />    const dLng = (lng - investigationPoint.lng) * Math.PI / 180;

          </Source>    const a = 

        )}      Math.sin(dLat/2) * Math.sin(dLat/2) +

      Math.cos(investigationPoint.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 

        {/* Current Drawing Polygon Layer */}      Math.sin(dLng/2) * Math.sin(dLng/2);

        {currentPolygonGeoJSON && (    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

          <Source id="current-polygon" type="geojson" data={currentPolygonGeoJSON}>    const distance = R * c;

            <Layer    

              id="current-polygon-fill"    if (distance < 1000) {

              type="fill"      return `${Math.round(distance)}m away`;

              paint={{    } else {

                'fill-color': annotationColors[currentAnnotation.toUpperCase()]?.fill || annotationColors.SUSPICIOUS.fill,      return `${(distance / 1000).toFixed(1)}km away`;

                'fill-opacity': 0.3    }

              }}  };

            />

            <Layer  const handleMapClick = ({ latLng }: { latLng: [number, number] }) => {

              id="current-polygon-stroke"    const [lat, lng] = latLng;

              type="line"    console.log('🗺️ MapComponent: handleMapClick called with:', { lat, lng, isInvestigateMode, dialogOpen: isInvestigateDialogOpen });

              paint={{    

                'line-color': annotationColors[currentAnnotation.toUpperCase()]?.stroke || annotationColors.SUSPICIOUS.stroke,    // Don't trigger investigation if dialog is open

                'line-width': 2,    if (isInvestigateDialogOpen) {

                'line-dasharray': [2, 2]      console.log('🗺️ MapComponent: Ignoring click - dialog is open');

              }}      return;

            />    }

          </Source>    

        )}    // Handle investigate mode - search for occurrences in clicked area

    if (isInvestigateMode) {

        {/* Investigation Point */}      console.log('🗺️ MapComponent: Investigate mode click detected at:', { lat, lng });

        {investigationPoint && (      investigateArea(lat, lng);

          <Source      return;

            id="investigation-point"    }

            type="geojson"    

            data={{    // Only log clicks near the map edges where coordinate issues occur

              type: 'Feature',    if (Math.abs(lat) > 80) {

              geometry: {      const [ourScreenX, ourScreenY] = latLngToStablePixel(lat, lng);

                type: 'Point',      const roundTripLatLng = pixelToCurrentLatLng(ourScreenX, ourScreenY);

                coordinates: [investigationPoint.lng, investigationPoint.lat]      const latError = Math.abs(lat - roundTripLatLng[0]);

              },      

              properties: {}      console.log('🖱️ EDGE CLICK TEST:', {

            }}        clicked: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,

          >        coordinateError: latError.toFixed(4) + '°',

            <Layer        status: latError > 0.1 ? '❌ MISALIGNED' : '✅ ALIGNED'

              id="investigation-point"      });

              type="circle"    }

              paint={{    

                'circle-radius': 8,    if (!isDrawing) {

                'circle-color': '#3b82f6',      console.log('🗺️ MapComponent: Not in drawing mode, ignoring click');

                'circle-stroke-color': '#1d4ed8',      return;

                'circle-stroke-width': 2    }

              }}    setDrawingPoints([...drawingPoints, latLng]);

            />  };

          </Source>

        )}  const startDrawing = (mode: 'polygon' | 'rectangle') => {

      </Map>    setDrawingMode(mode);

    setIsDrawing(true);

      {/* Investigation Dialog */}    setDrawingPoints([]);

      <Dialog open={isInvestigateDialogOpen} onOpenChange={setIsInvestigateDialogOpen}>    setIsDraggingShape(false);

        <DialogContent className="max-w-4xl max-h-[80vh]">    setDragStart(null);

          <DialogHeader>    setDragCurrent(null);

            <DialogTitle className="flex items-center gap-2">  };

              <Search className="w-5 h-5" />

              Investigation Results  const finishDrawing = (points?: [number, number][]) => {

            </DialogTitle>    const pointsToUse = points || drawingPoints;

            <DialogDescription>    

              {investigationPoint && (    if (drawingMode === 'polygon' && pointsToUse.length < 3) {

                <>      alert('Please add at least 3 points to create a polygon');

                  Location: {investigationPoint.lat.toFixed(6)}, {investigationPoint.lng.toFixed(6)}      return;

                  <br />    }

                  Radius: {(investigateRadius / 1000).toFixed(1)} km    

                </>    if (drawingMode === 'rectangle' && pointsToUse.length !== 2) {

              )}      alert('Please click two opposite corners to create a rectangle');

            </DialogDescription>      return;

          </DialogHeader>    }

              

          <ScrollArea className="max-h-96">    let finalPoints = pointsToUse;

            {isInvestigateLoading ? (    

              <div className="flex items-center justify-center p-8">    // Convert rectangle to polygon (4 corners)

                <Loader2 className="w-8 h-8 animate-spin" />    if (drawingMode === 'rectangle' && pointsToUse.length === 2) {

                <span className="ml-2">Searching for occurrences...</span>      const [p1, p2] = pointsToUse;

              </div>      finalPoints = [

            ) : investigateResults.length > 0 ? (        [p1[0], p1[1]], // top-left

              <div className="space-y-4">        [p1[0], p2[1]], // top-right

                {investigateResults.map((result, index) => (        [p2[0], p2[1]], // bottom-right

                  <Card key={index} className="p-4">        [p2[0], p1[1]], // bottom-left

                    <div className="flex items-start justify-between">      ];

                      <div>    }

                        <h4 className="font-semibold">{result.species}</h4>    

                        <p className="text-sm text-gray-600">{result.scientificName}</p>    // Auto-save the polygon immediately

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">    if (onAutoSave) {

                          <span className="flex items-center gap-1">      onAutoSave(finalPoints);

                            <Calendar className="w-3 h-3" />    } else {

                            {result.date}      onPolygonChange(finalPoints);

                          </span>    }

                          <span className="flex items-center gap-1">    

                            <MapPin className="w-3 h-3" />    setDrawingPoints([]);

                            {result.distance}m away    setIsDrawing(false);

                          </span>  };

                        </div>

                      </div>  const cancelDrawing = () => {

                      <Button variant="outline" size="sm">    setDrawingPoints([]);

                        <ExternalLink className="w-4 h-4" />    setIsDrawing(false);

                      </Button>    setIsDraggingShape(false);

                    </div>    setDragStart(null);

                  </Card>    setDragCurrent(null);

                ))}  };

              </div>

            ) : (  const clearCurrentPolygon = () => {

              <div className="text-center p-8 text-gray-500">    onPolygonChange(null);

                No occurrences found in the selected area.    setIsEditingCurrent(false);

              </div>  };

            )}

          </ScrollArea>  // Handlers for current polygon editing

        </DialogContent>  const handleCurrentVertexMouseDown = (e: React.MouseEvent, vertexIndex: number) => {

      </Dialog>    e.stopPropagation();

    e.preventDefault();

      {/* Loading overlay for investigation */}    setDraggingVertex({ polygonId: 'current', index: vertexIndex });

      {isInvestigateLoading && (  };

        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50">

          <div className="bg-white rounded-lg p-4 flex items-center gap-3">  const handleCurrentEdgeClick = (e: React.MouseEvent, edgeStartIndex: number) => {

            <Loader2 className="w-6 h-6 animate-spin" />    e.stopPropagation();

            <span>Investigating location...</span>    e.preventDefault();

          </div>    

        </div>    if (!currentPolygon) return;

      )}    

    // Calculate midpoint

      {/* Drawing Instructions */}    const point1 = currentPolygon[edgeStartIndex];

      {isDrawing && (    const point2 = currentPolygon[(edgeStartIndex + 1) % currentPolygon.length];

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">    const midLat = (point1[0] + point2[0]) / 2;

          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">    const midLng = (point1[1] + point2[1]) / 2;

            <p className="text-sm text-gray-700">    

              {drawingMode === 'polygon'     // Insert new vertex

                ? 'Click to add points, double-click to finish polygon'    const newCoordinates = [

                : 'Click to start rectangle, click again to finish'}      ...currentPolygon.slice(0, edgeStartIndex + 1),

            </p>      [midLat, midLng] as [number, number],

          </div>      ...currentPolygon.slice(edgeStartIndex + 1),

        </div>    ];

      )}    

    onPolygonChange(newCoordinates);

      {/* Investigate Instructions */}  };

      {isInvestigateMode && !isInvestigateLoading && (

        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">  const handleCurrentVertexRightClick = (e: React.MouseEvent, vertexIndex: number) => {

          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">    e.preventDefault();

            <p className="text-sm text-gray-700">    e.stopPropagation();

              Click anywhere on the map to investigate that location    

            </p>    if (!currentPolygon) return;

          </div>    

        </div>    if (currentPolygon.length <= 3) {

      )}      toast.error('Cannot delete vertex: polygon must have at least 3 vertices');

    </div>      return;

  );    }

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

