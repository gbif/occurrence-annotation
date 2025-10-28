import { useState, useEffect, useCallback } from 'react';
import { MapComponent } from './components/MapComponent';
import { MapLibreTest } from './components/MapLibreTest';
import { SpeciesSelector, SelectedSpecies } from './components/SpeciesSelector';
import { SavedPolygons } from './components/SavedPolygons';
import { LoginButton } from './components/LoginButton';
import { AnnotationRules, AnnotationRule } from './components/AnnotationRules';

import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { Eye, EyeOff, Square, Check, X, Edit2, Search, Plus, Minus, Trash2 } from 'lucide-react';

export interface PolygonData {
  id: string;
  coordinates: [number, number][] | [number, number][][]; // Single polygon or multipolygon
  species: SelectedSpecies | null;
  timestamp: string;
  inverted?: boolean;
  annotation?: string;
  isMultiPolygon?: boolean;
}

export default function App() {
  const [selectedSpecies, setSelectedSpecies] = useState<SelectedSpecies | null>(null);
  const [savedPolygons, setSavedPolygons] = useState<PolygonData[]>([]);
  const [currentPolygon, setCurrentPolygon] = useState<[number, number][] | null>(null);
  const [isInverted, setIsInverted] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<string>('SUSPICIOUS');
  const [annotationRules, setAnnotationRules] = useState<AnnotationRule[]>([]);
  const [editingPolygonId, setEditingPolygonId] = useState<string | null>(null);
  const [showAnnotationRules, setShowAnnotationRules] = useState(true);
  const [showHigherOrderRules, setShowHigherOrderRules] = useState(false);
  const [addToMultiPolygonId, setAddToMultiPolygonId] = useState<string | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState<'polygon' | 'rectangle'>('polygon');
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [isInvestigateMode, setIsInvestigateMode] = useState(false);
  const [investigateRadius, setInvestigateRadius] = useState(50000);


  // Update all polygons' species when a species is selected or cleared globally
  useEffect(() => {
    setSavedPolygons(prev => prev.map(p => 
      ({ ...p, species: selectedSpecies })
    ));
  }, [selectedSpecies]);

  // Load polygons from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('savedPolygons');
    if (saved) {
      setSavedPolygons(JSON.parse(saved));
    }
  }, []);

  // Save polygons to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('savedPolygons', JSON.stringify(savedPolygons));
  }, [savedPolygons]);

  const handleAutoSavePolygon = useCallback((coords: [number, number][]) => {
    // Sync the map's stable refs before saving to prevent coordinate shift
    if ((window as any).__syncMapStableRefs) {
      (window as any).__syncMapStableRefs();
    }

    // Check if we're adding to an existing multipolygon
    if (addToMultiPolygonId) {
      setSavedPolygons(prev => prev.map(p => {
        if (p.id === addToMultiPolygonId) {
          const existingCoords = p.isMultiPolygon 
            ? (p.coordinates as [number, number][][])
            : [p.coordinates as [number, number][]];
          return {
            ...p,
            coordinates: [...existingCoords, coords],
            isMultiPolygon: true,
            timestamp: new Date().toISOString(),
          };
        }
        return p;
      }));
      setAddToMultiPolygonId(null);
    } else {
      // Create new polygon
      const newPolygon: PolygonData = {
        id: Date.now().toString(),
        coordinates: coords,
        species: selectedSpecies,
        timestamp: new Date().toISOString(),
        inverted: isInverted,
        annotation: currentAnnotation,
        isMultiPolygon: false,
      };

      setSavedPolygons([...savedPolygons, newPolygon]);
    }
    
    setCurrentPolygon(null);
    setIsInverted(false);
  }, [selectedSpecies, isInverted, savedPolygons, currentAnnotation, addToMultiPolygonId]);

  const handleSaveAndEdit = useCallback(() => {
    if (!currentPolygon || currentPolygon.length < 3) {
      alert('Please draw a polygon first (at least 3 points)');
      return;
    }

    // Sync the map's stable refs before saving to prevent coordinate shift
    if ((window as any).__syncMapStableRefs) {
      (window as any).__syncMapStableRefs();
    }

    const newPolygonId = Date.now().toString();
    
    // Check if we're adding to an existing multipolygon
    if (addToMultiPolygonId) {
      setSavedPolygons(prev => prev.map(p => {
        if (p.id === addToMultiPolygonId) {
          const existingCoords = p.isMultiPolygon 
            ? (p.coordinates as [number, number][][])
            : [p.coordinates as [number, number][]];
          return {
            ...p,
            coordinates: [...existingCoords, currentPolygon],
            isMultiPolygon: true,
            timestamp: new Date().toISOString(),
          };
        }
        return p;
      }));
      setAddToMultiPolygonId(null);
      setCurrentPolygon(null);
      setIsInverted(false);
    } else {
      const newPolygon: PolygonData = {
        id: newPolygonId,
        coordinates: currentPolygon,
        species: selectedSpecies,
        timestamp: new Date().toISOString(),
        inverted: isInverted,
        annotation: currentAnnotation,
        isMultiPolygon: false,
      };

      setSavedPolygons([...savedPolygons, newPolygon]);
      setCurrentPolygon(null);
      setIsInverted(false);
      
      // Small delay to ensure the polygon is saved before entering edit mode
      setTimeout(() => {
        setEditingPolygonId(newPolygonId);
      }, 0);
    }
  }, [currentPolygon, selectedSpecies, isInverted, savedPolygons, currentAnnotation, addToMultiPolygonId]);

  const handleDeletePolygon = useCallback((id: string) => {
    setSavedPolygons(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleEditPolygon = useCallback((id: string) => {
    // Toggle edit mode: if already editing this polygon, exit edit mode
    setEditingPolygonId(prev => prev === id ? null : id);
  }, []);

  const handleUpdatePolygon = useCallback((id: string, coordinates: [number, number][] | [number, number][][]) => {
    setSavedPolygons(prev => prev.map(p => 
      p.id === id ? { ...p, coordinates } : p
    ));
  }, []);

  const handleStopEditing = useCallback(() => {
    setEditingPolygonId(null);
  }, []);

  const handleToggleInvert = useCallback((id: string) => {
    setSavedPolygons(prev => prev.map(p => 
      p.id === id ? { ...p, inverted: !p.inverted } : p
    ));
  }, []);

  const handleUpdateAnnotation = useCallback((id: string, annotation: string) => {
    setSavedPolygons(prev => prev.map(p => 
      p.id === id ? { ...p, annotation } : p
    ));
  }, []);

  const handleAnnotationRulesLoad = useCallback((rules: AnnotationRule[]) => {
    setAnnotationRules(rules);
  }, []);

  const handleNavigateToPolygon = useCallback((lat: number, lng: number) => {
    // Use the global navigation function exposed by MapComponent
    if ((window as any).__navigateToLocation) {
      (window as any).__navigateToLocation(lat, lng, 6); // Zoom to level 6 for good balance of detail and context
    }
  }, []);

  const handleImportWKT = useCallback((coordinates: [number, number][] | [number, number][][], isMulti: boolean = false) => {
    // Sync the map's stable refs before saving to prevent coordinate shift
    if ((window as any).__syncMapStableRefs) {
      (window as any).__syncMapStableRefs();
    }

    const newPolygon: PolygonData = {
      id: Date.now().toString(),
      coordinates: coordinates,
      species: selectedSpecies,
      timestamp: new Date().toISOString(),
      inverted: false,
      annotation: currentAnnotation,
      isMultiPolygon: isMulti,
    };

    setSavedPolygons([...savedPolygons, newPolygon]);
  }, [selectedSpecies, savedPolygons, currentAnnotation]);

  const handleAddToMultiPolygon = useCallback((id: string | null) => {
    setAddToMultiPolygonId(id);
  }, []);

  // Drawing control functions
  const startDrawing = (mode: 'polygon' | 'rectangle') => {
    setDrawingMode(mode);
    setIsDrawing(true);
    setDrawingPoints([]);
  };

  const finishDrawing = () => {
    if (drawingMode === 'polygon' && drawingPoints.length < 3) {
      alert('Please add at least 3 points to create a polygon');
      return;
    }
    if (drawingMode === 'rectangle' && drawingPoints.length !== 2) {
      alert('Please click two opposite corners to create a rectangle');
      return;
    }

    let finalPoints = drawingPoints;
    
    // Convert rectangle to polygon (4 corners)
    if (drawingMode === 'rectangle' && drawingPoints.length === 2) {
      const [p1, p2] = drawingPoints;
      finalPoints = [
        [p1[0], p1[1]], // top-left
        [p1[0], p2[1]], // top-right
        [p2[0], p2[1]], // bottom-right
        [p2[0], p1[1]], // bottom-left
      ];
    }

    handleAutoSavePolygon(finalPoints);
    setDrawingPoints([]);
    setIsDrawing(false);
  };

  const cancelDrawing = () => {
    setDrawingPoints([]);
    setIsDrawing(false);
  };

  const clearCurrentPolygon = () => {
    setCurrentPolygon(null);
  };



  return (
    <div className="h-screen flex flex-col">
      <Toaster />
      <header className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-end" style={{ contain: 'layout' }}>
          <LoginButton />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r flex flex-col overflow-hidden z-10">
          {/* Title section moved from header */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold">
                G
              </div>
              <h1 className="text-black font-bold text-2xl">Rules</h1>
            </div>
            <p className="text-gray-600 text-sm">Create rule-based annotations for species occurrence data</p>
          </div>

          {/* Drawing Controls */}
          {!editingPolygonId && (
            <div className="p-4 border-b bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Drawing Tools</h3>
              <div className="flex flex-wrap gap-2">
                {!isDrawing ? (
                  <>
                    <Button 
                      onClick={() => startDrawing('polygon')} 
                      size="sm" 
                      variant="outline"
                      className="flex-1"
                    >
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L20 7L17 17L7 17L4 7Z"/>
                      </svg>
                      Polygon
                    </Button>
                    <Button 
                      onClick={() => startDrawing('rectangle')} 
                      size="sm" 
                      variant="outline"
                      className="flex-1"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Rectangle
                    </Button>
                    
                    {/* Investigate Area Tool */}
                    <Button
                      variant={isInvestigateMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setIsInvestigateMode(!isInvestigateMode)}
                      disabled={!selectedSpecies}
                      title={selectedSpecies ? "Click on map to investigate area for occurrences" : "Select a species first"}
                      className={`flex-1 ${isInvestigateMode ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Investigate
                    </Button>

                    {/* Radius Controls */}
                    {isInvestigateMode && (
                      <div className="w-full flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded border">
                        <span className="text-xs text-gray-600">Radius:</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => setInvestigateRadius(Math.max(1000, investigateRadius - 1000))}
                          disabled={investigateRadius <= 1000}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-sm font-medium min-w-[3rem] text-center">
                          {(investigateRadius / 1000).toFixed(0)}km
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => setInvestigateRadius(Math.min(50000, investigateRadius + 1000))}
                          disabled={investigateRadius >= 50000}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    
                    {currentPolygon && (
                      <div className="w-full flex gap-2 mt-2">
                        <Button 
                          onClick={handleSaveAndEdit} 
                          variant="outline"
                          size="sm"
                          className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-50"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Save & Edit
                        </Button>
                        <Button 
                          onClick={clearCurrentPolygon} 
                          variant="outline" 
                          size="sm"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Clear
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-full text-xs text-gray-600 mb-2">
                      {drawingMode === 'polygon' && `${drawingPoints.length} points added`}
                      {drawingMode === 'rectangle' && drawingPoints.length === 0 && 'Click first corner on map'}
                      {drawingMode === 'rectangle' && drawingPoints.length === 1 && 'Click second corner on map'}
                      {drawingMode === 'polygon' && drawingPoints.length === 0 && 'Click on map to start drawing'}
                      {drawingMode === 'polygon' && drawingPoints.length > 0 && 'Continue clicking to add points'}
                    </div>
                    <div className="w-full flex gap-2">
                      {drawingMode === 'polygon' && (
                        <Button 
                          onClick={finishDrawing} 
                          size="sm" 
                          variant="default"
                          className="flex-1"
                          disabled={drawingPoints.length < 3}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Finish
                        </Button>
                      )}
                      <Button 
                        onClick={cancelDrawing} 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Species Selector */}
          <div className="p-4 border-b bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Species Selection</h3>
            <div style={{ position: 'relative', zIndex: 50 }}>
              <SpeciesSelector
                selectedSpecies={selectedSpecies}
                onSelectSpecies={setSelectedSpecies}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
            <div className="p-4 border-b">
              <SavedPolygons
                polygons={savedPolygons}
                onDelete={handleDeletePolygon}
                onEdit={handleEditPolygon}
                editingPolygonId={editingPolygonId}
                onToggleInvert={handleToggleInvert}
                onImportWKT={handleImportWKT}
                onUpdateAnnotation={handleUpdateAnnotation}
                currentPolygon={currentPolygon}
                isCurrentInverted={isInverted}
                onCurrentAnnotationChange={(newAnnotation) => {
                  console.log('🔄 ANNOTATION CHANGED IN APP:', {
                    from: currentAnnotation,
                    to: newAnnotation
                  });
                  setCurrentAnnotation(newAnnotation);
                }}
                currentAnnotation={currentAnnotation}
                addToMultiPolygonId={addToMultiPolygonId}
                onAddToMultiPolygon={handleAddToMultiPolygon}
                onNavigateToPolygon={handleNavigateToPolygon}
              />
            </div>

            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h3 className="flex-1">Previous Rules</h3>
                {annotationRules.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAnnotationRules(!showAnnotationRules)}
                    className="h-7 w-7 p-0"
                    title={showAnnotationRules ? 'Hide rules on map' : 'Show rules on map'}
                  >
                    {showAnnotationRules ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <AnnotationRules 
                selectedSpecies={selectedSpecies}
                showHigherOrderRules={showHigherOrderRules}
                onShowHigherOrderChange={setShowHigherOrderRules}
                onRulesLoad={handleAnnotationRulesLoad}
                onNavigateToPolygon={handleNavigateToPolygon}
              />
            </div>
          </div>
        </aside>

        {/* Map - Fixed positioning to isolate from header layout changes */}
        <main className="absolute inset-0 left-80" style={{ contain: 'layout style' }}>
          <MapComponent
            selectedSpecies={selectedSpecies}
            savedPolygons={savedPolygons}
            currentPolygon={currentPolygon}
            isCurrentInverted={isInverted}
            currentAnnotation={currentAnnotation}
            onPolygonChange={(coords) => {
              console.log('📍 POLYGON CHANGED IN APP:', {
                currentAnnotation,
                pointsCount: coords?.length || 0
              });
              setCurrentPolygon(coords);
            }}
            annotationRules={annotationRules}
            showAnnotationRules={showAnnotationRules}
            editingPolygonId={editingPolygonId}
            onUpdatePolygon={handleUpdatePolygon}
            onStopEditing={handleStopEditing}
            onSaveAndEdit={handleSaveAndEdit}
            onAutoSave={handleAutoSavePolygon}
            onNavigateToLocation={handleNavigateToPolygon}
            // Drawing props
            isDrawing={isDrawing}
            drawingMode={drawingMode}
            drawingPoints={drawingPoints}
            onDrawingPointsChange={setDrawingPoints}
            isInvestigateMode={isInvestigateMode}
            investigateRadius={investigateRadius}
          />
        </main>
      </div>
    </div>
  );
}

