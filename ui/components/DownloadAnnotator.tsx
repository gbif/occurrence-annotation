import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Upload, FileDown, Download, Loader2, AlertCircle, CheckCircle2, User, List, ChevronDown, Filter, X, Map as MapIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { SpeciesSelector, type SelectedSpecies } from './SpeciesSelector';
import {
  extractAndParseDownload,
  validateDownloadFile,
  generateCSV,
  downloadFile,
  estimateRecordCount,
  type ParsedDownload,
  type OccurrenceRecord,
} from '../utils/fileHandler';
import { processDownload, annotateRecords, filterCleanRecords } from '../utils/downloadProcessor';
import type { AnnotationRule } from '../utils/downloadProcessor';
import {
  generateReport,
  createSummaryMessage,
  type AnnotationReport,
} from '../utils/annotationReport';
import { getAnnotationApiUrl } from '../utils/apiConfig';
import { DownloadResultsMap } from './DownloadResultsMap';
import { filterSpeciesForMap, selectPointsForDisplay, type FilteredMapData } from '../utils/mapDataFilter';

type ProcessingStage = 'idle' | 'uploading' | 'parsing' | 'fetching-rules' | 'processing' | 'complete' | 'error';

interface ProgressInfo {
  stage: string;
  percent: number;
}

interface GbifDownload {
  key: string;
  created: string;
  modified: string;
  status: string;
  downloadLink?: string;
  size?: number;
  totalRecords?: number;
  doi?: string;
  request?: {
    format?: string;
    predicate?: any;
  };
}

interface GBIFUser {
  userName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles?: string[];
}

interface DownloadAnnotatorProps {
  onResultsChange?: (hasResults: boolean) => void;
}

export default function DownloadAnnotator({ onResultsChange }: DownloadAnnotatorProps = {}) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [progress, setProgress] = useState<ProgressInfo>({ stage: '', percent: 0 });
  const [error, setError] = useState<string | null>(null);
  
  const [parsedDownload, setParsedDownload] = useState<ParsedDownload | null>(null);
  const [report, setReport] = useState<AnnotationReport | null>(null);
  const [annotatedRecords, setAnnotatedRecords] = useState<any[] | null>(null);
  const [cleanRecords, setCleanRecords] = useState<any[] | null>(null);
  const [fetchedRules, setFetchedRules] = useState<AnnotationRule[] | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [gbifUsername, setGbifUsername] = useState('');
  const [userDownloads, setUserDownloads] = useState<GbifDownload[]>([]);
  const [loadingDownloads, setLoadingDownloads] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<GBIFUser | null>(null);
  const [showDownloads, setShowDownloads] = useState(false);
  const [taxonNames, setTaxonNames] = useState<Record<number, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter options
  const [projects, setProjects] = useState<Array<{id: number, name: string}>>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [speciesFilter, setSpeciesFilter] = useState<SelectedSpecies | null>(null);
  const [myRulesOnly, setMyRulesOnly] = useState(false);
  const [includeHigherOrder, setIncludeHigherOrder] = useState(true); // Default true to include all taxonomic ranks
  
  // Clean download options - which annotation types to exclude
  const [excludeAnnotations, setExcludeAnnotations] = useState<string[]>(['SUSPICIOUS']);
  const [conflictMode, setConflictMode] = useState<'exclude_any' | 'keep_conflicting' | 'exclude_all'>('exclude_any');
  const [showCleanOptions, setShowCleanOptions] = useState(false);

  // Map visualization state
  const [mapData, setMapData] = useState<FilteredMapData | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [includePassingInMap, setIncludePassingInMap] = useState(true);
  const [currentSpeciesIndex, setCurrentSpeciesIndex] = useState(0);

  // Load logged-in user and auto-fill username
  useEffect(() => {
    const savedUser = localStorage.getItem('gbifUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser) as GBIFUser;
        setLoggedInUser(user);
        setGbifUsername(user.userName);
        
        // Auto-fetch downloads for logged-in user
        fetchUserDownloadsForUsername(user.userName);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    }
  }, []);

  // Warn before navigating away when results exist
  useEffect(() => {
    if (!report) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [report]);

  // Notify parent component when results change
  useEffect(() => {
    if (onResultsChange) {
      onResultsChange(report !== null);
    }
  }, [report, onResultsChange]);

  // Fetch projects for logged-in user
  useEffect(() => {
    const fetchProjects = async () => {
      if (!loggedInUser) {
        setProjects([]);
        return;
      }

      try {
        const response = await fetch(getAnnotationApiUrl(`/project?member=${encodeURIComponent(loggedInUser.userName)}`));
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setProjects(data.map((p: any) => ({ id: p.id, name: p.name })));
          }
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
      }
    };

    fetchProjects();
  }, [loggedInUser]);

  // Fetch taxon names for all downloads
  useEffect(() => {
    const fetchAllTaxonNames = async () => {
      const allTaxonKeys = new Set<number>();
      
      userDownloads.forEach(download => {
        if (download.request?.predicate) {
          const filterInfo = extractDownloadFilters(download.request.predicate);
          filterInfo.taxonKeys.forEach(key => allTaxonKeys.add(key));
        }
      });

      // Fetch names for all unique taxon keys
      for (const taxonKey of allTaxonKeys) {
        if (!taxonNames[taxonKey]) {
          await fetchTaxonName(taxonKey);
        }
      }
    };

    if (userDownloads.length > 0) {
      fetchAllTaxonNames();
    }
  }, [userDownloads]);

  // Prepare map data when processing is complete
  useEffect(() => {
    if (stage === 'complete' && report && fetchedRules && annotatedRecords) {
      // Check if records have coordinates
      const hasCoordinates = annotatedRecords.some(r => 
        r.decimalLatitude !== undefined && 
        r.decimalLongitude !== undefined &&
        !isNaN(Number(r.decimalLatitude)) &&
        !isNaN(Number(r.decimalLongitude))
      );

      if (!hasCoordinates) {
        setMapData(null);
        return;
      }

      try {
        // Filter species for map (top 50, species-level rules only)
        const filteredData = filterSpeciesForMap(report, fetchedRules, annotatedRecords);
        
        // Select points to display (with sampling)
        const { flaggedPoints, passingPoints } = selectPointsForDisplay(
          filteredData.flaggedPoints,
          filteredData.passingPoints
        );

        setMapData({
          ...filteredData,
          flaggedPoints,
          passingPoints
        });
      } catch (err) {
        console.error('Error preparing map data:', err);
        setMapData(null);
      }
    } else {
      setMapData(null);
    }
  }, [stage, report, fetchedRules, annotatedRecords]);

  // Reset species index when map data changes
  useEffect(() => {
    setCurrentSpeciesIndex(0);
  }, [mapData]);

  // Calculate record categories for accurate percentages (sum to 100%)
  // Each record is categorized into exactly ONE category
  const recordCategories = useMemo(() => {
    if (!annotatedRecords || !report) return null;
    
    const categories: Record<string, number> = {
      'CLEAN': 0,
      'MIXED': 0
    };
    
    annotatedRecords.forEach(record => {
      const annotations = record.annotations ? record.annotations.split(';').filter((a: string) => a) : [];
      
      if (annotations.length === 0) {
        categories['CLEAN']++;
      } else if (annotations.length === 1) {
        const annotation = annotations[0];
        categories[annotation] = (categories[annotation] || 0) + 1;
      } else {
        // Multiple different annotations
        categories['MIXED']++;
      }
    });
    
    return categories;
  }, [annotatedRecords, report]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  // Helper function to extract filter information from GBIF download predicate
  const extractDownloadFilters = (predicate: any): { taxonKeys: number[], filters: string[] } => {
    const taxonKeys: Set<number> = new Set();
    const filters: string[] = [];

    // Debug: log the predicate structure
    console.log('Extracting filters from predicate:', JSON.stringify(predicate, null, 2));

    const traverse = (pred: any) => {
      if (!pred || typeof pred !== 'object') return;

      const type = pred.type?.toUpperCase();
      
      // Handle logical operators
      if ((type === 'AND' || type === 'OR') && Array.isArray(pred.predicates)) {
        pred.predicates.forEach(traverse);
        return;
      }

      // Handle equals predicates
      if (type === 'EQUALS') {
        const key = pred.key?.toUpperCase();
        const value = pred.value;
        
        if (key === 'TAXON_KEY' && typeof value === 'number') {
          taxonKeys.add(value);
        } else if (key === 'TAXONKEY' && typeof value === 'number') {
          taxonKeys.add(value);
        } else if (key === 'BASIS_OF_RECORD' && value) {
          filters.push(`Basis: ${value}`);
        } else if (key === 'BASISOFRECORD' && value) {
          filters.push(`Basis: ${value}`);
        } else if (key === 'DATASET_KEY' && value) {
          filters.push(`Dataset: ${value.substring(0, 8)}`);
        } else if (key === 'DATASETKEY' && value) {
          filters.push(`Dataset: ${value.substring(0, 8)}`);
        } else if (key === 'COUNTRY_CODE' && value) {
          filters.push(`Country: ${value}`);
        } else if (key === 'COUNTRYCODE' && value) {
          filters.push(`Country: ${value}`);
        } else if (key === 'YEAR' && value) {
          filters.push(`Year: ${value}`);
        }
      }

      // Handle in predicates
      if (type === 'IN' && Array.isArray(pred.values)) {
        const key = pred.key?.toUpperCase();
        if (key === 'TAXON_KEY' || key === 'TAXONKEY') {
          pred.values.forEach((v: number) => taxonKeys.add(v));
        } else if (key === 'BASIS_OF_RECORD' || key === 'BASISOFRECORD') {
          filters.push(`Basis: ${pred.values.length} types`);
        }
      }

      // Handle range predicates
      if ((type === 'GREATERTHANOREQUALS' || type === 'LESSTHANOREQUALS')) {
        const key = pred.key?.toUpperCase();
        if (key === 'YEAR') {
          // Year ranges will be combined if both exist
          if (!filters.some(f => f.startsWith('Year'))) {
            filters.push(`Year: ${pred.value}`);
          }
        }
      }

      // Handle geometry predicates
      if (type === 'WITHIN' && pred.geometry) {
        filters.push('Spatial filter');
      }
    };

    traverse(predicate);
    
    console.log('Extracted taxon keys:', Array.from(taxonKeys));
    console.log('Extracted filters:', filters);
    
    return {
      taxonKeys: Array.from(taxonKeys),
      filters
    };
  };

  // Fetch species names for taxon keys
  const fetchTaxonName = async (taxonKey: number): Promise<string> => {
    // Check cache first
    if (taxonNames[taxonKey]) {
      return taxonNames[taxonKey];
    }

    try {
      const response = await fetch(`https://api.gbif.org/v1/species/${taxonKey}`);
      if (response.ok) {
        const data = await response.json();
        const name = data.scientificName || data.canonicalName || `Taxon ${taxonKey}`;
        setTaxonNames(prev => ({ ...prev, [taxonKey]: name }));
        return name;
      }
    } catch (err) {
      console.error(`Error fetching taxon ${taxonKey}:`, err);
    }
    
    return `Taxon ${taxonKey}`;
  };

  const fetchUserDownloadsForUsername = async (username: string) => {
    if (!username.trim()) {
      return;
    }

    setLoadingDownloads(true);
    setUserDownloads([]);
    
    try {
      const url = `https://api.gbif.org/v1/occurrence/download/user/${username}?limit=20`;
      
      // Get auth credentials from localStorage
      const authCredentials = localStorage.getItem('gbifAuth');
      const headers: HeadersInit = {};
      if (authCredentials) {
        headers['Authorization'] = `Basic ${authCredentials}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch downloads: ${response.statusText}`);
      }
      
      const data = await response.json();
      const downloads: GbifDownload[] = data.results || [];
      
      // Filter to only show SUCCEEDED downloads with DWCA or SIMPLE_CSV format and less than 500k records
      const compatibleDownloads = downloads.filter(d => {
        if (d.status !== 'SUCCEEDED') return false;
        const format = d.request?.format;
        if (format !== 'DWCA' && format !== 'SIMPLE_CSV') return false;
        // Only show downloads with less than 500,000 records
        if (d.totalRecords && d.totalRecords >= 500000) return false;
        return true;
      });
      
      setUserDownloads(compatibleDownloads);
      
      if (compatibleDownloads.length > 0) {
        toast.success(`Found ${compatibleDownloads.length} compatible download(s)`);
      }
      // Don't show toast if no downloads - it's automatic now
    } catch (err) {
      console.error('Error fetching user downloads:', err);
      // Silent fail for auto-fetch, only show error if it's a manual action
      setUserDownloads([]);
    } finally {
      setLoadingDownloads(false);
    }
  };

  /**
   * Fetch taxonomic hierarchy (parent keys) for a given taxonKey
   * Returns an array of all parent taxonKeys (genus, family, order, class, phylum, kingdom)
   */
  const fetchTaxonomicHierarchy = async (taxonKey: number): Promise<number[]> => {
    try {
      const url = `https://api.gbif.org/v1/species/${taxonKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch taxonomy for ${taxonKey}`);
        return [];
      }
      const data = await response.json();
      
      // Extract parent keys from the response
      const parentKeys: number[] = [];
      const hierarchyFields = ['genusKey', 'familyKey', 'orderKey', 'classKey', 'phylumKey', 'kingdomKey'];
      
      hierarchyFields.forEach(field => {
        if (data[field] && typeof data[field] === 'number') {
          parentKeys.push(data[field]);
        }
      });
      
      console.log(`DEBUG: Fetched hierarchy for ${taxonKey}:`, parentKeys);
      return parentKeys;
    } catch (error) {
      console.error(`Error fetching taxonomy for ${taxonKey}:`, error);
      return [];
    }
  };

  /**
   * Expand taxonKeys to include all parent taxonomic ranks
   */
  const expandTaxonKeysWithHierarchy = async (taxonKeys: number[]): Promise<number[]> => {
    const allKeys = new Set<number>(taxonKeys);
    
    // Fetch hierarchy for each key in parallel
    const hierarchyPromises = taxonKeys.map(key => fetchTaxonomicHierarchy(key));
    const hierarchies = await Promise.all(hierarchyPromises);
    
    // Add all parent keys to the set
    hierarchies.forEach(parentKeys => {
      parentKeys.forEach(key => allKeys.add(key));
    });
    
    const expandedKeys = Array.from(allKeys).sort((a, b) => a - b);
    return expandedKeys;
  };

  /**
   * Enrich occurrence records with their taxonomic hierarchy
   * Fetches parent keys for each unique taxonKey and populates genusKey, familyKey, etc.
   */
  const enrichRecordsWithHierarchy = async (
    records: OccurrenceRecord[],
    uniqueTaxonKeys: number[]
  ): Promise<OccurrenceRecord[]> => {
    // Build a map of taxonKey -> hierarchy data
    const hierarchyMap = new Map<number, any>();
    
    const hierarchyPromises = uniqueTaxonKeys.map(async (taxonKey) => {
      try {
        const url = `https://api.gbif.org/v1/species/${taxonKey}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          hierarchyMap.set(taxonKey, data);
        }
      } catch (error) {
        console.warn(`Failed to fetch hierarchy for ${taxonKey}:`, error);
      }
    });
    
    await Promise.all(hierarchyPromises);
    
    // Enrich each record with hierarchy data
    const enrichedRecords = records.map(record => {
      const taxonKey = record.taxonKey ? parseInt(record.taxonKey, 10) : null;
      if (!taxonKey) return record;
      
      const hierarchyData = hierarchyMap.get(taxonKey);
      
      if (hierarchyData) {
        return {
          ...record,
          genusKey: hierarchyData.genusKey?.toString(),
          familyKey: hierarchyData.familyKey?.toString(),
          orderKey: hierarchyData.orderKey?.toString(),
          classKey: hierarchyData.classKey?.toString(),
          phylumKey: hierarchyData.phylumKey?.toString(),
          kingdomKey: hierarchyData.kingdomKey?.toString(),
        };
      }
      
      return record;
    });
    
    return enrichedRecords;
  };


  const fetchRulesForTaxonKeys = async (taxonKeys: number[]): Promise<AnnotationRule[]> => {
    const allRules: AnnotationRule[] = [];
    
    // Always fetch rules for all taxon keys (including higher-order ranks)
    // The species filter affects record filtering, not rule fetching
    const keysToFetch = taxonKeys;
    const batchSize = 10; // Fetch 10 taxonKeys at a time
    
    for (let i = 0; i < keysToFetch.length; i += batchSize) {
      const batch = keysToFetch.slice(i, i + batchSize);
      const percent = ((i / keysToFetch.length) * 100);
      
      setProgress({
        stage: `Fetching rules for taxon keys (${i}/${keysToFetch.length})`,
        percent: percent,
      });
      
      // Fetch rules for each taxonKey in parallel
      const batchPromises = batch.map(async taxonKey => {
        try {
          // Build URL with filters
          let url = getAnnotationApiUrl(`/rule?taxonKey=${taxonKey}`);
          
          // Add project filter if selected
          if (selectedProject !== null) {
            url += `&projectId=${selectedProject}`;
          }
          
          // Add createdBy filter if myRulesOnly is checked
          if (myRulesOnly && loggedInUser) {
            url += `&createdBy=${encodeURIComponent(loggedInUser.userName)}`;
          }
          
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`Failed to fetch rules for taxonKey ${taxonKey}:`, response.statusText);
            return [];
          }
          const rules: AnnotationRule[] = await response.json();
          return rules;
        } catch (error) {
          console.error(`Error fetching rules for taxonKey ${taxonKey}:`, error);
          return [];
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(rules => allRules.push(...rules));
    }
    
    // Deduplicate rules by ID
    const uniqueRules = Array.from(
      new Map(allRules.map(rule => [rule.id, rule])).values()
    );
    
    // Filter to only non-deleted rules (include all annotation types)
    const finalRules = uniqueRules.filter(rule => !rule.deleted);
    return finalRules;
  };

  const handleFileUpload = async (file: File) => {
    // Reset state
    setError(null);
    setReport(null);
    setAnnotatedRecords(null);
    setCleanRecords(null);
    setParsedDownload(null);
    setFetchedRules(null);
    setMapData(null);
    setCurrentSpeciesIndex(0);
    
    // Validate file
    const validation = validateDownloadFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      toast.error(validation.error);
      return;
    }
    
    // Check estimated record count
    const estimatedRecords = estimateRecordCount(file.size);
    if (estimatedRecords > 500000) {
      const message = `File may contain ~${estimatedRecords.toLocaleString()} records. ` +
        `This feature is optimized for downloads with less than 500,000 records. ` +
        `Processing may be slow or fail. Consider using the R package 'gbifrules' instead.`;
      toast.warning(message, { duration: 10000 });
    }
    
    const startTime = Date.now();
    
    try {
      // Stage 1: Parse download
      setStage('parsing');
      setProgress({ stage: 'Extracting and parsing download file', percent: 0 });
      
      const parsed = await extractAndParseDownload(file, (stage, percent) => {
        setProgress({ stage, percent });
      });
      
      setParsedDownload(parsed);
      
      toast.success(
        `Parsed ${parsed.recordCount.toLocaleString()} records with ` +
        `${parsed.uniqueTaxonKeys.length} unique taxon keys`
      );
      
      // Stage 2: Fetch rules
      setStage('fetching-rules');
      setProgress({ stage: 'Fetching taxonomic hierarchy', percent: 0 });
      
      // Expand taxon keys to include all parent ranks (genus, family, order, etc.)
      const expandedTaxonKeys = await expandTaxonKeysWithHierarchy(parsed.uniqueTaxonKeys);
      
      setProgress({ stage: 'Fetching annotation rules', percent: 50 });
      
      const rules = await fetchRulesForTaxonKeys(expandedTaxonKeys);
      
      // Store rules for later use (e.g., map visualization)
      setFetchedRules(rules);
      
      if (rules.length === 0) {
        toast.info('No annotation rules found for the taxon keys in this download');
        setStage('complete');
        const emptyReport = generateReport(parsed.recordCount, [], Date.now() - startTime);
        setReport(emptyReport);
        setAnnotatedRecords(parsed.records.map(r => ({ ...r, annotations: '' })));
        setCleanRecords(parsed.records);
        return;
      }
      
      toast.success(`Found ${rules.length} annotation rules to apply`);
      
      // Stage 2.5: Enrich records with taxonomic hierarchy
      setProgress({ stage: 'Enriching records with taxonomic data', percent: 75 });
      const enrichedRecords = await enrichRecordsWithHierarchy(parsed.records, parsed.uniqueTaxonKeys);
      
      // Stage 3: Process records
      setStage('processing');
      setProgress({ stage: 'Applying annotation rules', percent: 0 });
      
      const matches = await processDownload(
        enrichedRecords,
        rules,
        (progress) => {
          setProgress({
            stage: progress.stage,
            percent: progress.percent,
          });
        },
        1000,
        includeHigherOrder
      );
      
      // Stage 4: Generate outputs
      setProgress({ stage: 'Generating outputs', percent: 90 });
      
      const processingTime = Date.now() - startTime;
      const finalReport = generateReport(parsed.recordCount, matches, processingTime);
      const annotated = annotateRecords(enrichedRecords, matches);
      const clean = filterCleanRecords(enrichedRecords, matches, excludeAnnotations, conflictMode);
      
      setReport(finalReport);
      setAnnotatedRecords(annotated);
      setCleanRecords(clean);
      
      setStage('complete');
      setProgress({ stage: 'Complete', percent: 100 });
      
      toast.success(createSummaryMessage(finalReport));
      
    } catch (err) {
      setStage('error');
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Error processing download:', err);
    }
  };

  const handleDownloadAnnotated = () => {
    if (!annotatedRecords || !parsedDownload) return;
    
    const columns = [...parsedDownload.columns, 'annotations'];
    const csv = generateCSV(annotatedRecords, columns, '\t');
    downloadFile(csv, `${parsedDownload.filename}_annotated.tsv`, 'text/tab-separated-values');
    toast.success('Downloaded annotated file');
  };

  const handleDownloadClean = () => {
    if (!cleanRecords || !parsedDownload) return;
    
    const csv = generateCSV(cleanRecords, parsedDownload.columns, '\t');
    downloadFile(csv, `${parsedDownload.filename}_clean.tsv`, 'text/tab-separated-values');
    toast.success('Downloaded clean file');
  };

  const resetTool = () => {
    setStage('idle');
    setProgress({ stage: '', percent: 0 });
    setError(null);
    setParsedDownload(null);
    setReport(null);
    setAnnotatedRecords(null);
    setCleanRecords(null);
    setFetchedRules(null);
    setMapData(null);
    setCurrentSpeciesIndex(0);
    // Reset filter options
    setSelectedProject(null);
    setSpeciesFilter(null);
    setMyRulesOnly(false);
    setExcludeAnnotations(['SUSPICIOUS']);
    setConflictMode('exclude_any');
  };

  const handleNavigateAway = (path: string) => {
    if (report) {
      const confirmed = window.confirm(
        'You have processed results. Navigating away will erase your report. Are you sure you want to leave?'
      );
      if (confirmed) {
        navigate(path);
      }
    } else {
      navigate(path);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <p className="text-gray-600">
          Upload a GBIF download (zip file) to automatically apply annotation rules and identify suspicious records.
          You can filter which rules to apply by project, species, or creator. Works best with downloads containing less than 100,000 records.
        </p>
      </div>

      {/* Upload Zone */}
      {stage === 'idle' && (
        <>
          {/* Login Status / Downloads Section */}
          {!loggedInUser && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <User className="h-6 w-6 text-amber-600" />
                <div>
                  <h3 className="font-medium text-amber-900">Not logged in</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Log in with your GBIF account (button in bottom right) to automatically see your recent downloads here.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Downloads List */}
          {loggedInUser && loadingDownloads && (
            <div className="mb-6 bg-white border rounded-lg p-6">
              <div className="flex items-center gap-3 justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="text-gray-600">Loading your downloads...</span>
              </div>
            </div>
          )}

          {loggedInUser && !loadingDownloads && userDownloads.length > 0 && (
            <div className="mb-6 bg-white border rounded-lg p-6">
              <button
                onClick={() => setShowDownloads(!showDownloads)}
                className="w-full flex items-center justify-between hover:bg-gray-50 -m-6 p-6 rounded-lg transition-colors"
              >
                <h4 className="font-medium flex items-center gap-2">
                  <List className="h-5 w-5 text-blue-600" />
                  Your Recent Downloads ({userDownloads.length})
                </h4>
                <ChevronDown
                  className={`h-5 w-5 text-gray-500 transition-transform ${showDownloads ? 'rotate-180' : ''}`}
                />
              </button>
              {showDownloads && (
                <>
                  <p className="text-xs text-gray-500 mb-3 mt-4">
                    Only showing Darwin Core Archive and Simple CSV downloads with less than 100,000 records (compatible formats). Click "Download" to download the file from GBIF, then drag and drop it below to annotate.
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                {userDownloads.map((download) => {
                  const format = download.request?.format === 'DWCA' ? 'Darwin Core Archive' : 'Simple CSV';
                  const filterInfo = download.request?.predicate ? extractDownloadFilters(download.request.predicate) : { taxonKeys: [], filters: [] };
                  
                  return (
                  <div
                    key={download.key}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{format}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>Created: {new Date(download.created).toLocaleDateString()}</span>
                        {download.totalRecords && (
                          <span>{download.totalRecords.toLocaleString()} records</span>
                        )}
                        {download.size && (
                          <span>{(download.size / 1024 / 1024).toFixed(1)} MB</span>
                        )}
                      </div>
                      {(filterInfo.taxonKeys.length > 0 || filterInfo.filters.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {filterInfo.taxonKeys.length > 0 && (
                            <>
                              {filterInfo.taxonKeys.length === 1 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  {taxonNames[filterInfo.taxonKeys[0]] || `Taxon: ${filterInfo.taxonKeys[0]}`}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                                  title={filterInfo.taxonKeys.map(k => taxonNames[k] || k).join(', ')}>
                                  {filterInfo.taxonKeys.length} taxa
                                </span>
                              )}
                            </>
                          )}
                          {filterInfo.filters.map((filter, idx) => (
                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {filter}
                            </span>
                          ))}
                        </div>
                      )}
                      <a 
                        href={`https://www.gbif.org/occurrence/download/${download.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-500 hover:text-blue-700 hover:underline mt-1 block"
                      >
                        {download.key}
                      </a>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button
                        onClick={() => window.open(`https://api.gbif.org/v1/occurrence/download/request/${download.key}.zip`, '_blank')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        title="Download from GBIF"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                  </div>
                  );
                })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* No compatible downloads message */}
          {loggedInUser && !loadingDownloads && userDownloads.length === 0 && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-800 font-medium">No compatible downloads found</p>
                  <p className="text-xs text-amber-700 mt-1">
                    You don't have any recent Darwin Core Archive or Simple CSV downloads with less than 100,000 records. Only these formats and sizes are compatible with the annotator.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Options Menu (Rule Filters + Clean Download) */}
          <div className="mb-6 bg-white border rounded-lg p-6">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between hover:bg-gray-50 -m-6 p-6 rounded-lg transition-colors"
            >
              <h4 className="font-medium flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-600" />
                Options
                {(selectedProject !== null || speciesFilter !== null || myRulesOnly || excludeAnnotations.length > 0) && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                    {[
                      selectedProject !== null, 
                      speciesFilter !== null, 
                      myRulesOnly,
                      excludeAnnotations.length > 0
                    ].filter(Boolean).length} active
                  </span>
                )}
              </h4>
              <ChevronDown
                className={`h-5 w-5 text-gray-400 transition-transform ${
                  showFilters ? 'transform rotate-180' : ''
                }`}
              />
            </button>

            {showFilters && (
              <div className="mt-6 space-y-6">
                {/* Rule Filtering Section */}
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 mb-3">Rule Filtering</h5>
                  <p className="text-sm text-gray-600 mb-4">
                    Control which annotation rules to apply to the download.
                    {!loggedInUser && <span className="font-medium"> Log in to access project and creator filters.</span>}
                  </p>
                  
                  <div className="grid gap-4">
                    {/* Project Filter */}
                    {loggedInUser && projects.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Project
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={selectedProject ?? ''}
                            onChange={(e) => setSelectedProject(e.target.value ? parseInt(e.target.value) : null)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">All projects</option>
                            {projects.map(project => (
                              <option key={project.id} value={project.id}>
                                {project.name}
                              </option>
                            ))}
                          </select>
                          {selectedProject !== null && (
                            <button
                              onClick={() => setSelectedProject(null)}
                              className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Clear project filter"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Species Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Species (optional - overrides download species)
                      </label>
                      <SpeciesSelector
                        selectedSpecies={speciesFilter}
                        onSelectSpecies={setSpeciesFilter}
                        placeholder="Filter to specific species..."
                      />
                    </div>

                    {/* Checkboxes for rule filtering */}
                    <div className="space-y-2">
                      {loggedInUser && (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="myRulesOnly"
                            checked={myRulesOnly}
                            onChange={(e) => setMyRulesOnly(e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="myRulesOnly" className="text-sm text-gray-700 cursor-pointer">
                            Only use rules I created
                          </label>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="includeHigherOrder"
                          checked={includeHigherOrder}
                          onChange={(e) => setIncludeHigherOrder(e.target.checked)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="includeHigherOrder" className="text-sm text-gray-700 cursor-pointer">
                          Include higher-order taxonomic rules (genus, family, order, etc.)
                        </label>
                      </div>
                    </div>

                    {/* Active Rule Filters Summary */}
                    {(selectedProject !== null || speciesFilter !== null || myRulesOnly || !includeHigherOrder) && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs font-medium text-blue-900 mb-1.5">Active rule filters:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedProject !== null && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                              Project: {projects.find(p => p.id === selectedProject)?.name}
                            </span>
                          )}
                          {speciesFilter && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                              Species: {speciesFilter.scientificName}
                            </span>
                          )}
                          {myRulesOnly && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                              My rules only
                            </span>
                          )}
                          {!includeHigherOrder && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                              Species-level only
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200"></div>

                {/* Clean Download Options Section */}
                <div>
                  <button
                    onClick={() => setShowCleanOptions(!showCleanOptions)}
                    className="w-full flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
                  >
                    <h5 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      Clean Download Options
                      {excludeAnnotations.length > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {excludeAnnotations.length} excluded
                        </span>
                      )}
                    </h5>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform ${
                        showCleanOptions ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>
                  
                  {showCleanOptions && (
                    <>
                      <p className="text-sm text-gray-600 mb-3 mt-2">
                        Select which annotation types to exclude from the clean download. Records with other annotation types will be kept.
                      </p>
                      
                      <div className="space-y-3">
                        {/* Conflict Handling Mode */}
                        <div className="border border-gray-300 rounded-lg p-3 bg-white">
                          <div className="text-xs font-medium text-gray-700 mb-2">
                            Conflict handling:
                          </div>
                          <div className="space-y-1.5">
                            <label className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                              <input
                                type="radio"
                                name="conflictMode"
                                value="exclude_any"
                                checked={conflictMode === 'exclude_any'}
                                onChange={(e) => setConflictMode(e.target.value as any)}
                                className="mt-0.5 h-3.5 w-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="text-sm text-gray-900">Exclude if any annotation matches</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  Remove records if ANY annotation is in exclude list (default)
                                </div>
                              </div>
                            </label>
                            <label className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                              <input
                                type="radio"
                                name="conflictMode"
                                value="keep_conflicting"
                                checked={conflictMode === 'keep_conflicting'}
                                onChange={(e) => setConflictMode(e.target.value as any)}
                                className="mt-0.5 h-3.5 w-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="text-sm text-gray-900">Keep conflicting records</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  Keep records with both excluded and non-excluded annotations
                                </div>
                              </div>
                            </label>
                            <label className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                              <input
                                type="radio"
                                name="conflictMode"
                                value="exclude_all"
                                checked={conflictMode === 'exclude_all'}
                                onChange={(e) => setConflictMode(e.target.value as any)}
                                className="mt-0.5 h-3.5 w-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <div className="flex-1">
                                <div className="text-sm text-gray-900">Exclude only if all annotations match</div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  Remove only if ALL annotations are in exclude list
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>

                        {/* Multi-select with checkboxes */}
                        <div className="border border-gray-300 rounded-lg p-2 bg-white">
                          <div className="text-xs font-medium text-gray-700 mb-2">
                            Exclude annotation types:
                          </div>
                          <div className="space-y-1">
                            {['SUSPICIOUS', 'NATIVE', 'INTRODUCED', 'MANAGED', 'FORMER', 'VAGRANT', 'OTHER'].map(annotationType => (
                              <label key={annotationType} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                                <input
                                  type="checkbox"
                                  checked={excludeAnnotations.includes(annotationType)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setExcludeAnnotations([...excludeAnnotations, annotationType]);
                                    } else {
                                      setExcludeAnnotations(excludeAnnotations.filter(a => a !== annotationType));
                                    }
                                  }}
                                  className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-gray-700">
                                  {annotationType.charAt(0) + annotationType.slice(1).toLowerCase()}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Summary */}
                        {excludeAnnotations.length > 0 && (
                          <div className="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700">
                            <strong>Excluding:</strong> {excludeAnnotations.map(a => a.charAt(0) + a.slice(1).toLowerCase()).join(', ')}
                          </div>
                        )}

                        {excludeAnnotations.length === 0 && (
                          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                            ⚠️ No exclusions - clean download will be identical to annotated download
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* File Upload Section */}
          <div className="bg-white border rounded-lg">
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-colors
                ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              `}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium mb-2">Drop GBIF download zip file here</p>
              <p className="text-sm text-gray-500 mb-4">or</p>
              <label className="inline-block cursor-pointer">
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block">
                  Choose File
                </span>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </>
      )}

      {/* Processing Status */}
      {(stage === 'parsing' || stage === 'fetching-rules' || stage === 'processing') && (
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <h2 className="text-xl font-semibold">Processing Download</h2>
          </div>
          
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>{progress.stage}</span>
              <span>{progress.percent.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
          
          {parsedDownload && (
            <div className="mt-4 text-sm text-gray-600">
              <p>Records: {parsedDownload.recordCount.toLocaleString()}</p>
              <p>Unique Taxon Keys: {parsedDownload.uniqueTaxonKeys.length}</p>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {stage === 'error' && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-red-900 mb-2">Processing Error</h2>
              <p className="text-red-700 whitespace-pre-line">{error}</p>
              <button
                onClick={resetTool}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {stage === 'complete' && report && recordCategories && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-green-900">Processing Complete</h2>
              </div>
              <button
                onClick={resetTool}
                className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
              >
                Process Another Download
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Record Annotations</h3>
            
            {/* Single Stacked Bar Chart */}
            <div className="space-y-4">
              {/* Stacked Bar */}
              <div className="w-full bg-gray-200 rounded-full h-10 overflow-hidden flex">
                {/* Iterate through categories in a specific order */}
                {Object.entries(recordCategories)
                  .sort((a, b) => {
                    // Sort: CLEAN first, then by count descending
                    if (a[0] === 'CLEAN') return -1;
                    if (b[0] === 'CLEAN') return 1;
                    return b[1] - a[1];
                  })
                  .map(([category, count]) => {
                    const percent = (count / report.totalRecords) * 100;
                    
                    const colors: Record<string, string> = {
                      'CLEAN': 'bg-gray-400',
                      'SUSPICIOUS': 'bg-red-500',
                      'INTRODUCED': 'bg-amber-600',
                      'NATIVE': 'bg-emerald-500',
                      'MANAGED': 'bg-blue-500',
                      'FORMER': 'bg-purple-500',
                      'VAGRANT': 'bg-orange-500',
                      'MIXED': 'bg-yellow-500',
                      'OTHER': 'bg-slate-500'
                    };
                    const colorClass = colors[category] || colors.OTHER;
                    
                    const labels: Record<string, string> = {
                      'CLEAN': 'No annotations',
                      'SUSPICIOUS': 'Suspicious',
                      'INTRODUCED': 'Introduced',
                      'NATIVE': 'Native',
                      'MANAGED': 'Managed',
                      'FORMER': 'Former',
                      'VAGRANT': 'Vagrant',
                      'MIXED': 'Mixed',
                      'OTHER': 'Other'
                    };
                    const label = labels[category] || category;
                    
                    return (
                      <div 
                        key={category}
                        className={`${colorClass} h-full flex items-center justify-center`}
                        style={{ width: `${percent}%` }}
                        title={`${label}: ${count.toLocaleString()} (${percent.toFixed(1)}%)`}
                      >
                        {percent > 8 && (
                          <span className="text-xs font-medium text-white px-2">
                            {count.toLocaleString()} ({percent.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(recordCategories)
                  .sort((a, b) => {
                    // Sort: CLEAN first, then by count descending
                    if (a[0] === 'CLEAN') return -1;
                    if (b[0] === 'CLEAN') return 1;
                    return b[1] - a[1];
                  })
                  .map(([category, count]) => {
                    const percent = (count / report.totalRecords) * 100;
                    
                    const colors: Record<string, string> = {
                      'CLEAN': 'bg-gray-400',
                      'SUSPICIOUS': 'bg-red-500',
                      'INTRODUCED': 'bg-amber-600',
                      'NATIVE': 'bg-emerald-500',
                      'MANAGED': 'bg-blue-500',
                      'FORMER': 'bg-purple-500',
                      'VAGRANT': 'bg-orange-500',
                      'MIXED': 'bg-yellow-500',
                      'OTHER': 'bg-slate-500'
                    };
                    const colorClass = colors[category] || colors.OTHER;
                    
                    const labels: Record<string, string> = {
                      'CLEAN': 'No annotations',
                      'SUSPICIOUS': 'Suspicious',
                      'INTRODUCED': 'Introduced',
                      'NATIVE': 'Native',
                      'MANAGED': 'Managed',
                      'FORMER': 'Former',
                      'VAGRANT': 'Vagrant',
                      'MIXED': 'Mixed',
                      'OTHER': 'Other'
                    };
                    const label = labels[category] || category;
                    
                    return (
                      <div key={category} className="flex items-center gap-2">
                        <div className={`w-4 h-4 ${colorClass} rounded flex-shrink-0`}></div>
                        <div className="text-xs min-w-0">
                          <div className="font-medium truncate">{label}</div>
                          <div className="text-gray-500">
                            {percent.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Map Visualization */}
          {/* Map Visualization */}
          {mapData && (() => {
            const speciesArray = Array.from(mapData.speciesKeys);
            const currentSpeciesKey = speciesArray[currentSpeciesIndex];
            const currentSpeciesInfo = mapData.speciesInfo.get(currentSpeciesKey);
            
            return (
              <div className="bg-white border rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapIcon className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Map</h3>
                </div>

                <div className="mb-4 text-sm text-gray-600 space-y-1">
                  <p>
                    Reviewing <strong>{speciesArray.length}</strong> species with species-level annotation rules.
                  </p>
                  {mapData.speciesKeys.length >= 50 && (
                    <p className="text-amber-600">
                      ⚠️ Limited to top 50 species by record count for performance.
                    </p>
                  )}
                </div>

                <div className="relative">
                    <DownloadResultsMap
                      rules={mapData.relevantRules}
                      flaggedPoints={mapData.flaggedPoints}
                      passingPoints={mapData.passingPoints}
                      speciesInfo={mapData.speciesInfo}
                      selectedSpecies={currentSpeciesKey}
                    />
                    
                    {/* Species navigation overlay */}
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm shadow-lg rounded-lg px-4 py-3 border border-gray-200">
                        <button
                          onClick={() => setCurrentSpeciesIndex(Math.max(0, currentSpeciesIndex - 1))}
                          disabled={currentSpeciesIndex === 0}
                          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </button>
                        
                        <div className="text-center border-x border-gray-200 px-4">
                          <div className="font-semibold text-gray-900 text-sm">
                            {currentSpeciesInfo?.scientificName || `Species ${currentSpeciesKey}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            Species {currentSpeciesIndex + 1} of {speciesArray.length} • {currentSpeciesInfo?.recordCount.toLocaleString()} records
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setCurrentSpeciesIndex(Math.min(speciesArray.length - 1, currentSpeciesIndex + 1))}
                          disabled={currentSpeciesIndex === speciesArray.length - 1}
                          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
              </div>
            );
          })()}

          {/* Download Options */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Download Results</h3>
            <div className="grid gap-3">
              <button
                onClick={handleDownloadAnnotated}
                className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FileDown className="h-5 w-5" />
                <div className="text-left flex-1">
                  <p className="font-medium">Annotated Download</p>
                  <p className="text-sm text-blue-100">Original data with 'annotations' column added</p>
                </div>
              </button>
              
              <button
                onClick={handleDownloadClean}
                className="flex items-center gap-3 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-5 w-5" />
                <div className="text-left flex-1">
                  <p className="font-medium">Clean Download</p>
                  <p className="text-sm text-green-100">
                    Excludes records with {excludeAnnotations.length > 0 ? excludeAnnotations.join(', ') : 'selected'} annotations ({cleanRecords?.length.toLocaleString()})
                  </p>
                </div>
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
