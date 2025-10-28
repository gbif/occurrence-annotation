import { useState, useEffect, useCallback } from 'react';
import { MapComponent } from './components/MapComponent';
import { SpeciesSelector, SelectedSpecies } from './components/SpeciesSelector';
import { SavedPolygons } from './components/SavedPolygons';
import { LoginButton } from './components/LoginButton';
import { AnnotationRules, AnnotationRule } from './components/AnnotationRules';

import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

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



  return (
    <div className="h-screen flex flex-col">
      <Toaster />
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-2" style={{ contain: 'layout' }}>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold">
              G
            </div>
            <h1 className="text-green-700">Rules</h1>
          </div>
          <LoginButton />
        </div>
        <p className="text-gray-600 text-sm mb-3" style={{ contain: 'layout' }}>Create rule-based annotations for species occurrence data</p>
        <div className="flex items-center gap-4 min-h-[40px] max-h-[60px]" style={{ overflow: 'visible' }}>
          <div className="flex-1 max-w-2xl" style={{ position: 'relative', zIndex: 50 }}>
            <SpeciesSelector
              selectedSpecies={selectedSpecies}
              onSelectSpecies={setSelectedSpecies}
            />
          </div>

        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r flex flex-col overflow-hidden z-10">
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
            isInvestigateMode={isInvestigateMode}
            investigateRadius={investigateRadius}
          />
        </main>
      </div>
    </div>
  );
}

