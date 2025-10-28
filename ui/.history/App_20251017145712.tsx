import { useState, useEffect, useCallback } from 'react';
import { MapComponent } from './components/MapComponent';
import { MapLibreTest } from './components/MapLibreTest';
import { SpeciesSelector, SelectedSpecies } from './components/SpeciesSelector';
import { SavedPolygons } from './components/SavedPolygons';
import { LoginButton } from './components/LoginButton';
import { AnnotationRules, AnnotationRule } from './components/AnnotationRules';
import { MultiPolygon } from './utils/wktParser';
import { toast } from 'sonner';

import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { Eye, EyeOff, Share2 } from 'lucide-react';

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
  const [annotationRulesRefreshTrigger, setAnnotationRulesRefreshTrigger] = useState(0);

  // URL state management functions
  const updateURLWithSpecies = (species: SelectedSpecies | null) => {
    const url = new URL(window.location.href);
    if (species) {
      url.searchParams.set('taxonKey', species.key.toString());
    } else {
      url.searchParams.delete('taxonKey');
    }
    window.history.replaceState({}, '', url.toString());
  };

  // Generate shareable URL for current state
  const getShareableURL = () => {
    const url = new URL(window.location.href);
    if (selectedSpecies) {
      url.searchParams.set('taxonKey', selectedSpecies.key.toString());
    }
    return url.toString();
  };

  // Copy shareable URL to clipboard
  const copyShareableURL = async () => {
    try {
      const url = getShareableURL();
      await navigator.clipboard.writeText(url);
      toast.success('URL copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error('Failed to copy URL to clipboard');
    }
  };

  const loadSpeciesFromURL = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const taxonKey = urlParams.get('taxonKey');
    
    if (taxonKey) {
      try {
        // Fetch species details from GBIF API using the taxon key
        const response = await fetch(`https://api.gbif.org/v1/species/${taxonKey}`);
        if (response.ok) {
          const speciesData = await response.json();
          const species: SelectedSpecies = {
            name: speciesData.canonicalName || speciesData.scientificName,
            scientificName: speciesData.scientificName,
            key: speciesData.key,
            speciesKey: speciesData.speciesKey,
            genusKey: speciesData.genusKey,
            familyKey: speciesData.familyKey,
            orderKey: speciesData.orderKey,
            classKey: speciesData.classKey,
            phylumKey: speciesData.phylumKey,
            kingdomKey: speciesData.kingdomKey,
          };
          setSelectedSpecies(species);
          console.log('🔗 Loaded species from URL:', species.scientificName);
          toast.success(`Loaded species: ${species.scientificName}`);
        } else {
          console.warn('Failed to load species from URL, taxon key not found:', taxonKey);
          toast.error(`Species with taxon key "${taxonKey}" not found`);
        }
      } catch (error) {
        console.error('Error loading species from URL:', error);
        toast.error(`Failed to load species with taxon key "${taxonKey}"`);
      }
    }
  };

  // Load species from URL on mount
  useEffect(() => {
    loadSpeciesFromURL();
    
    // Handle browser back/forward navigation
    const handlePopState = () => {
      loadSpeciesFromURL();
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update URL when species selection changes
  useEffect(() => {
    updateURLWithSpecies(selectedSpecies);
  }, [selectedSpecies]);


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

    // If there's already a saved polygon, automatically add this one to it as a multipolygon
    const existingPolygon = savedPolygons.length > 0 ? savedPolygons[savedPolygons.length - 1] : null;
    
    if (existingPolygon) {
      // Add to existing polygon as multipolygon
      setSavedPolygons(prev => prev.map(p => {
        if (p.id === existingPolygon.id) {
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
    } else {
      // Create new polygon (first one)
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
  }, [selectedSpecies, isInverted, savedPolygons, currentAnnotation]);

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
    
    // If there's already a saved polygon, automatically add this one to it as a multipolygon
    const existingPolygon = savedPolygons.length > 0 ? savedPolygons[savedPolygons.length - 1] : null;
    
    if (existingPolygon) {
      // Add to existing polygon as multipolygon
      setSavedPolygons(prev => prev.map(p => {
        if (p.id === existingPolygon.id) {
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
      setCurrentPolygon(null);
      setIsInverted(false);
      
      // Enter edit mode for the updated polygon
      setTimeout(() => {
        setEditingPolygonId(existingPolygon.id);
      }, 0);
    } else {
      // Create new polygon (first one)
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
  }, [currentPolygon, selectedSpecies, isInverted, savedPolygons, currentAnnotation]);

  const handleDeletePolygon = useCallback((id: string) => {
    setSavedPolygons(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleEditPolygon = useCallback((id: string) => {
    // Only allow one active rule at a time: if already editing this polygon, exit edit mode
    // If editing a different polygon, switch to this one
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

  const handleEditRule = useCallback((multiPolygon: MultiPolygon) => {
    try {
      // Convert MultiPolygon to PolygonData format
      let coordinates: [number, number][] | [number, number][][];
      let isMultiPolygon = false;
      let isInverted = false;
      
      // Helper function to detect if a polygon is inverted
      const isInvertedPolygon = (polygon: any): boolean => {
        const outer = polygon.outer;
        if (outer.length < 4) return false;
        
        // Check if the outer ring spans close to the entire world (-180 to 180, -85 to 85)
        const lats = outer.map((coord: [number, number]) => coord[0]);
        const lngs = outer.map((coord: [number, number]) => coord[1]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        
        // If it covers nearly the entire world and has holes, it's likely inverted
        const coversWorld = (maxLat - minLat) > 170 && (maxLng - minLng) > 350;
        const hasHoles = polygon.holes && polygon.holes.length > 0;
        
        return coversWorld && hasHoles;
      };
      
      if (multiPolygon.polygons.length === 1) {
        // Single polygon - use outer ring coordinates
        const polygon = multiPolygon.polygons[0];
        coordinates = polygon.outer;
        isInverted = isInvertedPolygon(polygon);
      } else {
        // Multiple polygons - array of coordinate arrays
        coordinates = multiPolygon.polygons.map(polygon => polygon.outer);
        isMultiPolygon = true;
        // For multi-polygons, check if any polygon is inverted
        isInverted = multiPolygon.polygons.some(polygon => isInvertedPolygon(polygon));
      }

      // Create new PolygonData object
      const newPolygonData: PolygonData = {
        id: `edit-${Date.now()}`,
        coordinates,
        species: selectedSpecies,
        timestamp: new Date().toISOString(),
        inverted: isInverted,
        annotation: currentAnnotation,
        isMultiPolygon
      };

      // Add to saved polygons for editing in Active Rules section
      setSavedPolygons(prev => [...prev, newPolygonData]);
      
      // Automatically activate edit mode for the newly created polygon
      setEditingPolygonId(newPolygonData.id);
      
      // Update the inversion state
      setIsInverted(isInverted);
      
      toast.success('Rule loaded for editing. Polygon is now active and ready for editing.');
    } catch (error) {
      console.error('Error converting rule to editable polygon:', error);
      toast.error('Failed to load rule for editing');
    }
  }, [selectedSpecies, currentAnnotation]);

  const handleRuleDeleted = useCallback(() => {
    // Trigger refresh of annotation rules when a rule is deleted during editing
    console.log('handleRuleDeleted called - triggering refresh');
    setAnnotationRulesRefreshTrigger(prev => prev + 1);
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

  const handleRuleSavedToGBIF = useCallback((savedPolygonId?: string) => {
    // Clear the current active polygon
    setCurrentPolygon(null);
    setIsInverted(false);
    
    // Remove the saved polygon from the local list since it's now saved to GBIF
    if (savedPolygonId) {
      setSavedPolygons(prev => prev.filter(p => p.id !== savedPolygonId));
      console.log('🗑️ Removed saved polygon from local list:', savedPolygonId);
    }
    
    // Trigger refresh of annotation rules to show the new rule on the map
    setAnnotationRulesRefreshTrigger(prev => prev + 1);
    
    // Show success message that disappears after 3 seconds
    toast.success('🎉 Annotation rule saved to GBIF!', {
      description: 'Your polygon has been successfully saved as an annotation rule and will appear on the map.',
      duration: 3000,
    });
    
    console.log('📤 Rule saved to GBIF - current polygon cleared and annotation rules will refresh');
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <Toaster />
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar with logo and title */}
        <aside className="w-80 bg-white border-r flex flex-col overflow-hidden z-10">
          {/* Logo and title section */}
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-2 mb-1">
              <img 
                src="/gbif-mark-green-logo.svg" 
                alt="GBIF Logo" 
                className="h-8 w-8"
              />
              <h1 className="text-black font-bold text-2xl">Rules</h1>
            </div>
            <p className="text-gray-600 text-sm">
              Create rules that will apply to past and future occurrence records
            </p>
          </div>
      {/* Species Selector */}
      <div className="p-4 border-b bg-gray-50">
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
            onNavigateToPolygon={handleNavigateToPolygon}
            onRuleSavedToGBIF={handleRuleSavedToGBIF}
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
            onEditRule={handleEditRule}
            refreshTrigger={annotationRulesRefreshTrigger}
          />
        </div>
      </div>
    </aside>

    {/* Map - Now takes full height with no header */}
    <main className="absolute inset-0 left-80" style={{ contain: 'layout style' }}>
      {/* Floating login button */}
      <div className="absolute top-4 right-4 z-20">
        <LoginButton />
      </div>
      
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
        onToggleInvert={handleToggleInvert}
        onEditPolygon={handleEditPolygon}
        onDeletePolygon={handleDeletePolygon}
      />
    </main>
      </div>
    </div>
  );
}

