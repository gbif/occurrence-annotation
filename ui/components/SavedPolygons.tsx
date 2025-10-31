import { useState, useEffect, useRef, useCallback } from 'react';
import { PolygonData } from '../App';
import { Button } from './ui/button';
import { Upload, Loader2, Trash2, MessageSquare } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { toast } from 'sonner';
import { coordinatesToWKT } from '../utils/wktParser';
import { MiniMapPreview } from './MiniMapPreview';
import { getAnnotationApiUrl } from '../utils/apiConfig';

// Searchable multi-select component for Basis of Record
// Supports typing to filter options, keyboard navigation, and chip-based selection
function BasisOfRecordMultiSelect({ 
  options, 
  selected, 
  onChange 
}: { 
  options: string[]; 
  selected: string[]; 
  onChange: (selected: string[]) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase()) && !selected.includes(option)
  );

  // Handle option selection
  const handleSelectOption = (option: string) => {
    if (!selected.includes(option)) {
      onChange([...selected, option]);
    }
    setSearchTerm('');
    setShowDropdown(false);
    setFocusedIndex(-1);
    inputRef.current?.focus();
  };

  // Handle chip removal
  const handleRemoveChip = (option: string) => {
    onChange(selected.filter(item => item !== option));
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown' && filteredOptions.length > 0) {
        e.preventDefault();
        setShowDropdown(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          handleSelectOption(filteredOptions[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setFocusedIndex(-1);
        break;
      case 'Backspace':
        if (searchTerm === '' && selected.length > 0) {
          e.preventDefault();
          handleRemoveChip(selected[selected.length - 1]);
        }
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-700">
          Basis of Record (optional)
          {selected.length > 0 && (
            <span className="ml-1 text-blue-600 font-medium">({selected.length} selected)</span>
          )}
        </Label>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => onChange(options)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-gray-600 hover:text-gray-800 underline"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="relative" ref={dropdownRef}>
        {/* Selected chips and input container */}
        <div className="min-h-[2.25rem] border border-gray-300 rounded p-2 bg-white flex flex-wrap gap-1 items-center">
          {/* Selected chips */}
          {selected.map((option) => (
            <span
              key={option}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
            >
              {option.replace(/_/g, ' ')}
              <button
                type="button"
                onClick={() => handleRemoveChip(option)}
                className="hover:bg-blue-200 rounded-sm p-0.5 -mr-1"
                aria-label={`Remove ${option}`}
              >
                ×
              </button>
            </span>
          ))}
          
          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowDropdown(true);
              setFocusedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (filteredOptions.length > 0) {
                setShowDropdown(true);
              }
            }}
            placeholder={selected.length === 0 ? "Type to search basis of record..." : ""}
            className="flex-1 min-w-[120px] text-xs outline-none bg-transparent"
          />
        </div>
        
        {/* Dropdown options */}
        {showDropdown && filteredOptions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-32 overflow-y-auto">
            {filteredOptions.map((option, index) => (
              <div
                key={option}
                className={`p-2 text-xs cursor-pointer ${
                  index === focusedIndex 
                    ? 'bg-blue-100 text-blue-900' 
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => handleSelectOption(option)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                {option.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        )}
        
        {/* No options message */}
        {selected.length === 0 && (
          <div className="text-xs text-gray-500 italic mt-1">
            No selection - will apply to all basis of record types
          </div>
        )}
      </div>
    </div>
  );
}

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

interface SavedPolygonsProps {
  polygons: PolygonData[];
  onDelete: (id: string) => void;
  editingPolygonId: string | null;
  onToggleInvert: (id: string) => void;
  onImportWKT?: (coordinates: [number, number][] | [number, number][][], isMulti?: boolean) => void;
  onUpdateAnnotation?: (id: string, annotation: string) => void;
  currentPolygon?: [number, number][] | null;
  isCurrentInverted?: boolean;
  onCurrentAnnotationChange?: (annotation: string) => void;
  currentAnnotation?: string;
  onNavigateToPolygon?: (lat: number, lng: number) => void;
  onRuleSavedToGBIF?: (polygonId?: string) => void;
}

interface SaveToGBIFDialogProps {
  polygon: PolygonData;
  onSuccess: () => void;
  annotation: string;
  onRuleSavedToGBIF?: (polygonId?: string) => void;
}

interface ImportWKTDialogProps {
  onImport: (coordinates: [number, number][] | [number, number][][], isMulti?: boolean) => void;
}

function ImportWKTDialog({ onImport }: ImportWKTDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [wktInput, setWktInput] = useState('');

  const parseWKT = (wkt: string): [number, number][] | null => {
    try {
      // Remove extra whitespace and normalize
      const normalized = wkt.trim().toUpperCase();
      
      // Match POLYGON pattern
      const polygonMatch = normalized.match(/POLYGON\s*\(\s*\((.*?)\)\s*\)/);
      if (!polygonMatch) {
        throw new Error('Invalid WKT format. Expected: POLYGON((lon lat, lon lat, ...))');
      }

      const coordsString = polygonMatch[1];
      const coordPairs = coordsString.split(',').map(pair => pair.trim());
      
      const coordinates: [number, number][] = [];
      for (const pair of coordPairs) {
        const [lonStr, latStr] = pair.split(/\s+/);
        const lon = parseFloat(lonStr);
        const lat = parseFloat(latStr);
        
        if (isNaN(lon) || isNaN(lat)) {
          throw new Error('Invalid coordinate values');
        }
        
        // Validate coordinate ranges
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          throw new Error('Coordinates out of valid range (lat: -90 to 90, lon: -180 to 180)');
        }
        
        coordinates.push([lat, lon]); // Convert back to [lat, lng] for our internal format
      }
      
      if (coordinates.length < 3) {
        throw new Error('Polygon must have at least 3 points');
      }
      
      // Remove the last point if it's a duplicate of the first (closing point)
      if (coordinates.length > 3) {
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) {
          coordinates.pop();
        }
      }
      
      return coordinates;
    } catch (error) {
      throw error;
    }
  };

  const handleImport = () => {
    try {
      const coordinates = parseWKT(wktInput);
      if (coordinates) {
        onImport(coordinates);
        toast.success(`Polygon imported with ${coordinates.length} points`);
        setIsOpen(false);
        setWktInput('');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse WKT');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
        >
          wkt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Polygon from WKT</DialogTitle>
          <DialogDescription>
            Paste a WKT polygon string to add it to the map
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wkt-input">WKT String</Label>
            <Textarea
              id="wkt-input"
              value={wktInput}
              onChange={(e) => setWktInput(e.target.value)}
              placeholder="POLYGON((lon lat, lon lat, lon lat, lon lat))"
              className="font-mono text-sm resize-none"
              rows={8}
            />
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <p><strong>Format:</strong> POLYGON((lon lat, lon lat, ...))</p>
            <p><strong>Example:</strong> POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))</p>
            <p className="text-gray-500">Note: Coordinates use longitude, latitude order in WKT format</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setWktInput('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={!wktInput.trim()}
              className="flex-1"
            >
              Import Polygon
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Small GBIF logo component
function GBIFLogoSmall() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C10.6868 2 9.38642 2.25866 8.17317 2.7612C6.95991 3.26375 5.85752 4.00035 4.92893 4.92893C3.05357 6.8043 2 9.34784 2 12C2 14.6522 3.05357 17.1957 4.92893 19.0711C5.85752 19.9997 6.95991 20.7362 8.17317 21.2388C9.38642 21.7413 10.6868 22 12 22C14.6522 22 17.1957 20.9464 19.0711 19.0711C20.9464 17.1957 22 14.6522 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7362 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2Z" fill="#4BA524"/>
      <path d="M12 6C11.4696 6 10.9609 6.21071 10.5858 6.58579C10.2107 6.96086 10 7.46957 10 8V12C10 12.5304 10.2107 13.0391 10.5858 13.4142C10.9609 13.7893 11.4696 14 12 14C12.5304 14 13.0391 13.7893 13.4142 13.4142C13.7893 13.0391 14 12.5304 14 12V8C14 7.46957 13.7893 6.96086 13.4142 6.58579C13.0391 6.21071 12.5304 6 12 6ZM9 16C9 15.7348 9.10536 15.4804 9.29289 15.2929C9.48043 15.1054 9.73478 15 10 15H14C14.2652 15 14.5196 15.1054 14.7071 15.2929C14.8946 15.4804 15 15.7348 15 16C15 16.2652 14.8946 16.5196 14.7071 16.7071C14.5196 16.8946 14.2652 17 14 17H10C9.73478 17 9.48043 16.8946 9.29289 16.7071C9.10536 16.5196 9 16.2652 9 16Z" fill="white"/>
    </svg>
  );
}

function SaveToGBIFDialog({ polygon, onSuccess, annotation, onRuleSavedToGBIF }: SaveToGBIFDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wktText, setWktText] = useState('');
  
  // Complex rule state
  const [showComplexOptions, setShowComplexOptions] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState(annotation);
  const [basisOfRecord, setBasisOfRecord] = useState<string[]>([]);
  const [datasetKey, setDatasetKey] = useState<string>('');
  const [yearRange, setYearRange] = useState<string>('');
  const [basisOfRecordOptions, setBasisOfRecordOptions] = useState<string[]>([]);
  
  // Year range slider state
  const [yearRangeStart, setYearRangeStart] = useState<number>(1600);
  const [yearRangeEnd, setYearRangeEnd] = useState<number>(2025);
  const [useCustomYearRange, setUseCustomYearRange] = useState<boolean>(true);
  
  // Dataset search state
  const [datasetQuery, setDatasetQuery] = useState<string>('');
  const [datasetSuggestions, setDatasetSuggestions] = useState<any[]>([]);
  const [showDatasetSuggestions, setShowDatasetSuggestions] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  
  // WKT editing state
  const [showWktEditor, setShowWktEditor] = useState(false);

  // Year range validation state
  const [yearRangeError, setYearRangeError] = useState<string>('');

  // Validate year range input
  const validateYearRange = (value: string): string => {
    if (!value.trim()) {
      return ''; // Empty is valid (optional field)
    }

    // Remove any whitespace
    const cleanValue = value.trim();
    
    // Check for valid patterns:
    // - Single year: 2020
    // - Year range: 2020-2023
    // - Greater than: >2000 or >=2000
    // - Less than: <2000 or <=2000
    // - Multiple ranges: 2000-2010,2015-2020
    
    const patterns = [
      /^\d{4}$/, // Single year (4 digits)
      /^\d{4}-\d{4}$/, // Year range (e.g., 2020-2023)
      /^[>]=?\d{4}$/, // Greater than (e.g., >2000, >=2000)
      /^[<]=?\d{4}$/, // Less than (e.g., <2000, <=2000)
      /^(\d{4}(-\d{4})?)(,\d{4}(-\d{4})?)*$/ // Multiple ranges (e.g., 2000-2010,2015-2020)
    ];

    const isValidPattern = patterns.some(pattern => pattern.test(cleanValue));
    
    if (!isValidPattern) {
      return 'Invalid format. Use: 2020, 2020-2023, >2000, <2000, or 2000-2010,2015-2020';
    }

    // Validate year values are reasonable (between 1600 and current year + 10)
    const currentYear = new Date().getFullYear();
    const maxYear = currentYear + 10;
    const minYear = 1600;
    
    const yearMatches = cleanValue.match(/\d{4}/g);
    if (yearMatches) {
      for (const yearStr of yearMatches) {
        const year = parseInt(yearStr);
        if (year < minYear || year > maxYear) {
          return `Years must be between ${minYear} and ${maxYear}`;
        }
      }
    }

    // Validate ranges (start year should be <= end year)
    const rangeMatches = cleanValue.match(/(\d{4})-(\d{4})/g);
    if (rangeMatches) {
      for (const range of rangeMatches) {
        const [start, end] = range.split('-').map(y => parseInt(y));
        if (start > end) {
          return 'In ranges, start year must be less than or equal to end year';
        }
      }
    }

    return ''; // Valid
  };

  // Handle year range change with validation
  const handleYearRangeChange = (value: string) => {
    setYearRange(value);
    const error = validateYearRange(value);
    setYearRangeError(error);
  };

  // Initialize WKT when dialog opens
  useEffect(() => {
    if (isOpen) {
      const initialWkt = coordinatesToWKT(polygon.coordinates, polygon.isMultiPolygon, polygon.inverted);
      console.log('SaveToGBIF: Initializing WKT for polygon:', {
        id: polygon.id,
        inverted: polygon.inverted,
        isMultiPolygon: polygon.isMultiPolygon,
        coordinatesLength: Array.isArray(polygon.coordinates[0]) ? polygon.coordinates.length : 1,
        generatedWKT: initialWkt
      });
      setWktText(initialWkt);
    }
  }, [isOpen, polygon.coordinates, polygon.inverted]);

  // Fetch basis of record options from GBIF API
  useEffect(() => {
    const fetchBasisOfRecordOptions = async () => {
      try {
        const response = await fetch('https://api.gbif.org/v1/enumeration/basic/BasisOfRecord');
        if (response.ok) {
          const options = await response.json();
          setBasisOfRecordOptions(options);
        }
      } catch (error) {
        console.warn('Failed to fetch basis of record options:', error);
        // Fallback to some common options if API fails
        setBasisOfRecordOptions(['HUMAN_OBSERVATION', 'MACHINE_OBSERVATION', 'PRESERVED_SPECIMEN', 'OBSERVATION']);
      }
    };

    fetchBasisOfRecordOptions();
  }, []);

  // Update yearRange string when slider values change
  useEffect(() => {
    if (!useCustomYearRange) {
      if (yearRangeStart === yearRangeEnd) {
        setYearRange(yearRangeStart.toString());
      } else {
        setYearRange(`${yearRangeStart}-${yearRangeEnd}`);
      }
    }
  }, [yearRangeStart, yearRangeEnd, useCustomYearRange]);

  // Handle clicks outside dataset suggestions
  useEffect(() => {
    const handleClickOutside = () => {
      setShowDatasetSuggestions(false);
    };

    if (showDatasetSuggestions) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDatasetSuggestions]);

  // Function to search datasets with debouncing
  const searchDatasetsDebounced = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setDatasetSuggestions([]);
        setShowDatasetSuggestions(false);
        return;
      }

      try {
        const response = await fetch(`https://api.gbif.org/v1/dataset/suggest?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const suggestions = await response.json();
          setDatasetSuggestions(suggestions);
          setShowDatasetSuggestions(suggestions.length > 0);
        }
      } catch (error) {
        console.warn('Failed to fetch dataset suggestions:', error);
      }
    }, 300),
    []
  );

  // Function to search datasets (immediate call for focus)
  const searchDatasets = async (query: string) => {
    searchDatasetsDebounced(query);
  };

  // Handle dataset selection
  const handleDatasetSelect = (dataset: any) => {
    setSelectedDataset(dataset);
    setDatasetKey(dataset.key);
    setDatasetQuery(dataset.title);
    setShowDatasetSuggestions(false);
  };

  // Function to post pending comments to GBIF after rule creation
  const postPendingComments = async (ruleId: number, gbifAuth: string) => {
    try {
      const existingComments = JSON.parse(localStorage.getItem('polygonComments') || '[]');
      const pendingComments = existingComments.filter(
        (comment: any) => comment.polygonId === polygon.id && comment.status === 'pending'
      );

      if (pendingComments.length === 0) {
        return;
      }

      let successfulComments = 0;
      
      for (const comment of pendingComments) {
        try {
          const response = await fetch(
            getAnnotationApiUrl(`/rule/${ruleId}/comment`),
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${gbifAuth}`,
              },
              body: JSON.stringify({ comment: comment.comment }),
            }
          );

          if (response.ok) {
            // Mark comment as successfully posted
            comment.status = 'saved';
            comment.ruleId = ruleId;
            successfulComments++;
          } else {
            console.warn(`Failed to post comment: ${response.statusText}`);
            // Keep comment as pending so user can try again later
          }
        } catch (err) {
          console.warn('Error posting individual comment:', err);
          // Keep comment as pending so user can try again later
        }
      }

      // Update localStorage with new comment statuses
      localStorage.setItem('polygonComments', JSON.stringify(existingComments));
      
      if (successfulComments > 0) {
        toast.success(`Rule saved! ${successfulComments} comment(s) also posted to GBIF.`);
      } else if (pendingComments.length > 0) {
        toast.success('Rule saved! Comments remain pending (login required to post to GBIF).');
      } else {
        toast.success('Annotation rule saved to GBIF successfully!');
      }
    } catch (err) {
      console.warn('Error processing pending comments:', err);
      toast.success('Annotation rule saved to GBIF successfully!');
    }
  };
  const [occurrenceCount, setOccurrenceCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Fetch occurrence count when dialog opens
  useEffect(() => {
    const fetchOccurrenceCount = async () => {
      if (!isOpen || !polygon.species) {
        setOccurrenceCount(null);
        return;
      }

      setLoadingCount(true);
      try {
        // Convert coordinates to WKT
        const wktGeometry = coordinatesToWKT(polygon.coordinates, polygon.isMultiPolygon, polygon.inverted);
        
        // Build the GBIF occurrence search URL
        const params = new URLSearchParams({
          taxonKey: polygon.species.key.toString(),
          geometry: wktGeometry,
          limit: '0', // We only want the count
        });

        const response = await fetch(
          `https://api.gbif.org/v1/occurrence/search?${params.toString()}`,
          {
            mode: 'cors',
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          // Silently fail - occurrence count is optional information
          setOccurrenceCount(null);
          setLoadingCount(false);
          return;
        }

        const data = await response.json();
        setOccurrenceCount(data.count || 0);
      } catch (error) {
        // Silently fail - just set count to null without logging errors
        // This is expected to fail sometimes due to CORS or network issues
        setOccurrenceCount(null);
      } finally {
        setLoadingCount(false);
      }
    };

    fetchOccurrenceCount();
  }, [isOpen, polygon.species, polygon.coordinates]);

  const handleSave = async () => {
    console.log('SaveToGBIF: handleSave called');
    
    // Validate year range input before proceeding
    if (useCustomYearRange && yearRange.trim()) {
      const validationError = validateYearRange(yearRange);
      if (validationError) {
        toast.error('⚠️ Invalid year range format', {
          description: validationError
        });
        return;
      }
    }
    
    // Check if user is logged in
    const gbifAuth = localStorage.getItem('gbifAuth');
    const gbifUser = localStorage.getItem('gbifUser');
    
    if (!gbifAuth || !gbifUser) {
      console.log('SaveToGBIF: No GBIF auth found');
      toast.error('⚠️ Please login to GBIF first to save annotation rules', {
        description: 'You need to be authenticated with GBIF to save annotation rules to the database.'
      });
      return;
    }

    if (!polygon.species) {
      console.log('SaveToGBIF: No species selected');
      toast.error('⚠️ Please select a species first', {
        description: 'You must assign a species to this polygon before saving it as an annotation rule.'
      });
      return;
    }

    console.log('SaveToGBIF: Starting save process for polygon:', polygon.id);
    console.log('SaveToGBIF: Using WKT text:', wktText);
    setIsLoading(true);

    try {
      // Use WKT from the editable text box
      const wktGeometry = wktText.trim();
      console.log('SaveToGBIF: Final WKT geometry to send:', wktGeometry);
      
      // Validate WKT format
      if (!wktGeometry || (!wktGeometry.startsWith('POLYGON') && !wktGeometry.startsWith('MULTIPOLYGON'))) {
        toast.error('Invalid WKT format. Please check the geometry.');
        setIsLoading(false);
        return;
      }
      
      // Prepare the payload
      const payload: any = {
        projectId: null,
        rulesetId: null,
        taxonKey: polygon.species.key,
        geometry: wktGeometry,
        annotation: showComplexOptions ? selectedAnnotation : annotation,
      };

      // Add complex rule fields if enabled
      if (showComplexOptions) {
        if (basisOfRecord.length > 0) {
          payload.basisOfRecord = basisOfRecord;
        }
        if (datasetKey.trim()) {
          payload.datasetKey = datasetKey.trim();
        }
        if (yearRange.trim()) {
          payload.yearRange = yearRange.trim();
        }
      }

      // console.log('Saving to GBIF:', payload);

      // Make the API request
      const response = await fetch(
        getAnnotationApiUrl('/rule'),
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${gbifAuth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GBIF API error:', errorText);
        
        if (response.status === 401) {
          toast.error('Authentication failed. Please login again.');
          localStorage.removeItem('gbifAuth');
          localStorage.removeItem('gbifUser');
        } else if (response.status === 403) {
          toast.error('Access denied. Check your permissions for this project.');
        } else {
          toast.error(`Failed to save rule: ${response.statusText}`);
        }
        return;
      }

      const result = await response.json();
      console.log('Rule saved successfully:', result);
      
      // Post any pending comments for this polygon
      if (result && result.id) {
        console.log('Attempting to post pending comments for rule ID:', result.id);
        await postPendingComments(result.id, gbifAuth);
      }
      
      setIsOpen(false);
      
      // Call the custom callback to clear the current polygon and show success message
      if (onRuleSavedToGBIF) {
        onRuleSavedToGBIF(polygon.id);
      } else {
        onSuccess(); // Fallback to original behavior
        // Only show default toast if no custom callback
        toast.success('Annotation rule saved to GBIF successfully!');
      }
    } catch (error) {
      console.error('Error saving to GBIF:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getLoginStatus = () => {
    const gbifAuth = localStorage.getItem('gbifAuth');
    const gbifUser = localStorage.getItem('gbifUser');
    return !!(gbifAuth && gbifUser);
  };

  const getButtonTooltip = () => {
    const isLoggedIn = getLoginStatus();
    if (!isLoggedIn && !polygon.species) {
      return "Login to GBIF and select a species first";
    } else if (!isLoggedIn) {
      return "Login to GBIF first";
    } else if (!polygon.species) {
      return "Select a species first";
    }
    return "Save to GBIF";
  };

  const isButtonDisabled = !polygon.species || !getLoginStatus();
  
  // Debug logging
  console.log('SaveToGBIF button state:', {
    hasSpecies: !!polygon.species,
    isLoggedIn: getLoginStatus(),
    isDisabled: isButtonDisabled,
    tooltip: getButtonTooltip()
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <div
          onClick={(e) => {
            if (isButtonDisabled) {
              e.preventDefault();
              e.stopPropagation();
              // Show warning toast when disabled button is clicked
              if (!getLoginStatus() && !polygon.species) {
                toast.error('⚠️ Please login to GBIF and select a species first', {
                  description: 'Both authentication and species selection are required to save annotation rules.'
                });
              } else if (!getLoginStatus()) {
                toast.error('⚠️ Please login to GBIF first', {
                  description: 'You need to be authenticated with GBIF to save annotation rules.'
                });
              } else if (!polygon.species) {
                toast.error('⚠️ Please select a species first', {
                  description: 'You must assign a species to this polygon before saving it as an annotation rule.'
                });
              }
            }
          }}
        >
          <Button
            size="sm"
            variant="outline"
            className={`px-3 py-1 ${isButtonDisabled 
              ? 'border-gray-300 text-gray-400 cursor-not-allowed' 
              : 'border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400'
            }`}
            disabled={isButtonDisabled}
            title={getButtonTooltip()}
          >
            <Upload className="w-4 h-4 mr-1" />
            <span className="text-xs">Save to GBIF</span>
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Save Rule to GBIF</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Warning Messages */}
          {(!getLoginStatus() || !polygon.species) && (
            <div className="p-3 bg-white border border-red-200 rounded-lg shadow-sm">
              <div className="flex items-start gap-2">
                <div className="text-red-600 text-sm">⚠️</div>
                <div className="text-sm text-red-700">
                  <p className="font-medium">Cannot save to GBIF:</p>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    {!getLoginStatus() && <li>You are not logged into GBIF</li>}
                    {!polygon.species && <li>No species selected for this polygon</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Species Info */}
          {/* Species information removed - now shown in rule description */}

          {/* Rule Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowComplexOptions(!showComplexOptions)}
                className="text-xs text-gray-500 hover:text-gray-700 h-6 px-2"
              >
                {showComplexOptions ? "Hide options" : "Add more complexity"}
              </Button>
            </div>

            {showComplexOptions && (
              /* Complex Rule Options */
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-blue-900">Complex Rule Filters</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowComplexOptions(false)}
                    className="h-6 w-6 p-0 text-blue-700 hover:text-blue-900"
                  >
                    ×
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {/* Annotation Type */}
                  <div className="space-y-1">
                    <Label htmlFor="annotation-select" className="text-xs text-gray-700">Annotation</Label>
                    <select
                      id="annotation-select"
                      value={selectedAnnotation}
                      onChange={(e) => setSelectedAnnotation(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="SUSPICIOUS">SUSPICIOUS</option>
                      <option value="MANAGED">MANAGED</option>
                      <option value="FORMER">FORMER</option>
                      <option value="VAGRANT">VAGRANT</option>
                      <option value="NATIVE">NATIVE</option>
                      <option value="INTRODUCED">INTRODUCED</option>
                    </select>
                  </div>

                  {/* Warning for non-SUSPICIOUS annotations */}
                  {selectedAnnotation !== 'SUSPICIOUS' && (
                    <div className="p-2 bg-amber-50 rounded border border-amber-200">
                      <p className="text-xs text-amber-700">
                        ⚠️ It is extremely difficult to make rules that make sense for all occurrence records using annotation types other than suspicious. Use with caution.
                      </p>
                    </div>
                  )}

                  {/* Basis of Record - Searchable Multi-Select */}
                  <BasisOfRecordMultiSelect
                    options={basisOfRecordOptions}
                    selected={basisOfRecord}
                    onChange={setBasisOfRecord}
                  />

                  {/* Dataset Key */}
                  <div className="space-y-1 relative">
                    <Label htmlFor="dataset-key" className="text-xs text-gray-700">Dataset (optional)</Label>
                    <div className="relative">
                      <Input
                        id="dataset-key"
                        type="text"
                        value={datasetQuery}
                        onChange={(e) => {
                          setDatasetQuery(e.target.value);
                          searchDatasets(e.target.value);
                        }}
                        onFocus={() => {
                          if (datasetSuggestions.length > 0) {
                            setShowDatasetSuggestions(true);
                          }
                        }}
                        placeholder="Leave empty to apply to all datasets"
                        className="text-xs py-1"
                      />
                      {showDatasetSuggestions && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {datasetSuggestions.map((dataset) => (
                            <div
                              key={dataset.key}
                              className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                              onClick={() => handleDatasetSelect(dataset)}
                            >
                              <div className="text-xs font-medium text-gray-900 truncate">
                                {dataset.title}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {dataset.key} • {dataset.type}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedDataset && (
                      <div className="text-xs text-gray-600">
                        Selected: <span className="font-medium">{selectedDataset.title}</span>
                      </div>
                    )}
                  </div>

                  {/* Year Range */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-gray-700">Year Range (optional)</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setUseCustomYearRange(!useCustomYearRange)}
                        className="h-5 px-2 text-xs text-blue-600 hover:text-blue-800"
                      >
                        {useCustomYearRange ? "Use slider" : "Custom text"}
                      </Button>
                    </div>
                    
                    {useCustomYearRange ? (
                      /* Custom text input */
                      <div className="space-y-1">
                        <Input
                          type="text"
                          value={yearRange}
                          onChange={(e) => handleYearRangeChange(e.target.value)}
                          placeholder="e.g., 2020-2023, >2000, <1950"
                          className={`text-xs py-1 ${yearRangeError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {yearRangeError && (
                          <p className="text-xs text-red-600">{yearRangeError}</p>
                        )}
                        <p className="text-xs text-gray-500">
                          Examples: 2020, 2020-2023, &gt;2000, &lt;1950, 2000-2010,2015-2020
                        </p>
                      </div>
                    ) : (
                      /* Year range slider */
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>From: {yearRangeStart}</span>
                          <span>To: {yearRangeEnd}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500">Start year:</div>
                          <input
                            type="range"
                            min="1600"
                            max="2025"
                            value={yearRangeStart}
                            onChange={(e) => {
                              const newStart = parseInt(e.target.value);
                              setYearRangeStart(newStart);
                              if (newStart > yearRangeEnd) {
                                setYearRangeEnd(newStart);
                              }
                            }}
                            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="text-xs text-gray-500">End year:</div>
                          <input
                            type="range"
                            min="1600"
                            max="2025"
                            value={yearRangeEnd}
                            onChange={(e) => {
                              const newEnd = parseInt(e.target.value);
                              setYearRangeEnd(newEnd);
                              if (newEnd < yearRangeStart) {
                                setYearRangeStart(newEnd);
                              }
                            }}
                            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        <div className="text-xs text-gray-500 text-center">
                          Range: {yearRangeStart === yearRangeEnd ? yearRangeStart : `${yearRangeStart} - ${yearRangeEnd}`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <p className="text-xs text-gray-600 mt-2">
                  Leave fields empty to apply to all values of that type
                </p>
                
                {/* Complex Rule Display */}
                <div className="mt-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-base text-gray-800">
                    This rule will designate all <span className="font-bold">future</span> and <span className="font-bold">past</span> occurrence records of <span className="font-bold">"{polygon.species?.scientificName || polygon.species?.name || 'selected species'}"</span>
                    {basisOfRecord && basisOfRecord.length > 0 && (
                      <> with basis of record <span className="font-bold">"{basisOfRecord.map(b => b.replace(/_/g, ' ')).join(', ')}"</span></>
                    )}
                    {selectedDataset && (
                      <> from dataset <span className="font-bold">"{selectedDataset.title}"</span></>
                    )}
                    {(yearRange || (yearRangeStart !== 1600 || yearRangeEnd !== 2025)) && (
                      <> from years <span className="font-bold">{yearRange || (yearRangeStart === yearRangeEnd ? yearRangeStart : `${yearRangeStart}-${yearRangeEnd}`)}</span></>
                    )}
                    {} within the <span className="font-bold">polygon area</span> as <span className={`font-bold ${
                      selectedAnnotation === 'SUSPICIOUS' ? 'text-red-600' :
                      selectedAnnotation === 'NATIVE' ? 'text-green-600' :
                      selectedAnnotation === 'MANAGED' ? 'text-blue-600' :
                      selectedAnnotation === 'FORMER' ? 'text-purple-600' :
                      selectedAnnotation === 'VAGRANT' ? 'text-orange-600' :
                      selectedAnnotation === 'INTRODUCED' ? 'text-amber-600' :
                      'text-red-600'
                    }`}>{selectedAnnotation.toLowerCase()}</span>.
                  </p>
                </div>
              </div>
            )}

            {!showComplexOptions && (
              /* Simple Rule Display */
              <div className="p-3 rounded-lg border border-gray-200">
                <p className="text-base text-gray-800">
                  This rule will designate all <span className="font-bold">future</span> and <span className="font-bold">past</span> occurrence records of <span className="font-bold">"{polygon.species?.scientificName || polygon.species?.name || 'selected species'}"</span> within the <span className="font-bold">polygon area</span> as <span className="font-bold text-red-600">suspicious</span>.
                </p>
              </div>
            )}
          </div>


          {/* Polygon info */}
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex items-center justify-between">
              <p>Geometry: {polygon.coordinates.length} vertices</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowWktEditor(!showWktEditor)}
                className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
              >
                {showWktEditor ? 'Hide WKT' : 'Edit WKT'}
              </Button>
            </div>
            {polygon.inverted && (
              <p className="text-amber-600">⚠️ This polygon is inverted (excludes the area inside)</p>
            )}
            {polygon.species && (
              <p className="flex items-center gap-2">
                {loadingCount ? (
                  <>
                    <span>Occurrences affected:</span>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-gray-500">Calculating...</span>
                  </>
                ) : occurrenceCount !== null ? (
                  <>
                    <span>Occurrences affected:</span>
                    <span className="text-gray-900">{occurrenceCount.toLocaleString()}</span>
                  </>
                ) : (
                  <>
                    <span>Occurrences affected:</span>
                    <span className="text-gray-500">Unable to calculate</span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* WKT Geometry Editor (Collapsible) */}
          {showWktEditor && (
            <div className="space-y-2 p-3 bg-gray-50 rounded border">
              <Label htmlFor={`wkt-${polygon.id}`} className="text-xs text-gray-600">WKT Geometry (Advanced)</Label>
              <Textarea
                id={`wkt-${polygon.id}`}
                value={wktText}
                onChange={(e) => setWktText(e.target.value)}
                placeholder="POLYGON((...)) or MULTIPOLYGON(...)"
                className="resize-none font-mono text-xs"
                rows={3}
              />
              <p className="text-xs text-gray-500">
                Edit the WKT geometry if needed before saving
              </p>
            </div>
          )}
        </div>
        
        {/* Sticky Footer with Buttons */}
        <div className="flex gap-2 pt-4 border-t bg-white flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading || !getLoginStatus() || !polygon.species}
            className="flex-1"
          >
            {isLoading ? 'Saving...' : 'Save to GBIF'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PolygonPreview({ coordinates, annotation = 'SUSPICIOUS', isMultiPolygon = false, onClick }: { coordinates: [number, number][] | [number, number][][], annotation?: string, isMultiPolygon?: boolean, onClick?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    console.log('🖼️ POLYGON PREVIEW RENDERING (Canvas):', {
      annotation,
      isMultiPolygon,
      polygonCount: isMultiPolygon ? (coordinates as [number, number][][]).length : 1
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Normalize coordinates to array of polygons
    const polygons: [number, number][][] = isMultiPolygon 
      ? (coordinates as [number, number][][])
      : [coordinates as [number, number][]];
    
    if (polygons.length === 0 || polygons[0].length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find bounds across all polygons
    const allCoords = polygons.flat();
    const lats = allCoords.map(c => c[0]);
    const lngs = allCoords.map(c => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;

    // Add padding
    const padding = 4;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    // Scale to fit canvas
    const scale = Math.min(width / lngRange, height / latRange);

    // Draw all polygons
    polygons.forEach(polyCoords => {
      ctx.beginPath();
      polyCoords.forEach((coord, i) => {
        const x = padding + (coord[1] - minLng) * scale;
        const y = padding + (maxLat - coord[0]) * scale; // Flip Y axis
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();

    // Get color based on annotation type
    const annotationColors: { [key: string]: { fill: string; fillRgba: string; stroke: string; strokeRgba: string } } = {
      SUSPICIOUS: { fill: '#ef4444', fillRgba: 'rgba(239, 68, 68, 0.1)', stroke: '#dc2626', strokeRgba: 'rgba(220, 38, 38, 0.6)' },
      NATIVE: { fill: '#10b981', fillRgba: 'rgba(16, 185, 129, 0.1)', stroke: '#059669', strokeRgba: 'rgba(5, 150, 105, 0.6)' },
      MANAGED: { fill: '#3b82f6', fillRgba: 'rgba(59, 130, 246, 0.1)', stroke: '#2563eb', strokeRgba: 'rgba(37, 99, 235, 0.6)' },
      FORMER: { fill: '#a855f7', fillRgba: 'rgba(168, 85, 247, 0.1)', stroke: '#9333ea', strokeRgba: 'rgba(147, 51, 234, 0.6)' },
      VAGRANT: { fill: '#f97316', fillRgba: 'rgba(249, 115, 22, 0.1)', stroke: '#ea580c', strokeRgba: 'rgba(234, 88, 12, 0.6)' },
      INTRODUCED: { fill: '#d97706', fillRgba: 'rgba(217, 119, 6, 0.1)', stroke: '#b45309', strokeRgba: 'rgba(180, 83, 9, 0.6)' },
    };
    const color = annotationColors[annotation.toUpperCase()] || annotationColors.SUSPICIOUS;

      // Fill and stroke each polygon
      ctx.fillStyle = color.fillRgba;
      ctx.fill();
      ctx.strokeStyle = color.strokeRgba;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw points for each polygon
      ctx.fillStyle = color.strokeRgba;
      polyCoords.forEach((coord) => {
        const x = padding + (coord[1] - minLng) * scale;
        const y = padding + (maxLat - coord[0]) * scale;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }, [coordinates, annotation, isMultiPolygon]);

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={80}
      className={`border border-gray-200 rounded bg-white ${onClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
      onClick={onClick}
    />
  );
}

function PolygonCard({ 
  polygon, 
  onDelete, 
  onToggleInvert,
  onUpdateAnnotation,
  onNavigateToPolygon,
  onRuleSavedToGBIF
}: { 
  polygon: PolygonData; 
  onDelete: (id: string) => void;
  onToggleInvert: (id: string) => void;
  onUpdateAnnotation?: (id: string, annotation: string) => void;
  onNavigateToPolygon?: (lat: number, lng: number) => void;
  onRuleSavedToGBIF?: () => void;
}) {
  const annotation = polygon.annotation || 'SUSPICIOUS'; // Use polygon annotation or default to SUSPICIOUS
  
  // Comment functionality state
  const [showCommentSection, setShowCommentSection] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Handle adding comments to polygons
  const handleAddComment = async () => {
    console.log('handleAddComment called');
    
    if (!newComment.trim()) {
      console.log('Comment is empty');
      toast.error('Comment cannot be empty');
      return;
    }

    // Check if localStorage is available
    if (typeof Storage === 'undefined') {
      console.error('localStorage is not available');
      toast.error('Local storage is not available in your browser');
      return;
    }

    setSubmittingComment(true);
    
    try {
      // For local storage, we don't need to be logged in
      // We'll get the username when the rule is saved to GBIF
      let userName = null; // Use null instead of 'Anonymous'
      
      // Try to get username if logged in, but don't require it
      try {
        const gbifAuthStr = localStorage.getItem('gbifAuth');
        if (gbifAuthStr) {
          const gbifAuth = JSON.parse(gbifAuthStr);
          if (gbifAuth.userName) {
            userName = gbifAuth.userName;
          }
        }
      } catch (authErr) {
        console.log('No valid auth found, using anonymous user');
      }

      console.log('Using username:', userName || 'anonymous');

      // Store comment locally as "pending" until polygon is saved as a rule to GBIF
      const comment = {
        polygonId: polygon.id,
        comment: newComment.trim(),
        timestamp: new Date().toISOString(),
        user: userName,
        status: 'pending' // Will be 'saved' once the rule is created and comment posted to GBIF
      };
      
      console.log('Comment object created:', comment);
      
      // Get existing comments safely
      let existingComments = [];
      try {
        const commentsStr = localStorage.getItem('polygonComments');
        if (commentsStr) {
          existingComments = JSON.parse(commentsStr);
        }
      } catch (parseErr) {
        console.warn('Error parsing existing comments, starting fresh:', parseErr);
        existingComments = [];
      }
      
      console.log('Existing comments:', existingComments.length);
      
      existingComments.push(comment);
      
      try {
        localStorage.setItem('polygonComments', JSON.stringify(existingComments));
      } catch (storageErr) {
        console.error('Error saving to localStorage:', storageErr);
        throw new Error('Failed to save comment to local storage');
      }
      
      console.log('Comment saved to localStorage successfully');

      toast.success('Comment saved locally. Will be posted to GBIF when rule is saved.');
      
      // Clear the comment input
      setNewComment('');
      
    } catch (err) {
      console.error('Error adding comment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to add comment: ${errorMessage}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Get comment count for a polygon
  const getCommentCount = (): number => {
    try {
      const existingComments = JSON.parse(localStorage.getItem('polygonComments') || '[]');
      return existingComments.filter((comment: any) => comment.polygonId === polygon.id).length;
    } catch {
      return 0;
    }
  };

  // Get pending comment count
  const getPendingCommentCount = (): number => {
    try {
      const existingComments = JSON.parse(localStorage.getItem('polygonComments') || '[]');
      return existingComments.filter(
        (comment: any) => comment.polygonId === polygon.id && comment.status === 'pending'
      ).length;
    } catch {
      return 0;
    }
  };

  const polygonCount = polygon.isMultiPolygon 
    ? (polygon.coordinates as [number, number][][]).length 
    : 1;
  const totalVertices = polygon.isMultiPolygon
    ? (polygon.coordinates as [number, number][][]).reduce((sum, poly) => sum + poly.length, 0)
    : (polygon.coordinates as [number, number][]).length;

  return (
    <Card className="p-4">
      <div className="space-y-3">
        {/* Top section */}
        <div className="flex items-start gap-3">
          {/* Mini Map Preview */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <div 
              className={onNavigateToPolygon ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
              onClick={onNavigateToPolygon ? () => {
                const [lat, lng] = calculatePolygonCenter(polygon.coordinates, !!polygon.isMultiPolygon);
                onNavigateToPolygon(lat, lng);
              } : undefined}
            >
              <MiniMapPreview 
                coordinates={polygon.coordinates} 
                isMultiPolygon={polygon.isMultiPolygon}
                isInverted={polygon.inverted}
                annotation={polygon.annotation || "SUSPICIOUS"}
                width={120}
                height={80}
                className="rounded-md shadow-sm"
              />
            </div>
            <p className="text-gray-400 text-xs">
              {polygon.isMultiPolygon && <span className="font-medium">Multi: {polygonCount} • </span>}
              {totalVertices} pts
            </p>
          </div>

          {/* Delete button */}
          <div className="flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => onDelete(polygon.id)}
                  className="h-9 w-9 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete polygon</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Rule Description */}
        {polygon.species && (
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-gray-500">This</span> <span className="font-semibold text-gray-700">proposed</span> <span className="text-gray-500">rule will designate all</span> <span className="font-semibold">future</span> <span className="text-gray-500">and</span> <span className="font-semibold">past</span> <span className="text-gray-500">occurrence records of</span> <span className="font-semibold" style={{color: '#198240'}}>"{polygon.species.scientificName || polygon.species.name}"</span> <span className="text-gray-500">within the</span> <span className="font-semibold">polygon area</span> <span className="text-gray-500">as</span> <span className={`font-semibold ${
                annotation === 'SUSPICIOUS' ? 'text-red-600' :
                annotation === 'NATIVE' ? 'text-green-600' :
                annotation === 'MANAGED' ? 'text-blue-600' :
                annotation === 'FORMER' ? 'text-purple-600' :
                annotation === 'VAGRANT' ? 'text-orange-600' :
                annotation === 'INTRODUCED' ? 'text-amber-600' :
                'text-red-600'
              }`}>{annotation.toLowerCase()}</span><span className="text-gray-500">.</span>
            </p>
          </div>
        )}

        {/* Species Assignment Info */}
        <div className="space-y-1">
        </div>

        {/* Action Buttons - Bottom Row */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setShowCommentSection(!showCommentSection)}
                  className={`h-9 w-9 ${
                    getPendingCommentCount() > 0 
                      ? 'border-amber-300 text-amber-600 hover:bg-amber-50' 
                      : getCommentCount() > 0 
                        ? 'border-blue-300 text-blue-600 hover:bg-blue-50' 
                        : ''
                  } ${showCommentSection ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add comment{getCommentCount() > 0 ? ` (${getPendingCommentCount()} pending)` : ''}</p>
                {getPendingCommentCount() > 0 && (
                  <p className="text-xs text-amber-500">Comments will post to GBIF when rule is saved</p>
                )}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SaveToGBIFDialog 
                    polygon={polygon}
                    annotation={annotation}
                    onSuccess={() => {
                      // Could refresh annotation rules here if needed
                    }}
                    onRuleSavedToGBIF={onRuleSavedToGBIF}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save to GBIF</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Inline Comment Section */}
      {showCommentSection && (
        <div className="mt-3 p-3 border-t border-gray-200 space-y-3">
          {getPendingCommentCount() > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2">
              <p className="text-xs font-medium text-amber-800 mb-1">
                {getPendingCommentCount()} pending comment(s):
              </p>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {JSON.parse(localStorage.getItem('polygonComments') || '[]')
                  .filter((comment: any) => comment.polygonId === polygon.id && comment.status === 'pending')
                  .map((comment: any, index: number) => (
                    <p key={index} className="text-xs text-amber-700 bg-white px-2 py-1 rounded">
                      "{comment.comment}"{comment.user ? ` - ${comment.user}` : ''}
                    </p>
                  ))}
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Textarea
              id={`comment-${polygon.id}`}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="resize-none text-sm"
              rows={2}
            />
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setShowCommentSection(false);
                setNewComment('');
              }}
              disabled={submittingComment}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim() || submittingComment}
              className="text-xs"
            >
              {submittingComment && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Add
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// Calculate center point of polygon coordinates
function calculatePolygonCenter(coordinates: [number, number][] | [number, number][][], isMultiPolygon: boolean): [number, number] {
  const allCoords = isMultiPolygon 
    ? (coordinates as [number, number][][]).flat()
    : (coordinates as [number, number][]);
  
  if (allCoords.length === 0) return [0, 0];
  
  const sumLat = allCoords.reduce((sum, coord) => sum + coord[0], 0);
  const sumLng = allCoords.reduce((sum, coord) => sum + coord[1], 0);
  
  return [sumLat / allCoords.length, sumLng / allCoords.length];
}

export function SavedPolygons({ 
  polygons, 
  onDelete, 
  editingPolygonId, 
  onToggleInvert, 
  onImportWKT, 
  onUpdateAnnotation,
  currentPolygon = null,
  isCurrentInverted = false,
  onCurrentAnnotationChange,
  currentAnnotation = 'SUSPICIOUS',
  onNavigateToPolygon,
  onRuleSavedToGBIF,
}: SavedPolygonsProps) {
  if (polygons.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-700 text-sm">Active Rules (0)</h3>
          {onImportWKT && <ImportWKTDialog onImport={onImportWKT} />}
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">No active rules yet</p>
          <p className="text-gray-400 text-sm mt-1">Draw a polygon on the map or import WKT</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current Polygon Preview */}
      {currentPolygon && currentPolygon.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-600">Current Polygon</h4>
          <Card className="p-3 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <MiniMapPreview 
                  coordinates={currentPolygon} 
                  isMultiPolygon={false}
                  isInverted={isCurrentInverted}
                  annotation={currentAnnotation || "SUSPICIOUS"}
                  width={100}
                  height={70}
                  className="rounded-md shadow-sm"
                />
                <p className="text-gray-500 text-xs">
                  {currentPolygon.length} pts
                </p>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={isCurrentInverted ? "destructive" : "default"} className="text-xs">
                    {isCurrentInverted ? "Inverted" : "Normal"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {currentAnnotation}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600">
                  Click "Save & Edit" to finalize this polygon
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* Active Rules Section with Green Border */}
      <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-green-800 font-semibold text-sm">Active Rules ({polygons.length})</h3>
          {onImportWKT && <ImportWKTDialog onImport={onImportWKT} />}
        </div>
        <div className="space-y-3">
          {polygons.map((polygon) => (
            <PolygonCard
              key={polygon.id}
              polygon={polygon}
              onDelete={onDelete}
              onToggleInvert={onToggleInvert}
              onUpdateAnnotation={onUpdateAnnotation}
              onNavigateToPolygon={onNavigateToPolygon}
              onRuleSavedToGBIF={onRuleSavedToGBIF}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

