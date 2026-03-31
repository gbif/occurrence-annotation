import React, { useState, useMemo, useRef } from 'react';
import { Map as PigeonMap, Overlay } from 'pigeon-maps';
import type { AnnotationRule } from '../utils/downloadProcessor';
import type { MapPoint, SpeciesHierarchy } from '../utils/mapDataFilter';
import { parseWKTGeometry, type MultiPolygon } from '../utils/wktParser';
import { toast } from 'sonner';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface DownloadResultsMapProps {
  rules: AnnotationRule[];
  flaggedPoints: MapPoint[];
  passingPoints?: MapPoint[];
  speciesInfo: Map<number, SpeciesHierarchy>;
  selectedSpecies?: number | null;
}

// Annotation type color mapping (matches main map colors)
const ANNOTATION_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  SUSPICIOUS: { fill: '#ef4444', stroke: '#dc2626', label: 'Suspicious' },
  INTRODUCED: { fill: '#d97706', stroke: '#b45309', label: 'Introduced' },
  NATIVE: { fill: '#10b981', stroke: '#059669', label: 'Native' },
  MANAGED: { fill: '#3b82f6', stroke: '#2563eb', label: 'Managed' },
  FORMER: { fill: '#a855f7', stroke: '#9333ea', label: 'Former' },
  VAGRANT: { fill: '#f97316', stroke: '#ea580c', label: 'Vagrant' },
  OTHER: { fill: '#64748b', stroke: '#475569', label: 'Other' },
};

const PASSING_COLOR = { fill: '#22c55e', stroke: '#16a34a' };

// Simple clustering: group points within same grid cell
function clusterPoints(points: MapPoint[], zoom: number): Array<{ center: [number, number]; points: MapPoint[] }> {
  const gridSize = zoom < 4 ? 10 : zoom < 6 ? 5 : zoom < 8 ? 2 : 1;
  const clusters = new Map<string, MapPoint[]>();

  points.forEach(point => {
    // Round to grid
    const gridLat = Math.floor(point.lat / gridSize) * gridSize;
    const gridLng = Math.floor(point.lng / gridSize) * gridSize;
    const key = `${gridLat},${gridLng}`;

    const existing = clusters.get(key) || [];
    existing.push(point);
    clusters.set(key, existing);
  });

  return Array.from(clusters.entries()).map(([key, pts]) => {
    const [lat, lng] = key.split(',').map(Number);
    return {
      center: [lat + gridSize / 2, lng + gridSize / 2] as [number, number],
      points: pts
    };
  });
}

// Convert lat/lng to pixel coordinates for polygon rendering
function latLngToPixel(lat: number, lng: number, zoom: number, tileSize: number = 256): [number, number] {
  const scale = tileSize * Math.pow(2, zoom);
  const worldX = (lng + 180) / 360 * scale;
  const latRad = lat * Math.PI / 180;
  const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale;
  return [worldX, worldY];
}

// GBIF base map tile provider - Web Mercator (EPSG:3857)
function gbifTileProvider(x: number, y: number, z: number) {
  // Use the same base map style as MapComponent
  const baseMapStyle = localStorage.getItem('gbifBaseMapStyle') || 'gbif-middle';
  
  // Support ArcGIS base maps if configured
  if (baseMapStyle.startsWith('arcgis-')) {
    const styleMap: { [key: string]: string } = {
      'arcgis-imagery': 'arcgis/rest/services/World_Imagery/MapServer',
      'arcgis-streets': 'arcgis/rest/services/World_Street_Map/MapServer',
      'arcgis-topographic': 'arcgis/rest/services/World_Topo_Map/MapServer',
      'arcgis-light-gray': 'arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer',
      'arcgis-dark-gray': 'arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer',
    };
    const service = styleMap[baseMapStyle] || 'arcgis/rest/services/World_Imagery/MapServer';
    return `https://services.arcgisonline.com/${service}/tile/${z}/${y}/${x}`;
  }
  
  // GBIF base maps
  return `https://tile.gbif.org/3857/omt/${z}/${x}/${y}@2x.png?style=${baseMapStyle}`;
}

export function DownloadResultsMap({
  rules,
  flaggedPoints,
  passingPoints = [],
  speciesInfo,
  selectedSpecies = null
}: DownloadResultsMapProps) {
  const [center, setCenter] = useState<[number, number]>(() => {
    // Calculate center from points
    if (flaggedPoints.length > 0) {
      const avgLat = flaggedPoints.reduce((sum, p) => sum + p.lat, 0) / flaggedPoints.length;
      const avgLng = flaggedPoints.reduce((sum, p) => sum + p.lng, 0) / flaggedPoints.length;
      return [avgLat, avgLng];
    }
    return [0, 0];
  });
  
  const [zoom, setZoom] = useState(1);

  // Filter points by selected species if provided
  const displayFlaggedPoints = useMemo(() => {
    if (selectedSpecies === null) return flaggedPoints;
    return flaggedPoints.filter(p => p.taxonKey === String(selectedSpecies));
  }, [flaggedPoints, selectedSpecies]);

  const displayPassingPoints = useMemo(() => {
    if (selectedSpecies === null) return passingPoints;
    return passingPoints.filter(p => p.taxonKey === String(selectedSpecies));
  }, [passingPoints, selectedSpecies]);

  // Cluster points based on zoom level
  const flaggedClusters = useMemo(() => 
    clusterPoints(displayFlaggedPoints, zoom),
    [displayFlaggedPoints, zoom]
  );

  const passingClusters = useMemo(() => 
    clusterPoints(displayPassingPoints, zoom),
    [displayPassingPoints, zoom]
  );

  // Filter rules by selected species and its higher taxonomic levels
  const displayRules = useMemo(() => {
    if (selectedSpecies === null) return rules;
    
    // Get hierarchy for selected species
    const hierarchy = speciesInfo.get(selectedSpecies);
    
    // Build set of all taxon keys in the hierarchy (species + all parent taxa)
    const hierarchyKeys = new Set<number>([selectedSpecies]);
    if (hierarchy) {
      if (hierarchy.genusKey) hierarchyKeys.add(hierarchy.genusKey);
      if (hierarchy.familyKey) hierarchyKeys.add(hierarchy.familyKey);
      if (hierarchy.orderKey) hierarchyKeys.add(hierarchy.orderKey);
      if (hierarchy.classKey) hierarchyKeys.add(hierarchy.classKey);
      if (hierarchy.phylumKey) hierarchyKeys.add(hierarchy.phylumKey);
      if (hierarchy.kingdomKey) hierarchyKeys.add(hierarchy.kingdomKey);
    }
    
    // Filter rules to those matching any level in the hierarchy
    return rules.filter(r => hierarchyKeys.has(r.taxonKey));
  }, [rules, selectedSpecies, speciesInfo]);

  // Count how many records each rule flagged for the current species
  const ruleRecordCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    
    // Initialize all display rules with 0
    displayRules.forEach(rule => {
      if (rule.id) counts[rule.id] = 0;
    });
    
    // Count records flagged by each rule (for current species only)
    displayFlaggedPoints.forEach(point => {
      point.ruleIds.forEach(ruleId => {
        if (counts[ruleId] !== undefined) {
          counts[ruleId]++;
        }
      });
    });
    
    return counts;
  }, [displayRules, displayFlaggedPoints]);

  // Count annotations by type
  const annotationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    displayFlaggedPoints.forEach(point => {
      point.annotations.forEach(ann => {
        counts[ann] = (counts[ann] || 0) + 1;
      });
    });
    return counts;
  }, [displayFlaggedPoints]);

  return (
    <div className="relative">
      {/* Map */}
      <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-gray-100">
        <PigeonMap
          center={center}
          zoom={zoom}
          onBoundsChanged={({ center: newCenter, zoom: newZoom }) => {
            setCenter(newCenter);
            setZoom(newZoom);
          }}
          provider={gbifTileProvider}
          mouseEvents={true}
          touchEvents={true}
        >
          {/* Render rule polygons */}
          {displayRules.map(rule => {
            if (!rule.geometry || !rule.id) return null;

            try {
              // Parse WKT geometry to MultiPolygon format
              const multiPolygon = parseWKTGeometry(rule.geometry);
              
              if (!multiPolygon || !multiPolygon.polygons || multiPolygon.polygons.length === 0) {
                return null;
              }

              // Find the first coordinate to use as anchor point
              const firstPolygon = multiPolygon.polygons[0];
              if (!firstPolygon || !firstPolygon.outer || firstPolygon.outer.length === 0) {
                return null;
              }

              const [anchorLat, anchorLng] = firstPolygon.outer[0];
              const color = ANNOTATION_COLORS[rule.annotation] || ANNOTATION_COLORS.OTHER;

              return (
                <Overlay key={`rule-${rule.id}`} anchor={[anchorLat, anchorLng]} offset={[0, 0]}>
                  <svg width="8000" height="8000" style={{ overflow: 'visible' }}>
                    {(() => {
                      // Build SVG path for all polygons in the multipolygon
                      const [anchorPixelX, anchorPixelY] = latLngToPixel(anchorLat, anchorLng, zoom);
                      let path = '';
                      
                      // Render each polygon
                      multiPolygon.polygons.forEach((polygonWithHoles) => {
                        // Outer ring
                        const outerPixels = polygonWithHoles.outer.map(([lat, lng]) => {
                          const [pixelX, pixelY] = latLngToPixel(lat, lng, zoom);
                          const offsetX = pixelX - anchorPixelX;
                          const offsetY = pixelY - anchorPixelY;
                          return [offsetX, offsetY];
                        });
                        path += `M ${outerPixels.map(([x, y]) => `${x},${y}`).join(' L ')} Z `;
                        
                        // Holes
                        polygonWithHoles.holes.forEach((hole) => {
                          const holePixels = hole.map(([lat, lng]) => {
                            const [pixelX, pixelY] = latLngToPixel(lat, lng, zoom);
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
                          fill={color.fill}
                          fillOpacity="0.15"
                          stroke={color.stroke}
                          strokeWidth="2.5"
                          strokeDasharray="8,4"
                          fillRule="evenodd"
                        />
                      );
                    })()}
                  </svg>
                </Overlay>
              );
            } catch (e) {
              console.error('Error rendering rule polygon:', e, rule.geometry);
              return null;
            }
          })}

          {/* Render flagged point clusters */}
          {flaggedClusters.map((cluster, idx) => {
            const isSinglePoint = cluster.points.length === 1;
            const point = cluster.points[0];
            const primaryAnnotation = point.annotations[0] || 'OTHER';
            const color = ANNOTATION_COLORS[primaryAnnotation] || ANNOTATION_COLORS.OTHER;

            return (
              <Overlay key={`flagged-${idx}`} anchor={cluster.center} offset={[0, 0]}>
                <div className="transform -translate-x-1/2 -translate-y-1/2">
                  {isSinglePoint ? (
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        backgroundColor: color.fill,
                        border: `2px solid ${color.stroke}`,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        minWidth: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: color.fill,
                        border: `2px solid ${color.stroke}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 6px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'white',
                      }}
                    >
                      {cluster.points.length}
                    </div>
                  )}
                </div>
              </Overlay>
            );
          })}

          {/* Render passing point clusters */}
          {passingClusters.map((cluster, idx) => (
            <Overlay key={`passing-${idx}`} anchor={cluster.center} offset={[0, 0]}>
              <div className="transform -translate-x-1/2 -translate-y-1/2">
                {cluster.points.length === 1 ? (
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: 'transparent',
                      border: `2px solid ${PASSING_COLOR.stroke}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(34, 197, 94, 0.3)',
                      border: `2px solid ${PASSING_COLOR.stroke}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                      color: PASSING_COLOR.stroke,
                    }}
                  >
                    {cluster.points.length}
                  </div>
                )}
              </div>
            </Overlay>
          ))}
        </PigeonMap>
      </div>

      {/* Active Rules Panel */}
      {displayRules.length > 0 && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-[300px] max-h-[400px] overflow-y-auto">
          <div className="font-semibold mb-2 text-sm">
            Rules Applied ({displayRules.length})
          </div>
          <div className="space-y-2">
            {displayRules.map((rule, index) => {
              const color = ANNOTATION_COLORS[rule.annotation] || ANNOTATION_COLORS.SUSPICIOUS;
              const recordCount = rule.id ? (ruleRecordCounts[rule.id] || 0) : 0;
              
              // Check if this is a complex rule (has additional criteria beyond spatial/taxonomic)
              const isComplexRule = !!(
                rule.datasetKey ||
                (rule.basisOfRecord && rule.basisOfRecord.length > 0) ||
                rule.yearRange ||
                rule.basisOfRecordNegated
              );
              
              // Determine the taxonomic rank of this rule
              let rankLabel = 'Species';
              if (selectedSpecies !== null) {
                const hierarchy = speciesInfo.get(selectedSpecies);
                if (hierarchy) {
                  if (rule.taxonKey === hierarchy.genusKey) rankLabel = 'Genus';
                  else if (rule.taxonKey === hierarchy.familyKey) rankLabel = 'Family';
                  else if (rule.taxonKey === hierarchy.orderKey) rankLabel = 'Order';
                  else if (rule.taxonKey === hierarchy.classKey) rankLabel = 'Class';
                  else if (rule.taxonKey === hierarchy.phylumKey) rankLabel = 'Phylum';
                  else if (rule.taxonKey === hierarchy.kingdomKey) rankLabel = 'Kingdom';
                }
              }
              
              return (
                <div key={rule.id || index} className="text-xs border-b pb-2 last:border-b-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '2px',
                        backgroundColor: color.fill,
                        border: `2px solid ${color.stroke}`,
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-gray-900">{color.label}</div>
                        <div className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${recordCount > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                          {recordCount} record{recordCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>Rule #{rule.id} • {rankLabel}-level</span>
                        {isComplexRule && (
                          <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-700">
                            Complex
                          </span>
                        )}
                      </div>
                      {rule.projectId && (
                        <div className="text-gray-400 mt-1 text-[10px]">
                          Project ID: {rule.projectId}
                        </div>
                      )}
                      {rule.datasetKey && (
                        <div className="text-gray-400 mt-1 text-[10px]">
                          Dataset: {rule.datasetKey}
                        </div>
                      )}
                      {rule.basisOfRecord && rule.basisOfRecord.length > 0 && (
                        <div className="text-gray-400 mt-1 text-[10px]">
                          Basis: {rule.basisOfRecord.join(', ')}
                        </div>
                      )}
                      {rule.yearRange && (
                        <div className="text-gray-400 mt-1 text-[10px]">
                          Years: {rule.yearRange}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 text-xs max-w-[200px]">
        <div className="font-semibold mb-2">Annotation Types</div>
        <div className="space-y-1">
          {Object.entries(annotationCounts).map(([type, count]) => {
            const color = ANNOTATION_COLORS[type] || ANNOTATION_COLORS.OTHER;
            return (
              <div key={type} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: color.fill,
                      border: `2px solid ${color.stroke}`,
                    }}
                  />
                  <span>{color.label}</span>
                </div>
                <span className="text-gray-500">{count}</span>
              </div>
            );
          })}
          {displayPassingPoints.length > 0 && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t">
              <div className="flex items-center gap-1.5">
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: 'transparent',
                    border: `2px solid ${PASSING_COLOR.stroke}`,
                  }}
                />
                <span>No annotations</span>
              </div>
              <span className="text-gray-500">{displayPassingPoints.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => setZoom(Math.min(18, zoom + 1))}
          className="bg-white rounded shadow-lg p-2 hover:bg-gray-50"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(Math.max(1, zoom - 1))}
          className="bg-white rounded shadow-lg p-2 hover:bg-gray-50"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
