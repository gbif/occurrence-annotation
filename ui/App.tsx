import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapComponent } from './components/MapComponent';
import { SpeciesSelector, SelectedSpecies } from './components/SpeciesSelector';
import { SavedPolygons } from './components/SavedPolygons';
import { LoginButton } from './components/LoginButton';
import { AnnotationRules, AnnotationRule } from './components/AnnotationRules';
import { OccurrenceFilterOptions } from './components/OccurrenceFilters';
import { toast } from 'sonner';
import { getGbifApiUrl, getAnnotationApiUrl } from './utils/apiConfig';
import { parseWKTGeometry, PolygonWithHoles, MultiPolygon, isInvertedPolygon } from './utils/wktParser';
import { unionPolygons } from './utils/spatialOperations';
import { getSpeciesInfo } from './utils/speciesCache';

import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { Eye, EyeOff, Folder, X, Network, User, Loader2, HelpCircle, ThumbsDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import gbifLogo from './gbif-mark-green-logo.svg';
import { getSelectedProjectId, getSelectedProjectName } from './utils/projectSelection';

interface VocabularyTerm {
  term: string;
  description: string;
  color: string;
  locked: boolean;
}

export interface PolygonData {
  id: string;
  coordinates: [number, number][] | [number, number][][]; // Single polygon or multipolygon
  species: SelectedSpecies | null;
  timestamp: string;
  inverted?: boolean;
  annotation?: string;
  isMultiPolygon?: boolean;
  initialFilters?: {
    datasetKey?: string;
    basisOfRecord?: string[];
  };
  fromSearch?: boolean; // Flag to indicate polygon was created from search button
  // Fields for editing existing rules
  editingOriginalRuleId?: number;        // ID of the rule being edited
  basisOfRecord?: string[];              // Basis of record filter
  basisOfRecordNegated?: boolean;        // Whether basis of record is negated
  datasetKey?: string;                   // Dataset filter
  yearRange?: string;                    // Year range filter
  projectId?: number;                    // Project assignment
}

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSpecies, setSelectedSpecies] = useState<SelectedSpecies | null>(null);
  const [savedPolygons, setSavedPolygons] = useState<PolygonData[]>([]);
  const [currentPolygon, setCurrentPolygon] = useState<[number, number][] | null>(null);
  const [isInverted, setIsInverted] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState<string>('SUSPICIOUS');
  const [annotationRules, setAnnotationRules] = useState<AnnotationRule[]>([]);
  const [editingPolygonId, setEditingPolygonId] = useState<string | null>(null);
  const [showAnnotationRules, setShowAnnotationRules] = useState(true);
  const [showHigherOrderRules, setShowHigherOrderRules] = useState(false);
  const [showMyRulesOnly, setShowMyRulesOnly] = useState(false);
  const [showContestedRules, setShowContestedRules] = useState(false);
  const [annotationRulesRefreshTrigger, setAnnotationRulesRefreshTrigger] = useState(0);
  const [filterByActiveProject, setFilterByActiveProject] = useState(false);
  
  // Selected project for new rules
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => getSelectedProjectId());
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [projects, setProjects] = useState<Array<{id: number, name: string, description: string, members: string[]}>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(() => getSelectedProjectName());
  
  // Project taxa navigation
  const [projectTaxa, setProjectTaxa] = useState<Array<{key: number, scientificName: string}>>([]);
  const [currentProjectTaxonIndex, setCurrentProjectTaxonIndex] = useState<number>(-1);
  const [loadingProjectTaxa, setLoadingProjectTaxa] = useState(false);
  
  // Occurrence filters for map
  const [occurrenceFilters, setOccurrenceFilters] = useState<OccurrenceFilterOptions>({
    hasGeospatialIssue: false, // Default to excluding geospatial issues
    basisOfRecord: [
      'HUMAN_OBSERVATION',
      'PRESERVED_SPECIMEN',
      'LIVING_SPECIMEN',
      'MACHINE_OBSERVATION',
      'MATERIAL_SAMPLE',
      'OCCURRENCE',
      'MATERIAL_CITATION'
    ], // All except FOSSIL_SPECIMEN
    showOnlyPresent: true // Default to showing only PRESENT occurrences (recommended)
  });
  
  // Vocabulary for dynamic annotation colors
  const [vocabulary, setVocabulary] = useState<VocabularyTerm[]>([
    { term: 'SUSPICIOUS', description: 'Suspicious occurrence', color: '#ef4444', locked: true },
    { term: 'NATIVE', description: 'Native species', color: '#22c55e', locked: false },
    { term: 'MANAGED', description: 'Managed population', color: '#a855f7', locked: false },
    { term: 'FORMER', description: 'Former population', color: '#f97316', locked: false },
    { term: 'VAGRANT', description: 'Vagrant occurrence', color: '#06b6d4', locked: false },
    { term: 'INTRODUCED', description: 'Introduced species', color: '#3b82f6', locked: false },
  ]);
  
  // Note: Countries are now converted to PolygonData when selected (no separate state)

  // URL state management functions - uses react-router's searchParams for HashRouter compatibility
  const updateURLWithSpecies = (species: SelectedSpecies | null) => {
    if (species) {
      setSearchParams({ taxonKey: species.key.toString() }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  // Fetch vocabulary based on selected project
  useEffect(() => {
    const fetchVocabulary = async () => {
      const projectId = getSelectedProjectId();
      
      if (!projectId) {
        // No project selected, use default vocabulary
        return;
      }

      try {
        const response = await fetch(getAnnotationApiUrl(`/project/${projectId}/vocabulary`));
        
        if (!response.ok) {
          console.error('Failed to fetch vocabulary, using defaults');
          return;
        }

        const data = await response.json();
        setVocabulary(data);
      } catch (error) {
        console.error('Error fetching vocabulary:', error);
        // Keep default vocabulary on error
      }
    };

    fetchVocabulary();
  }, [selectedProjectId]); // Re-fetch when project changes

  // Copy shareable URL to clipboard (currently unused)
  // const copyShareableURL = async () => {
  //   try {
  //     const url = getShareableURL();
  //     await navigator.clipboard.writeText(url);
  //     toast.success('URL copied to clipboard!');
  //   } catch (error) {
  //     console.error('Failed to copy URL:', error);
  //     toast.error('Failed to copy URL to clipboard');
  //   }
  // };

  const loadSpeciesFromURL = async () => {
    // Use searchParams from react-router (reads from hash with HashRouter)
    const taxonKey = searchParams.get('taxonKey');
    const ruleId = searchParams.get('ruleId') || searchParams.get('id');
    
    if (taxonKey) {
      try {
        // Fetch species details from GBIF API using the taxon key
        const response = await fetch(getGbifApiUrl(`/species/${taxonKey}`));
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
          toast.success(`Loaded species: ${species.scientificName}`);
        } else {
          console.warn('Failed to load species from URL, taxon key not found:', taxonKey);
          toast.error(`Species with taxon key "${taxonKey}" not found`);
        }
      } catch (error) {
        console.error('Error loading species from URL:', error);
        toast.error(`Failed to load species with taxon key "${taxonKey}"`);
      }
    } else {
      // No URL parameters, try to load last selected species from localStorage
      try {
        const lastSpeciesStr = localStorage.getItem('lastSelectedSpecies');
        if (lastSpeciesStr) {
          const lastSpecies = JSON.parse(lastSpeciesStr);
          setSelectedSpecies(lastSpecies);
          // Don't show a toast for restored species to avoid noise on page load
        }
      } catch (error) {
        console.error('Error loading last selected species from localStorage:', error);
        // Clean up corrupted data
        localStorage.removeItem('lastSelectedSpecies');
      }
    }

    // If there's a rule ID, fetch the rule and display it on the map
    if (ruleId) {
      try {
        const resp = await fetch(getAnnotationApiUrl(`/rule/${ruleId}`));
        if (resp.ok) {
          const ruleData = await resp.json();
          const multiPolygon = parseWKTGeometry(ruleData.geometry || ruleData.wkt || '');

          // Add to local annotationRules so MapComponent will render it
          const ruleWithCoords = { ...ruleData, multiPolygon } as AnnotationRule;
          setAnnotationRules(prev => {
            // Prevent duplicates in StrictMode (React runs effects twice in dev)
            if (prev.some(r => r.id === ruleData.id)) {
              return prev;
            }
            return [ruleWithCoords, ...prev];
          });
          setShowAnnotationRules(true);

          // Note: Removed automatic zoom to rule - mini map preview shows location

          toast.success(`Viewing rule: ${ruleId.slice(-8)}`, {
            description: 'Rule has been highlighted on the map',
          });
        } else {
          toast.error(`Rule ${ruleId} not found`);
        }
      } catch (err) {
        console.error('Error fetching rule by id from URL:', err);
        toast.error('Failed to load rule from URL');
      }
    }
  };

  // Load species from URL on mount and when searchParams change (e.g., navigation)
  useEffect(() => {
    loadSpeciesFromURL();
  }, [searchParams]);

  // Handle loading rule for editing from UserPage/ProjectPage
  useEffect(() => {
    const loadRule = searchParams.get('loadRule');
    if (loadRule === 'true') {
      const ruleDataStr = localStorage.getItem('ruleToEdit');
      if (ruleDataStr) {
        try {
          const ruleData = JSON.parse(ruleDataStr);
          // Call handleLoadRuleForEditing with the rule data
          handleLoadRuleForEditing(ruleData).then(() => {
            // Clean up
            localStorage.removeItem('ruleToEdit');
            // Remove loadRule parameter from URL
            const updatedSearchParams = new URLSearchParams(searchParams);
            updatedSearchParams.delete('loadRule');
            setSearchParams(updatedSearchParams);
          });
        } catch (err) {
          console.error('Error loading rule from localStorage:', err);
          toast.error('Failed to load rule for editing');
          localStorage.removeItem('ruleToEdit');
        }
      }
    }
  }, [searchParams]);

  // Listen for changes to selected project from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedProjectId') {
        setSelectedProjectId(getSelectedProjectId());
        setSelectedProjectName(getSelectedProjectName());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle clearing project selection
  const handleClearProjectSelection = () => {
    localStorage.removeItem('selectedProjectId');
    localStorage.removeItem('selectedProjectName');
    setSelectedProjectId(null);
    setSelectedProjectName(null);
    setProjectTaxa([]);
    setCurrentProjectTaxonIndex(-1);
    toast.info('Project selection cleared');
  };
  
  // Fetch project taxa when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectTaxa(selectedProjectId);
    }
  }, [selectedProjectId]); // Re-fetch when project selection changes

  // Fetch projects when dialog opens
  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      // Get current user from sessionStorage
      const savedUser = sessionStorage.getItem('gbifUser');
      if (!savedUser) {
        setProjects([]);
        toast.info('Please log in to see your projects');
        return;
      }
      
      const user = JSON.parse(savedUser);
      const username = user.userName;
      
      // Fetch only projects where user is a member or creator
      const response = await fetch(getAnnotationApiUrl(`/project?member=${username}`));
      if (response.ok) {
        const data = await response.json();
        const activeProjects = data.filter((p: any) => !p.deleted).sort((a: any, b: any) => b.id - a.id);
        setProjects(activeProjects);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      toast.error('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch taxa from project rules
  const fetchProjectTaxa = async (projectId: number) => {
    setLoadingProjectTaxa(true);
    try {
      const response = await fetch(getAnnotationApiUrl(`/rule?projectId=${projectId}&limit=100`));
      if (response.ok) {
        const rules = await response.json();
        
        // Extract unique taxon keys
        const uniqueTaxonKeys = Array.from(new Set(
          rules.map((rule: any) => rule.taxonKey).filter((key: number | undefined) => key !== undefined)
        )) as number[];
        
        // Fetch all species info in parallel using speciesCache
        const speciesResults = await Promise.allSettled(
          uniqueTaxonKeys.map(taxonKey => getSpeciesInfo(taxonKey))
        );
        
        // Build taxa list from successful results
        const uniqueTaxa: Array<{key: number, scientificName: string}> = [];
        speciesResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            uniqueTaxa.push({
              key: result.value.key,
              scientificName: result.value.scientificName || result.value.canonicalName || `Taxon ${uniqueTaxonKeys[index]}`
            });
          } else if (result.status === 'rejected') {
            console.error(`Error fetching species info for ${uniqueTaxonKeys[index]}:`, result.reason);
          }
        });
        
        setProjectTaxa(uniqueTaxa);
        setCurrentProjectTaxonIndex(uniqueTaxa.length > 0 ? 0 : -1);
      }
    } catch (err) {
      console.error('Error fetching project rules:', err);
    } finally {
      setLoadingProjectTaxa(false);
    }
  };
  
  // Handle selecting a project
  const handleSelectProject = (projectId: number, projectName: string) => {
    setSelectedProjectId(projectId);
    setSelectedProjectName(projectName);
    localStorage.setItem('selectedProjectId', projectId.toString());
    localStorage.setItem('selectedProjectName', projectName);
    setIsProjectDialogOpen(false);
    toast.success(`Selected project: ${projectName}`);
    // Taxa will be fetched automatically by the useEffect that watches selectedProjectId
  };
  
  // Navigate to previous/next taxon in project
  const navigateProjectTaxa = (direction: 'prev' | 'next') => {
    if (projectTaxa.length === 0) return;
    
    let newIndex = currentProjectTaxonIndex;
    if (direction === 'prev') {
      newIndex = currentProjectTaxonIndex > 0 ? currentProjectTaxonIndex - 1 : projectTaxa.length - 1;
    } else {
      newIndex = currentProjectTaxonIndex < projectTaxa.length - 1 ? currentProjectTaxonIndex + 1 : 0;
    }
    
    setCurrentProjectTaxonIndex(newIndex);
    const taxon = projectTaxa[newIndex];
    
    // Update the selected species
    setSelectedSpecies({
      key: taxon.key,
      scientificName: taxon.scientificName,
      name: taxon.scientificName
    });
  };

  // Update URL when species selection changes (but not on initial load from URL)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  useEffect(() => {
    if (initialLoadComplete) {
      updateURLWithSpecies(selectedSpecies);
    } else {
      setInitialLoadComplete(true);
    }
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
      try {
        const parsed = JSON.parse(saved);
        setSavedPolygons(parsed);
      } catch (error) {
        console.error('Failed to parse savedPolygons from localStorage:', error);
        // Clean up corrupted data
        localStorage.removeItem('savedPolygons');
        toast.error('Saved polygons data was corrupted and has been reset');
      }
    }
  }, []);

  // Save polygons to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('savedPolygons', JSON.stringify(savedPolygons));
  }, [savedPolygons]);

  // Save selected species to localStorage whenever it changes
  useEffect(() => {
    if (selectedSpecies) {
      localStorage.setItem('lastSelectedSpecies', JSON.stringify(selectedSpecies));
    } else {
      localStorage.removeItem('lastSelectedSpecies');
    }
  }, [selectedSpecies]);

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

      console.log('Auto-saving new polygon with initialFilters:', newPolygon.initialFilters);

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

      console.log('Creating new polygon with initialFilters:', newPolygon.initialFilters);

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
    setSavedPolygons(prev => prev.map(p => {
      if (p.id === id) {
        // Detect if coordinates are multipolygon
        const isMultiPolygon = Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]);
        return { ...p, coordinates, isMultiPolygon };
      }
      return p;
    }));
  }, []);

  const handleStopEditing = useCallback(() => {
    setEditingPolygonId(null);
  }, []);

  const handleCreateRuleFromSearch = useCallback((coords: [number, number][], metadata?: { basisOfRecord?: string[]; datasetKey?: string }) => {
    console.log('handleCreateRuleFromSearch called with coords:', coords.length);
    console.log('Metadata from search results:', metadata);
    
    // Use metadata from search results if provided, otherwise fall back to current filters
    const initialFilters: PolygonData['initialFilters'] = {};
    
    if (metadata?.datasetKey) {
      initialFilters.datasetKey = metadata.datasetKey;
      console.log('Using datasetKey from search results:', metadata.datasetKey);
    } else if (occurrenceFilters.datasetKey && occurrenceFilters.datasetKey.split(',').length === 1) {
      initialFilters.datasetKey = occurrenceFilters.datasetKey;
      console.log('Using datasetKey from filters:', occurrenceFilters.datasetKey);
    }
    
    if (metadata?.basisOfRecord && metadata.basisOfRecord.length > 0) {
      initialFilters.basisOfRecord = metadata.basisOfRecord;
      console.log('Using basisOfRecord from search results:', metadata.basisOfRecord);
    } else if (occurrenceFilters.basisOfRecord && occurrenceFilters.basisOfRecord.length > 0) {
      initialFilters.basisOfRecord = [...occurrenceFilters.basisOfRecord];
      console.log('Using basisOfRecord from filters:', occurrenceFilters.basisOfRecord);
    }

    const newPolygonId = Date.now().toString();
    const newPolygon: PolygonData = {
      id: newPolygonId,
      coordinates: coords,
      species: selectedSpecies,
      timestamp: new Date().toISOString(),
      inverted: false,
      annotation: currentAnnotation,
      isMultiPolygon: false,
      initialFilters: Object.keys(initialFilters).length > 0 ? initialFilters : undefined,
      fromSearch: true // Mark this polygon as created from search
    };

    console.log('Creating polygon from search with initialFilters:', newPolygon.initialFilters);

    // Add to saved polygons
    setSavedPolygons(prev => [...prev, newPolygon]);
    
    // Clear current polygon
    setCurrentPolygon(null);
  }, [selectedSpecies, currentAnnotation, occurrenceFilters]);

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
    
    setSavedPolygons(prev => [...prev, newPolygon]);
  }, [selectedSpecies, savedPolygons, currentAnnotation]);

  const handleSaveMultiplePolygons = useCallback((polygons: [number, number][][]) => {
    console.log('[App] handleSaveMultiplePolygons called with', polygons.length, 'polygons');
    
    const newPolygons: PolygonData[] = polygons.map((coords, index) => ({
      id: `${Date.now()}-${index}`,
      coordinates: coords,
      species: selectedSpecies,
      timestamp: new Date().toISOString(),
      inverted: false,
      annotation: currentAnnotation,
      isMultiPolygon: false,
    }));

    setSavedPolygons(prev => [...prev, ...newPolygons]);
    console.log('[App] Saved', newPolygons.length, 'land polygons');
  }, [selectedSpecies, currentAnnotation]);

  const handleMergeAllPolygons = useCallback(() => {
    console.log('[App] handleMergeAllPolygons called with', savedPolygons.length, 'polygons');
    
    if (savedPolygons.length < 2) {
      toast.error('Need at least 2 polygons to merge');
      return;
    }

    // Collect all polygon coordinates
    const allCoordinates: [number, number][][] = [];
    
    for (const polygon of savedPolygons) {
      if (polygon.isMultiPolygon) {
        // Already a multi-polygon, add all its parts
        const coords = polygon.coordinates as [number, number][][];
        allCoordinates.push(...coords);
      } else {
        // Single polygon, add it
        allCoordinates.push(polygon.coordinates as [number, number][]);
      }
    }

    // Create merged multi-polygon
    const mergedPolygon: PolygonData = {
      id: `merged-${Date.now()}`,
      coordinates: allCoordinates,
      species: selectedSpecies,
      timestamp: new Date().toISOString(),
      inverted: false,
      annotation: currentAnnotation,
      isMultiPolygon: true,
    };

    // Replace all polygons with the merged one
    setSavedPolygons([mergedPolygon]);
    
    toast.success(`Merged ${savedPolygons.length} polygons into a single multi-polygon`, {
      description: `Contains ${allCoordinates.length} polygon part${allCoordinates.length > 1 ? 's' : ''}`
    });
    
    console.log('[App] Merged into multi-polygon with', allCoordinates.length, 'parts');
  }, [savedPolygons, selectedSpecies, currentAnnotation]);

  const handleSplitMultiPolygon = useCallback((id: string) => {
    console.log('[App] handleSplitMultiPolygon called for polygon:', id);
    
    const polygon = savedPolygons.find(p => p.id === id);
    
    if (!polygon) {
      toast.error('Polygon not found');
      return;
    }
    
    if (!polygon.isMultiPolygon) {
      toast.error('This is not a multi-polygon');
      return;
    }
    
    const coords = polygon.coordinates as [number, number][][];
    
    if (coords.length < 2) {
      toast.error('Multi-polygon only has one part');
      return;
    }
    
    // Create separate polygons for each part
    const newPolygons: PolygonData[] = coords.map((partCoords, index) => ({
      id: `${Date.now()}-split-${index}`,
      coordinates: partCoords,
      species: polygon.species,
      timestamp: new Date().toISOString(),
      inverted: polygon.inverted || false,
      annotation: polygon.annotation,
      isMultiPolygon: false,
      initialFilters: polygon.initialFilters,
      fromSearch: polygon.fromSearch,
    }));
    
    // Replace the multi-polygon with separate polygons
    setSavedPolygons(prev => [
      ...prev.filter(p => p.id !== id),
      ...newPolygons
    ]);
    
    // Exit edit mode
    setEditingPolygonId(null);
    
    toast.success(`Split multi-polygon into ${newPolygons.length} separate polygons`);
    
    console.log('[App] Split into', newPolygons.length, 'separate polygons');
  }, [savedPolygons]);

  const handleUnionPolygons = useCallback(async () => {
    console.log('[App] handleUnionPolygons called with', savedPolygons.length, 'polygons');
    
    try {
      // Collect all polygon coordinates
      const allPolygonParts: [number, number][][] = [];
      
      for (const polygon of savedPolygons) {
        if (polygon.isMultiPolygon) {
          // Multi-polygon: add all its parts
          const coords = polygon.coordinates as [number, number][][];
          allPolygonParts.push(...coords);
        } else {
          // Single polygon: add it
          allPolygonParts.push(polygon.coordinates as [number, number][]);
        }
      }

      // Validate we have enough parts to union
      if (allPolygonParts.length < 2) {
        toast.error('Need at least 2 polygon parts to union');
        return;
      }

      console.log(`Computing union of ${allPolygonParts.length} total polygon parts...`);
      
      // Compute geometric union
      const result = unionPolygons(allPolygonParts);
      
      if (!result) {
        toast.error('Union operation failed', {
          description: 'Could not merge the polygons'
        });
        return;
      }

      // Create the unified polygon
      const isMulti = Array.isArray(result[0]) && Array.isArray(result[0][0]);
      
      const unionedPolygon: PolygonData = {
        id: `union-${Date.now()}`,
        coordinates: result,
        species: selectedSpecies,
        timestamp: new Date().toISOString(),
        inverted: false,
        annotation: currentAnnotation,
        isMultiPolygon: isMulti,
      };

      // Replace all polygons with the unified one
      setSavedPolygons([unionedPolygon]);
      
      if (isMulti) {
        const parts = result as [number, number][][];
        toast.success(`Unioned ${savedPolygons.length} polygons`, {
          description: `Result has ${parts.length} disconnected piece${parts.length > 1 ? 's' : ''}`
        });
      } else {
        const vertices = (result as [number, number][]).length;
        toast.success(`Unioned ${savedPolygons.length} polygons into one`, {
          description: `${vertices} vertices`
        });
      }
      
      console.log('[App] Union completed, result is', isMulti ? 'multi-polygon' : 'single polygon');
    } catch (error) {
      console.error('Union operation error:', error);
      toast.error('Failed to union polygons', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [savedPolygons, selectedSpecies, currentAnnotation]);

  const handleRuleSavedToGBIF = useCallback((savedPolygonId?: string) => {
    // Clear the current active polygon
    setCurrentPolygon(null);
    setIsInverted(false);
    
    // Reset annotation to default
    setCurrentAnnotation('SUSPICIOUS');
    
    // Remove the saved polygon from the local list since it's now saved to GBIF
    if (savedPolygonId) {
      setSavedPolygons(prev => prev.filter(p => p.id !== savedPolygonId));
    }
    
    // Trigger refresh of annotation rules to show the new rule on the map
    setAnnotationRulesRefreshTrigger(prev => prev + 1);
    
    // Show success message that disappears after 3 seconds
    toast.success('🎉 Annotation rule saved to GBIF!', {
      description: 'Your polygon has been successfully saved as an annotation rule and will appear on the map.',
      duration: 3000,
    });
  }, []);

  const handleLoadRuleForEditing = useCallback(async (rule: AnnotationRule) => {
    try {
      // Parse WKT geometry to coordinates
      const parsedGeometry = parseWKTGeometry(rule.geometry);
      if (!parsedGeometry) {
        toast.error('Failed to parse rule geometry');
        return false;
      }

      // Detect if this is an inverted polygon and extract coordinates
      let coordinates: [number, number][] | [number, number][][];
      let isMultiPolygon = false;
      let isInverted = false;
      
      // Check if it's a PolygonWithHoles structure (single polygon with optional holes)
      if ('holes' in parsedGeometry) {
        const polygonWithHoles = parsedGeometry as PolygonWithHoles;
        
        // Use proper inversion detection based on outer ring covering the world
        const isOriginallyInverted = isInvertedPolygon(polygonWithHoles);
        
        if (isOriginallyInverted) {
          // Inverted polygon - load the holes as the editable regions
          isInverted = true;
          
          if (polygonWithHoles.holes.length === 1) {
            // Single hole - load as single polygon
            coordinates = polygonWithHoles.holes[0];
            isMultiPolygon = false;
          } else {
            // Multiple holes - load as multi-polygon so all excluded regions can be edited
            coordinates = polygonWithHoles.holes;
            isMultiPolygon = true;
          }
        } else if (polygonWithHoles.holes.length > 0) {
          // Normal polygon with holes (not inverted) - warn that holes will be lost
          toast.warning('This rule contains interior holes', {
            description: 'Interior holes will be removed when editing. Only the outer boundary will be preserved.',
            duration: 8000,
          });
          coordinates = polygonWithHoles.outer;
        } else {
          // No holes, just a regular polygon
          coordinates = polygonWithHoles.outer;
        }
      }
      // Check if it's a MultiPolygon structure
      else if ('polygons' in parsedGeometry) {
        const multiPolygon = parsedGeometry as MultiPolygon;
        
        // Check if any of the polygons have holes
        const hasHoles = multiPolygon.polygons.some(p => p.holes && p.holes.length > 0);
        if (hasHoles) {
          toast.warning('This rule contains polygon holes (interior rings)', {
            description: 'Interior rings will be removed when editing. The edited geometry will only include outer boundaries.',
            duration: 8000,
          });
        }
        
        if (multiPolygon.polygons.length === 1) {
          // Single polygon - use outer ring only (ignoring holes)
          coordinates = multiPolygon.polygons[0].outer;
        } else {
          // Multiple polygons
          coordinates = multiPolygon.polygons.map(p => p.outer);
          isMultiPolygon = true;
        }
      }
      else {
        toast.error('Unknown geometry type');
        return false;
      }

      // Fetch species data if we don't have it or if it's different from current
      let species = selectedSpecies;
      if (!species || species.key !== rule.taxonKey) {
        try {
          const speciesResponse = await fetch(getGbifApiUrl(`/species/${rule.taxonKey}`));
          if (speciesResponse.ok) {
            const speciesData = await speciesResponse.json();
            species = {
              key: rule.taxonKey,
              scientificName: speciesData.scientificName || rule.scientificName || 'Unknown',
              name: speciesData.scientificName || rule.scientificName || 'Unknown'
            };
            setSelectedSpecies(species);
            if (species) {
              toast.info(`Switched to species: ${species.scientificName}`);
            }
          } else {
            // Fallback to rule's scientific name if available
            species = {
              key: rule.taxonKey,
              scientificName: rule.scientificName || 'Unknown',
              name: rule.scientificName || 'Unknown'
            };
            setSelectedSpecies(species);
          }
        } catch (err) {
          console.error('Failed to fetch species data:', err);
          // Fallback to rule's scientific name
          species = {
            key: rule.taxonKey,
            scientificName: rule.scientificName || 'Unknown',
            name: rule.scientificName || 'Unknown'
          };
          setSelectedSpecies(species);
        }
      }

      // Create PolygonData with all rule attributes
      const newPolygon: PolygonData = {
        id: Date.now().toString(),
        coordinates: coordinates,
        species: species,
        timestamp: new Date().toISOString(),
        inverted: isInverted,
        annotation: rule.annotation,
        isMultiPolygon: isMultiPolygon,
        editingOriginalRuleId: rule.id,
        basisOfRecord: rule.basisOfRecord || undefined,
        basisOfRecordNegated: rule.basisOfRecordNegated || false,
        datasetKey: rule.datasetKey || undefined,
        yearRange: rule.yearRange || undefined,
        projectId: rule.projectId || undefined,
        fromSearch: false
      };

      // Add to savedPolygons
      setSavedPolygons(prev => [...prev, newPolygon]);
      
      // Update currentAnnotation to match the loaded rule's annotation
      setCurrentAnnotation(rule.annotation);
      
      toast.success('Rule loaded for editing', {
        description: 'Modify the polygon and attributes, then save to create a new rule.',
        duration: 5000,
      });

      return true;
    } catch (error) {
      console.error('Error loading rule for editing:', error);
      toast.error('Failed to load rule for editing', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }, [selectedSpecies]);


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
                src={gbifLogo}
                alt="GBIF Logo"
                className="h-8 w-8"
              />
              <h1 className="text-black font-bold text-2xl">Rules</h1>
              <a
                href="https://data-blog.gbif.org/post/2026-01-21-rule-based-annotations/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Learn how to use this tool"
              >
                <HelpCircle className="h-5 w-5" />
              </a>
            </div>
            <p className="text-gray-600 text-sm">
              Create rules that will apply to past and future occurrence records
            </p>
            
            {/* Project Selection Button - Only show when no project is selected */}
            {!selectedProjectId && (
              <div className="mt-2">
                <Dialog open={isProjectDialogOpen} onOpenChange={(open) => {
                  setIsProjectDialogOpen(open);
                  if (open) fetchProjects();
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 flex-shrink-0 hover:bg-gray-100"
                      title="Set active project"
                    >
                      <Folder className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Select Active Project</DialogTitle>
                    <DialogDescription>
                      Choose a project for new rules. All rules you create will be saved to this project.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {loadingProjects ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No projects available</p>
                      <p className="text-sm mt-2">Visit the Projects page to create one</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => handleSelectProject(project.id, project.name)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedProjectId === project.id
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-200 hover:border-green-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              selectedProjectId === project.id ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              <Folder className={`w-5 h-5 ${
                                selectedProjectId === project.id ? 'text-green-700' : 'text-gray-600'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-semibold ${
                                selectedProjectId === project.id ? 'text-green-900' : 'text-gray-900'
                              }`}>
                                {project.name}
                              </h3>
                              {project.description && (
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                  {project.description}
                                </p>
                              )}
                              {selectedProjectId === project.id && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-green-700">
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  <span className="font-medium">Active</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {selectedProjectId && (
                    <div className="pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleClearProjectSelection();
                          setIsProjectDialogOpen(false);
                        }}
                        className="w-full"
                      >
                        Clear Selection
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
            )}
            
            {/* Active Project Indicator */}
            {selectedProjectId && selectedProjectName && (
              <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex flex-col items-center">
                      <Folder className="w-4 h-4 text-green-700 flex-shrink-0" />
                      {/* Taxon navigation arrow */}
                      {projectTaxa.length > 0 && !loadingProjectTaxa && (
                        <div className="flex items-center mt-0.5">
                          <button
                            onClick={() => navigateProjectTaxa('prev')}
                            className="h-3 w-3 flex items-center justify-center text-green-600 hover:text-green-800 transition-colors"
                            title="Navigate to previous taxon in project"
                            disabled={loadingProjectTaxa}
                          >
                            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-green-900 truncate" title={selectedProjectName}>
                        {selectedProjectName}
                      </p>
                      <p className="text-xs text-green-700">Active project for new rules</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearProjectSelection}
                    className="h-6 w-6 p-0 hover:bg-green-100 flex-shrink-0"
                    title="Clear project selection"
                  >
                    <X className="h-3 w-3 text-green-700" />
                  </Button>
                </div>
              </div>
            )}
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
              setCurrentAnnotation(newAnnotation);
            }}
            currentAnnotation={currentAnnotation}
            onRuleSavedToGBIF={handleRuleSavedToGBIF}
          />
        </div>

        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex-1 text-sm">Previous Rules</h3>
            <div className="flex items-center gap-1">
              {selectedSpecies && (selectedSpecies.genusKey || selectedSpecies.familyKey || selectedSpecies.orderKey || selectedSpecies.classKey || selectedSpecies.phylumKey || selectedSpecies.kingdomKey) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHigherOrderRules(!showHigherOrderRules)}
                  className={`h-7 w-7 p-0 ${showHigherOrderRules ? 'bg-blue-100 hover:bg-blue-200' : ''}`}
                  title={showHigherOrderRules ? 'Hide higher taxonomic rank rules' : 'Show higher taxonomic rank rules'}
                >
                  <Network className={`h-4 w-4 ${showHigherOrderRules ? 'text-blue-700' : ''}`} />
                </Button>
              )}
              {annotationRules.length > 0 && sessionStorage.getItem('gbifUser') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMyRulesOnly(!showMyRulesOnly)}
                  className={`h-7 w-7 p-0 ${showMyRulesOnly ? 'bg-purple-100 hover:bg-purple-200' : ''}`}
                  title={showMyRulesOnly ? 'Show all rules' : 'Show only my rules'}
                >
                  <User className={`h-4 w-4 ${showMyRulesOnly ? 'text-purple-700' : ''}`} />
                </Button>
              )}
              {selectedProjectId && annotationRules.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterByActiveProject(!filterByActiveProject)}
                  className={`h-7 w-7 p-0 ${filterByActiveProject ? 'bg-green-100 hover:bg-green-200' : ''}`}
                  title={filterByActiveProject ? `Showing only rules in ${selectedProjectName}` : 'Show only rules in active project'}
                >
                  <Folder className={`h-4 w-4 ${filterByActiveProject ? 'text-green-700' : ''}`} />
                </Button>
              )}
              {annotationRules.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowContestedRules(!showContestedRules)}
                    className={`h-7 w-7 p-0 ${showContestedRules ? 'bg-orange-100 hover:bg-orange-200' : ''}`}
                    title={showContestedRules ? 'Hide contested/downvoted rules' : 'Show contested/downvoted rules'}
                  >
                    <ThumbsDown className={`h-4 w-4 ${showContestedRules ? 'text-orange-700' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAnnotationRules(!showAnnotationRules)}
                    className="h-7 w-7 p-0"
                    title={showAnnotationRules ? 'Hide rules on map' : 'Show rules on map'}
                  >
                    {showAnnotationRules ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </div>
          </div>
          <AnnotationRules 
            selectedSpecies={selectedSpecies}
            showHigherOrderRules={showHigherOrderRules}
            onShowHigherOrderChange={setShowHigherOrderRules}
            onRulesLoad={handleAnnotationRulesLoad}
            refreshTrigger={annotationRulesRefreshTrigger}
            filterProjectId={filterByActiveProject ? selectedProjectId : undefined}
            vocabulary={vocabulary}
            onLoadRuleForEditing={handleLoadRuleForEditing}
          />
        </div>
      </div>
    </aside>

    {/* Map - Now takes full height with no header */}
    <main className="absolute inset-0 left-80" style={{ contain: 'layout style' }}>
      {/* Floating species selector - positioned at top but right of polygon tools */}
      <div className="absolute top-4 left-20 z-20" style={{ minWidth: '250px', maxWidth: '350px' }}>
        <div style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
          borderRadius: '6px',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(8px)',
          padding: '6px'
        }}>
          <SpeciesSelector
            selectedSpecies={selectedSpecies}
            onSelectSpecies={setSelectedSpecies}
          />
        </div>
      </div>
      
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
          setCurrentPolygon(coords);
        }}
        annotationRules={annotationRules}
        showAnnotationRules={showAnnotationRules}
        showMyRulesOnly={showMyRulesOnly}
        showContestedRules={showContestedRules}
        editingPolygonId={editingPolygonId}
        onUpdatePolygon={handleUpdatePolygon}
        onStopEditing={handleStopEditing}
        onSaveAndEdit={handleSaveAndEdit}
        onAutoSave={handleAutoSavePolygon}
        onNavigateToLocation={handleNavigateToPolygon}
        onToggleInvert={handleToggleInvert}
        onEditPolygon={handleEditPolygon}
        onDeletePolygon={handleDeletePolygon}
        occurrenceFilters={occurrenceFilters}
        onFiltersChange={setOccurrenceFilters}
        onCreateRuleFromSearch={handleCreateRuleFromSearch}
        onSaveMultiplePolygons={handleSaveMultiplePolygons}
        onMergeAllPolygons={handleMergeAllPolygons}
        onUnionPolygons={handleUnionPolygons}
        onSplitMultiPolygon={handleSplitMultiPolygon}
        vocabulary={vocabulary}
      />
    </main>
      </div>
    </div>
  );
}

