import React from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';

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

        {/* Test 4: With Sample Polygon */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3">Test 4: With Sample Polygon (Europe)</h2>
          <div className="border border-gray-300 rounded overflow-hidden" style={{ backgroundColor: '#4a5568' }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                center: [10, 50], // Center on Europe
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
              {/* Sample polygon over Europe */}
              <path
                d="M 0,45 L 20,45 L 20,55 L 0,55 Z"
                fill="rgba(34, 197, 94, 0.3)"
                stroke="#22c55e"
                strokeWidth={2}
              />
            </ComposableMap>
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