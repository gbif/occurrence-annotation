import React from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';
import { MiniMapPreview } from './MiniMapPreview';

// Using the world-atlas package that's already installed
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const MapDebug: React.FC = () => {
  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">React Simple Maps Debug</h1>
      
      <div className="space-y-6">
        {/* Test 1: Basic World Map */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Test 1: Basic World Map (800x400)</h2>
          <div className="border border-gray-300 rounded overflow-hidden" style={{ backgroundColor: '#4a5568' }}>
            <ComposableMap
              projection="geoMercator"
              width={800}
              height={400}
              style={{
                width: '100%',
                height: '400px',
                backgroundColor: '#4a5568', // Dark water
              }}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) => {
                  console.log('Geographies loaded:', geographies?.length || 0);
                  return geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#e5e7eb" // Light gray land
                      stroke="#d1d5db" // Borders
                      strokeWidth={0.5}
                      style={{
                        default: {
                          fill: "#e5e7eb",
                          stroke: "#d1d5db",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                        hover: {
                          fill: "#f3f4f6",
                          stroke: "#d1d5db",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                        pressed: {
                          fill: "#f3f4f6",
                          stroke: "#d1d5db",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                      }}
                    />
                  ));
                }}
              </Geographies>
            </ComposableMap>
          </div>
        </div>

        {/* Test 2: Small Mini Map */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Test 2: Mini Map (200x120)</h2>
          <div className="border border-gray-300 rounded overflow-hidden inline-block" style={{ backgroundColor: '#4a5568' }}>
            <ComposableMap
              projection="geoMercator"
              width={200}
              height={120}
              style={{
                width: '200px',
                height: '120px',
                backgroundColor: '#4a5568', // Dark water
              }}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#e5e7eb" // Light gray land
                      stroke="#d1d5db" // Borders
                      strokeWidth={0.3}
                      style={{
                        default: {
                          fill: "#e5e7eb",
                          stroke: "#d1d5db",
                          strokeWidth: 0.3,
                          outline: "none",
                        },
                      }}
                    />
                  ))
                }
              </Geographies>
            </ComposableMap>
          </div>
        </div>

        {/* Test 3: Alternative Geography Source */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Test 3: Alternative Source (Natural Earth)</h2>
          <div className="border border-gray-300 rounded overflow-hidden" style={{ backgroundColor: '#4a5568' }}>
            <ComposableMap
              projection="geoMercator"
              width={800}
              height={400}
              style={{
                width: '100%',
                height: '400px',
                backgroundColor: '#4a5568', // Dark water
              }}
            >
              <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json">
                {({ geographies }) => {
                  console.log('Alt geographies loaded:', geographies?.length || 0);
                  return geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#e5e7eb" // Light gray land
                      stroke="#d1d5db" // Borders
                      strokeWidth={0.5}
                      style={{
                        default: {
                          fill: "#e5e7eb",
                          stroke: "#d1d5db",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                      }}
                    />
                  ));
                }}
              </Geographies>
            </ComposableMap>
          </div>
        </div>

        {/* Test 4: With Sample Polygon (Europe) */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Test 4: With Sample Polygon (Europe)</h2>
          <div className="mb-3 p-3 bg-gray-50 rounded text-sm">
            <p><strong>WKT:</strong> POLYGON((10 40, 30 40, 30 60, 10 60, 10 40))</p>
            <p><strong>Coordinates (lng lat):</strong> [[10,40], [30,40], [30,60], [10,60], [10,40]]</p>
            <p><strong>Description:</strong> Rectangle covering parts of Europe</p>
          </div>
          <div className="border border-gray-300 rounded overflow-hidden" style={{ backgroundColor: '#4a5568' }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                center: [20, 50], // Center on Europe
                scale: 400,
              }}
              width={800}
              height={400}
              style={{
                width: '100%',
                height: '400px',
                backgroundColor: '#4a5568', // Dark water
              }}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#e5e7eb" // Light gray land
                      stroke="#d1d5db" // Borders
                      strokeWidth={0.5}
                      style={{
                        default: {
                          fill: "#e5e7eb",
                          stroke: "#d1d5db",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                      }}
                    />
                  ))
                }
              </Geographies>
              {/* Sample polygon over Europe - coordinates in [lng, lat] format */}
              <path
                d="M 10,40 L 30,40 L 30,60 L 10,60 Z"
                fill="rgba(34, 197, 94, 0.3)"
                stroke="#22c55e"
                strokeWidth={2}
              />
            </ComposableMap>
          </div>
        </div>

        {/* Test 5: Large World Polygon */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Test 5: Large World Polygon (Full Continental Areas)</h2>
          <div className="mb-3 p-3 bg-gray-50 rounded text-sm">
            <p><strong>WKT:</strong> POLYGON((-120 20, 150 20, 150 70, -120 70, -120 20))</p>
            <p><strong>Coordinates (lng lat):</strong> [[-120,20], [150,20], [150,70], [-120,70], [-120,20]]</p>
            <p><strong>Description:</strong> Large rectangle covering North America, Europe, and Asia</p>
          </div>
          <div className="border border-gray-300 rounded overflow-hidden" style={{ backgroundColor: '#4a5568' }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: Math.min(800, 400) * 0.15,
              }}
              width={800}
              height={400}
              viewBox="0 0 800 400"
              style={{
                width: '100%',
                height: '400px',
                backgroundColor: '#4a5568', // Dark water
              }}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#e5e7eb" // Light gray land
                      stroke="#d1d5db" // Borders
                      strokeWidth={0.5}
                      style={{
                        default: {
                          fill: "#e5e7eb",
                          stroke: "#d1d5db",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                      }}
                    />
                  ))
                }
              </Geographies>
              {/* Large polygon covering multiple continents */}
              <path
                d="M -120,20 L 150,20 L 150,70 L -120,70 Z"
                fill="rgba(239, 68, 68, 0.3)"
                stroke="#ef4444"
                strokeWidth={2}
              />
            </ComposableMap>
          </div>
        </div>

        {/* Test 6: Using MiniMapPreview Component */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Test 6: MiniMapPreview Component Test</h2>
          <div className="mb-3 p-3 bg-gray-50 rounded text-sm">
            <p><strong>App Format (lat, lng):</strong> [[40,10], [40,30], [60,30], [60,10], [40,10]]</p>
            <p><strong>Expected WKT:</strong> POLYGON((10 40, 30 40, 30 60, 10 60, 10 40))</p>
            <p><strong>Description:</strong> Same Europe rectangle but using your app's coordinate format</p>
          </div>
          <div className="flex gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Large Preview (400x240)</h4>
              <MiniMapPreview 
                coordinates={[[40,10], [40,30], [60,30], [60,10], [40,10]]}
                isMultiPolygon={false}
                isInverted={false}
                width={400}
                height={240}
                className="rounded-md shadow-sm"
              />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-2">Mini Preview (120x80)</h4>
              <MiniMapPreview 
                coordinates={[[40,10], [40,30], [60,30], [60,10], [40,10]]}
                isMultiPolygon={false}
                isInverted={false}
                width={120}
                height={80}
                className="rounded-md shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Debug Info</h2>
          <div className="text-sm space-y-1">
            <p><strong>react-simple-maps version:</strong> Check package.json</p>
            <p><strong>Geography URL:</strong> {geoUrl}</p>
            <p><strong>Check browser console for geography loading logs</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapDebug;