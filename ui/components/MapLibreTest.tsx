import { useState, useRef } from 'react';
import Map, { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// Simple test component to verify MapLibre GL is working
export function MapLibreTest() {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 20,
    zoom: 2
  });

  // Basic map style with OpenStreetMap tiles
  const mapStyle = {
    version: 8 as const,
    sources: {
      'osm': {
        type: 'raster' as const,
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm',
        type: 'raster' as const,
        source: 'osm',
        minzoom: 0,
        maxzoom: 22
      }
    ]
  };

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 left-4 z-10 bg-white/90 p-2 rounded shadow">
        <h3 className="text-sm font-semibold">MapLibre GL Test</h3>
        <p className="text-xs text-gray-600">Zoom: {viewState.zoom.toFixed(1)}</p>
        <p className="text-xs text-gray-600">
          Lat: {viewState.latitude.toFixed(3)}, Lng: {viewState.longitude.toFixed(3)}
        </p>
      </div>
      
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
      />
    </div>
  );
}