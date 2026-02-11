import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Trash2, ChevronLeft, ChevronRight, MessageSquare, Loader2, Pencil, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Folder, Plus } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { parseWKTGeometry, MultiPolygon, PolygonWithHoles } from '../utils/wktParser';
import { toast } from 'sonner';
import { SelectedSpecies } from './SpeciesSelector';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { MiniMapPreview } from './MiniMapPreview';
import { getAnnotationApiUrl, getGbifApiUrl } from '../utils/apiConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

// Helper function to generate species page URL
const getSpeciesPageUrl = (taxonKey: number): string => {
  const isDevelopment = import.meta.env.DEV;
  const baseUrl = isDevelopment ? 'http://localhost:3000' : window.location.origin;
  return `${baseUrl}#/?taxonKey=${taxonKey}`;
};

// Searchable multi-select component for Basis of Record
function BasisOfRecordMultiSelect({ 
  options, 
  selected, 
  onChange,
  negated,
  onNegatedChange
}: { 
  options: string[]; 
  selected: string[]; 
  onChange: (selected: string[]) => void;
  negated?: boolean;
  onNegatedChange?: (negated: boolean) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase()) && !selected.includes(option)
  );

  const handleSelectOption = (option: string) => {
    if (!selected.includes(option)) {
      onChange([...selected, option]);
    }
    setSearchTerm('');
    setShowDropdown(false);
    setFocusedIndex(-1);
    inputRef.current?.focus();
  };

  const handleRemoveChip = (option: string) => {
    onChange(selected.filter(item => item !== option));
  };

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
        setFocusedIndex(prev => prev < filteredOptions.length - 1 ? prev + 1 : prev);
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
        <div className="flex items-center space-x-3">
          <div className="flex space-x-2">
            <button type="button" onClick={() => onChange(options)} className="text-xs text-blue-600 hover:text-blue-800 underline">
              Select All
            </button>
            <button type="button" onClick={() => onChange([])} className="text-xs text-gray-600 hover:text-gray-800 underline">
              Clear
            </button>
          </div>
          {onNegatedChange && (
            <div className="flex items-center space-x-1">
              <Checkbox
                id="basis-of-record-negated-inline"
                checked={negated || false}
                disabled={selected.length === 0}
                onCheckedChange={(checked) => onNegatedChange(checked === true)}
                className="h-3 w-3"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label htmlFor="basis-of-record-negated-inline" className={`text-xs font-medium cursor-pointer ${selected.length === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                      Negate
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Apply rule to all records that do NOT have the selected basis of record</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
      <div className="relative" ref={dropdownRef}>
        <div className="min-h-[2.25rem] border border-gray-300 rounded p-2 bg-white flex flex-wrap gap-1 items-center">
          {selected.map((option) => (
            <span key={option} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
              {option.replace(/_/g, ' ')}
              <button type="button" onClick={() => handleRemoveChip(option)} className="hover:bg-blue-200 rounded-sm p-0.5 -mr-1" aria-label={`Remove ${option}`}>
                ×
              </button>
            </span>
          ))}
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
              if (filteredOptions.length > 0) setShowDropdown(true);
            }}
            placeholder={selected.length === 0 ? "Type to search basis of record..." : ""}
            className="flex-1 min-w-[120px] text-xs outline-none bg-transparent"
          />
        </div>
        {showDropdown && filteredOptions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-32 overflow-y-auto">
            {filteredOptions.map((option, index) => (
              <div
                key={option}
                className={`p-2 text-xs cursor-pointer ${index === focusedIndex ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'}`}
                onClick={() => handleSelectOption(option)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                {option.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        )}
        {selected.length === 0 && (
          <div className="text-xs text-gray-500 italic mt-1">
            No selection - will apply to all basis of record types
          </div>
        )}
      </div>
    </div>
  );
}

// Component for fetching and displaying dataset title
const DatasetTitleDisplay = ({ datasetKey }: { datasetKey: string }) => {
  const [title, setTitle] = useState<string>(datasetKey);

  useEffect(() => {
    const fetchDatasetTitle = async () => {
      try {
        const response = await fetch(`https://api.gbif.org/v1/dataset/${datasetKey}`);
        if (response.ok) {
          const dataset = await response.json();
          setTitle(dataset.title || datasetKey);
        }
      } catch (error) {
        console.warn('Failed to fetch dataset title:', error);
      }
    };

    fetchDatasetTitle();
  }, [datasetKey]);

  return <span className="font-semibold text-purple-600">{title}</span>;
};

// Component for clickable species name in annotation rules
const SpeciesLink = ({ 
  scientificName, 
  taxonKey, 
  className = "", 
  style = {} 
}: { 
  scientificName: string; 
  taxonKey?: number; 
  className?: string; 
  style?: React.CSSProperties;
}) => {
  if (taxonKey) {
    return (
      <a 
        href={getSpeciesPageUrl(taxonKey)} 
        className={`${className} hover:underline cursor-pointer`}
        style={style}
        title={`View ${scientificName} species page`}
      >
        {scientificName}
      </a>
    );
  }
  
  return <span className={className} style={style}>{scientificName}</span>;
};

export interface RuleComment {
  id: number;
  comment: string;
  created: string;
  createdBy: string;
}

export interface AnnotationRule {
  id: number;
  taxonKey: number;
  datasetKey: string | null;
  geometry: string; // WKT format (POLYGON or MULTIPOLYGON)
  annotation: string;
  basisOfRecord?: string[] | null;
  basisOfRecordNegated?: boolean | null;
  yearRange?: string | null;
  rulesetId: number | null;
  projectId: number | null;
  supportedBy: any[];
  contestedBy: any[];
  created: string;
  createdBy: string;
  deleted: string | null;
  deletedBy: string | null;
  // Parsed geometry (can be single or multi polygon)
  multiPolygon?: MultiPolygon;
  // Higher order metadata
  taxonomicLevel?: string;
  scientificName?: string;
}

interface AnnotationRulesProps {
  selectedSpecies: SelectedSpecies | null;
  showHigherOrderRules?: boolean;
  onShowHigherOrderChange?: (show: boolean) => void;
  onRulesLoad?: (rules: AnnotationRule[]) => void;
  refreshTrigger?: number; // Add this to force refresh when rules are saved
  filterProjectId?: number | null; // Filter rules by project ID
}

export function AnnotationRules({ 
  selectedSpecies, 
  showHigherOrderRules = false,
  onShowHigherOrderChange,
  onRulesLoad,
  refreshTrigger,
  filterProjectId
}: AnnotationRulesProps) {
  const [rules, setRules] = useState<AnnotationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ userName: string } | null>(null);
  const [comments, setComments] = useState<Map<number, RuleComment[]>>(new Map());
  const [commentCounts, setCommentCounts] = useState<Map<number, number>>(new Map());
  const [loadingComments, setLoadingComments] = useState<Set<number>>(new Set());
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [showInlineCommentForm, setShowInlineCommentForm] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingComments, setDeletingComments] = useState<Set<string>>(new Set());
  
  // Voting state
  const [votingActions, setVotingActions] = useState<Set<string>>(new Set()); // Track ongoing voting actions
  const [userVotes, setUserVotes] = useState<Map<number, 'support' | 'contest' | null>>(new Map()); // Track user's votes per rule
  
  // Description toggle state
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());
  
  // Project names cache
  const [projectNames, setProjectNames] = useState<Map<number, string>>(new Map());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const pageSize = 20;
  
  // Edit rule dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AnnotationRule | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Projects state for edit dialog
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  
  // Edit dialog form state
  const [editBasisOfRecord, setEditBasisOfRecord] = useState<string[]>([]);
  const [editBasisOfRecordNegated, setEditBasisOfRecordNegated] = useState<boolean>(false);
  const [editDatasetQuery, setEditDatasetQuery] = useState<string>('');
  const [editSelectedDataset, setEditSelectedDataset] = useState<any>(null);
  const [datasetSuggestions, setDatasetSuggestions] = useState<any[]>([]);
  const [showDatasetSuggestions, setShowDatasetSuggestions] = useState(false);
  
  const basisOfRecordOptions = [
    'HUMAN_OBSERVATION',
    'PRESERVED_SPECIMEN',
    'FOSSIL_SPECIMEN',
    'LIVING_SPECIMEN',
    'MACHINE_OBSERVATION',
    'MATERIAL_SAMPLE',
    'OCCURRENCE'
  ];
  
  const onRulesLoadRef = useRef(onRulesLoad);

  // Keep ref up to date
  useEffect(() => {
    onRulesLoadRef.current = onRulesLoad;
  }, [onRulesLoad]);

  // Check login status and get current user
  useEffect(() => {
    const checkLoginStatus = () => {
      const gbifAuth = localStorage.getItem('gbifAuth');
      const gbifUser = localStorage.getItem('gbifUser');
      
      setIsLoggedIn(!!gbifAuth);
      
      if (gbifUser) {
        try {
          const user = JSON.parse(gbifUser);
          setCurrentUser(user);
        } catch (error) {
          console.error('Error parsing user data:', error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    };
    
    // Check on mount
    checkLoginStatus();
    
    // Listen for storage changes (when user logs in/out in LoginButton)
    window.addEventListener('storage', checkLoginStatus);
    
    // Also check periodically in case login happens in same tab
    const interval = setInterval(checkLoginStatus, 1000);
    
    return () => {
      window.removeEventListener('storage', checkLoginStatus);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedSpecies) {
      setRules([]);
      setError(null);
      onRulesLoadRef.current?.([]);
      return;
    }

    const fetchRules = async (page: number = 0) => {
      setLoading(true);
      setError(null);
      
      try {
        // Collect taxon keys to fetch based on showHigherOrderRules
        const taxonKeys: { key: number; level: string }[] = [];
        
        // Always include the selected species/taxon
        taxonKeys.push({ key: selectedSpecies.key, level: 'selected' });
        
        // Add higher order taxonomic levels if enabled
        if (showHigherOrderRules) {
          if (selectedSpecies.genusKey && selectedSpecies.genusKey !== selectedSpecies.key) {
            taxonKeys.push({ key: selectedSpecies.genusKey, level: 'genus' });
          }
          if (selectedSpecies.familyKey) {
            taxonKeys.push({ key: selectedSpecies.familyKey, level: 'family' });
          }
          if (selectedSpecies.orderKey) {
            taxonKeys.push({ key: selectedSpecies.orderKey, level: 'order' });
          }
          if (selectedSpecies.classKey) {
            taxonKeys.push({ key: selectedSpecies.classKey, level: 'class' });
          }
          if (selectedSpecies.phylumKey) {
            taxonKeys.push({ key: selectedSpecies.phylumKey, level: 'phylum' });
          }
          if (selectedSpecies.kingdomKey) {
            taxonKeys.push({ key: selectedSpecies.kingdomKey, level: 'kingdom' });
          }
        }
        
        // Create mapping from taxon keys to scientific names
        const taxonKeyToScientificName = new Map<number, string>();
        
        // Fetch scientific names for all taxon keys
        const scientificNamePromises = taxonKeys.map(async ({ key, level }) => {
          if (level === 'selected') {
            taxonKeyToScientificName.set(key, selectedSpecies.scientificName);
            return;
          }
          
          try {
            // Fetch the scientific name from GBIF species API
            const response = await fetch(getGbifApiUrl(`/species/${key}`));
            if (response.ok) {
              const speciesData = await response.json();
              taxonKeyToScientificName.set(key, speciesData.scientificName || speciesData.canonicalName || 'Unknown taxon');
            } else {
              // Fallback for higher taxonomic levels
              const fallbackName = level === 'genus' 
                ? selectedSpecies.scientificName.split(' ')[0] 
                : `${level.charAt(0).toUpperCase() + level.slice(1)} of ${selectedSpecies.scientificName.split(' ')[0]}`;
              taxonKeyToScientificName.set(key, fallbackName);
            }
          } catch (error) {
            console.error(`Error fetching scientific name for taxon ${key}:`, error);
            const fallbackName = level === 'genus' 
              ? selectedSpecies.scientificName.split(' ')[0] 
              : `${level.charAt(0).toUpperCase() + level.slice(1)} of ${selectedSpecies.scientificName.split(' ')[0]}`;
            taxonKeyToScientificName.set(key, fallbackName);
          }
        });
        
        // Wait for all scientific names to be fetched
        await Promise.all(scientificNamePromises);

        // Build the base query parameters
        const buildQueryUrl = (taxonKey: number) => {
          const params = new URLSearchParams();
          params.append('taxonKey', taxonKey.toString());
          if (filterProjectId) {
            params.append('projectId', filterProjectId.toString());
          }
          return `/rule?${params.toString()}`;
        };

        // First, fetch ALL rules for all taxon keys to get the complete dataset
        const allRulesPromises = taxonKeys.map(async ({ key, level }) => {
          const response = await fetch(
            getAnnotationApiUrl(buildQueryUrl(key))
          );
          
          if (!response.ok) {
            return [];
          }
          
          const data: AnnotationRule[] = await response.json();
          
          // Add taxonomic level metadata and scientific name
          return data.map(rule => ({
            ...rule,
            taxonomicLevel: level,
            scientificName: taxonKeyToScientificName.get(rule.taxonKey) || 'Unknown taxon',
          }));
        });
        
        const allRulesArrays = await Promise.all(allRulesPromises);
        const allRules = allRulesArrays.flat();
        
        // Remove duplicates by rule ID
        const uniqueRules = Array.from(
          new Map(allRules.map(rule => [rule.id, rule])).values()
        );
        
        // Apply pagination to the complete unique rules list
        const totalRulesCount = uniqueRules.length;
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedRules = uniqueRules.slice(startIndex, endIndex);
        
        // Parse WKT geometry for each paginated rule
        const rulesWithCoords = paginatedRules.map(rule => {
          const multiPolygon = parseWKTGeometry(rule.geometry);
          
          // DEBUG: Log coordinate information for the first few rules
          if (multiPolygon && multiPolygon.polygons && multiPolygon.polygons.length > 0) {
            const firstPolygon = multiPolygon.polygons[0];
            console.log('DEBUG: Annotation Rule Coordinates', {
              ruleId: rule.id,
              annotation: rule.annotation,
              originalWKT: rule.geometry.substring(0, 100) + '...', // First 100 chars
              polygonCount: multiPolygon.polygons.length,
              firstPolygonVertexCount: firstPolygon.outer.length,
              firstThreeVertices: firstPolygon.outer.slice(0, 3),
              hasHoles: firstPolygon.holes.length > 0
            });
          }
          
          return {
            ...rule,
            multiPolygon: multiPolygon || undefined
          };
        });
        
        setRules(rulesWithCoords);
        setTotalCount(totalRulesCount);
        setHasNextPage((page + 1) * pageSize < totalRulesCount);
        onRulesLoadRef.current?.(rulesWithCoords);
        
        // Initialize user votes based on current user being in supported/contested arrays
        if (currentUser?.userName) {
          const newUserVotes = new Map<number, 'support' | 'contest' | null>();
          rulesWithCoords.forEach(rule => {
            if (rule.supportedBy.includes(currentUser.userName)) {
              newUserVotes.set(rule.id, 'support');
            } else if (rule.contestedBy.includes(currentUser.userName)) {
              newUserVotes.set(rule.id, 'contest');
            } else {
              newUserVotes.set(rule.id, null);
            }
          });
          setUserVotes(newUserVotes);
        }
        
        // Fetch comment counts for all rules
        rulesWithCoords.forEach(rule => {
          fetchCommentCount(rule.id);
        });
        
        // Fetch project names for rules that have projectIds
        const projectIdsToFetch = new Set<number>();
        rulesWithCoords.forEach(rule => {
          if (rule.projectId && !projectNames.has(rule.projectId)) {
            projectIdsToFetch.add(rule.projectId);
          }
        });
        
        if (projectIdsToFetch.size > 0) {
          fetchProjectNames(Array.from(projectIdsToFetch));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setRules([]);
        onRulesLoadRef.current?.([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRules(currentPage);
  }, [selectedSpecies, showHigherOrderRules, refreshTrigger, currentPage, filterProjectId]);

  // Pagination handlers
  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageReset = () => {
    setCurrentPage(0);
  };

  // Reset page when species or filters change
  useEffect(() => {
    handlePageReset();
  }, [selectedSpecies, showHigherOrderRules]);

  const fetchCommentCount = async (ruleId: number) => {
    // Don't fetch if already have count
    if (commentCounts.has(ruleId)) {
      return;
    }

    try {
      const response = await fetch(
        getAnnotationApiUrl(`/rule/${ruleId}/comment`)
      );

      if (!response.ok) {
        return;
      }

      const data: RuleComment[] = await response.json();
      
      setCommentCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data.length);
        return newMap;
      });
      
    } catch (error) {
      console.error('Error fetching comment count:', error);
    }
  };

  const fetchProjectNames = async (projectIds: number[]) => {
    try {
      const projectPromises = projectIds.map(async (projectId) => {
        try {
          const response = await fetch(
            getAnnotationApiUrl(`/project/${projectId}`)
          );
          
          if (!response.ok) {
            return { id: projectId, name: `Project #${projectId}` };
          }
          
          const project = await response.json();
          return { id: projectId, name: project.name || `Project #${projectId}` };
        } catch (error) {
          console.error(`Error fetching project ${projectId}:`, error);
          return { id: projectId, name: `Project #${projectId}` };
        }
      });
      
      const projectData = await Promise.all(projectPromises);
      
      setProjectNames(prev => {
        const newMap = new Map(prev);
        projectData.forEach(({ id, name }) => {
          newMap.set(id, name);
        });
        return newMap;
      });
    } catch (error) {
      console.error('Error fetching project names:', error);
    }
  };

  const fetchComments = async (ruleId: number) => {
    // Don't fetch if already loading or already have comments
    if (loadingComments.has(ruleId) || comments.has(ruleId)) {
      return;
    }

    setLoadingComments(prev => new Set(prev).add(ruleId));

    try {
      const response = await fetch(
        getAnnotationApiUrl(`/rule/${ruleId}/comment`)
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }

      const data: RuleComment[] = await response.json();
      
      setComments(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data);
        return newMap;
      });
      
      setCommentCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data.length);
        return newMap;
      });
    } catch (err) {
      console.error('Error fetching comments:', err);
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    }
  };

  const forceRefreshComments = async (ruleId: number) => {
    // Force refresh comments even if already cached
    setLoadingComments(prev => new Set(prev).add(ruleId));

    try {
      const response = await fetch(
        getAnnotationApiUrl(`/rule/${ruleId}/comment`)
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }

      const data: RuleComment[] = await response.json();
      
      setComments(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data);
        return newMap;
      });
      
      setCommentCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data.length);
        return newMap;
      });
    } catch (err) {
      console.error('Error refreshing comments:', err);
      toast.error('Failed to refresh comments');
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    }
  };

  const toggleComments = (ruleId: number) => {
    const isOpen = openComments.has(ruleId);
    
    if (!isOpen) {
      // Opening - fetch comments if not already loaded
      fetchComments(ruleId);
      setOpenComments(prev => new Set(prev).add(ruleId));
    } else {
      // Closing
      setOpenComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    }
  };

  const handleAddComment = async (ruleId: number) => {
    if (!newComment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    // Check if user is logged in
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to add comments');
      return;
    }

    try {
      setSubmittingComment(true);

      const response = await fetch(
        getAnnotationApiUrl(`/rule/${ruleId}/comment`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${gbifAuth}`,
          },
          body: JSON.stringify({ comment: newComment.trim() }),
        }
      );

      if (!response.ok) {
        let errorMessage = `Failed to add comment (${response.status})`;
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (response.status === 403) {
          errorMessage = 'Permission denied. You may not have access to comment on this rule.';
        } else if (response.status === 404) {
          errorMessage = 'Rule not found.';
        }
        throw new Error(errorMessage);
      }

      toast.success('Comment added successfully');
      
      // Clear the comment input and close inline form
      setNewComment('');
      setShowInlineCommentForm(null);
      
      // Add a small delay to allow server to process the new comment
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force refresh comments to get the latest data
      await forceRefreshComments(ruleId);
    } catch (err) {
      console.error('Error adding comment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add comment';
      toast.error(errorMessage);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (ruleId: number, commentId: number) => {
    // Check if user is logged in
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to delete comments');
      return;
    }

    const commentKey = `${ruleId}-${commentId}`;
    
    try {
      setDeletingComments(prev => new Set(prev).add(commentKey));

      const response = await fetch(
        getAnnotationApiUrl(`/rule/${ruleId}/comment/${commentId}`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${gbifAuth}`,
          },
        }
      );

      if (!response.ok) {
        let errorMessage = `Failed to delete comment (${response.status})`;
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (response.status === 403) {
          errorMessage = 'Permission denied. You can only delete your own comments.';
        } else if (response.status === 404) {
          errorMessage = 'Comment not found.';
        }
        throw new Error(errorMessage);
      }

      toast.success('Comment deleted successfully');
      
      // Add a small delay to allow server to process the deletion
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force refresh comments to get the latest data
      await forceRefreshComments(ruleId);
    } catch (err) {
      console.error('Error deleting comment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete comment';
      toast.error(errorMessage);
    } finally {
      setDeletingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentKey);
        return newSet;
      });
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    // Check if user is logged in
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to delete annotation rules');
      return;
    }

    setDeletingRuleId(ruleId);

    try {
      const response = await fetch(
        getAnnotationApiUrl(`/rule/${ruleId}`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${gbifAuth}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please check your GBIF credentials');
        } else if (response.status === 403) {
          throw new Error('Forbidden - you may not have permission to delete this rule');
        } else if (response.status === 404) {
          throw new Error('Rule not found');
        } else {
          throw new Error(`Failed to delete rule (${response.status})`);
        }
      }

      // Remove the deleted rule from state
      setRules(prevRules => {
        const updatedRules = prevRules.filter(r => r.id !== ruleId);
        onRulesLoadRef.current?.(updatedRules);
        return updatedRules;
      });

      // Update total count
      setTotalCount(prevCount => prevCount - 1);

      toast.success('Annotation rule deleted successfully');
    } catch (err) {
      console.error('Error deleting rule:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete annotation rule');
    } finally {
      setDeletingRuleId(null);
    }
  };

  // Helper to get Basic Auth header from GBIF login
  function getBasicAuthHeader() {
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) return null;
    return 'Basic ' + gbifAuth;
  }

  // Search datasets for edit dialog
  const searchDatasetsForEdit = async (query: string) => {
    if (query.length < 3) {
      setDatasetSuggestions([]);
      setShowDatasetSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        getGbifApiUrl(`/dataset/suggest?q=${encodeURIComponent(query)}&limit=10`)
      );
      
      if (response.ok) {
        const data = await response.json();
        setDatasetSuggestions(data || []);
        setShowDatasetSuggestions(true);
      }
    } catch (error) {
      console.error('Error searching datasets:', error);
    }
  };

  const handleDatasetSelectForEdit = (dataset: any) => {
    setEditSelectedDataset(dataset);
    setEditDatasetQuery(dataset.title);
    setShowDatasetSuggestions(false);
  };

  // Fetch projects for the edit dialog
  const fetchProjects = async () => {
    if (!isLoggedIn || !currentUser) return;
    
    setLoadingProjects(true);
    try {
      const response = await fetch(
        getAnnotationApiUrl(`/project?createdBy=${currentUser.userName}`),
        {
          headers: {
            'Authorization': getBasicAuthHeader() || '',
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setProjects(data || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Edit rule handlers
  const handleEditRule = (rule: AnnotationRule) => {
    setEditingRule(rule);
    
    // Initialize basis of record state
    setEditBasisOfRecord(rule.basisOfRecord || []);
    setEditBasisOfRecordNegated(rule.basisOfRecordNegated || false);
    
    // Initialize dataset state
    if (rule.datasetKey) {
      setEditDatasetQuery(rule.datasetKey);
      setEditSelectedDataset({ key: rule.datasetKey });
    } else {
      setEditDatasetQuery('');
      setEditSelectedDataset(null);
    }
    
    setIsEditDialogOpen(true);
    
    // Fetch projects when opening edit dialog
    fetchProjects();
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;

    setIsUpdating(true);
    
    try {
      const gbifAuth = localStorage.getItem('gbifAuth');
      
      const response = await fetch(getAnnotationApiUrl(`/rule/${editingRule.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${gbifAuth}`,
        },
        body: JSON.stringify({
          id: editingRule.id,
          taxonKey: editingRule.taxonKey,
          datasetKey: editSelectedDataset ? editSelectedDataset.key : null,
          geometry: editingRule.geometry,
          annotation: editingRule.annotation,
          basisOfRecord: editBasisOfRecord.length > 0 ? editBasisOfRecord : null,
          basisOfRecordNegated: editBasisOfRecordNegated,
          yearRange: editingRule.yearRange,
          rulesetId: editingRule.rulesetId,
          projectId: editingRule.projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update rule: ${response.status} ${response.statusText}`);
      }

      const updatedRule = await response.json();
      
      // Parse geometry for the updated rule
      const parsedGeometry = parseWKTGeometry(updatedRule.geometry);
      const ruleWithGeometry = {
        ...updatedRule,
        multiPolygon: parsedGeometry,
      };
      
      // Update the rule in the list
      setRules(prev => {
        const updated = prev.map(r => r.id === ruleWithGeometry.id ? ruleWithGeometry : r);
        onRulesLoadRef.current?.(updated);
        return updated;
      });
      
      // Close dialog and reset state
      setIsEditDialogOpen(false);
      setEditingRule(null);
      
      toast.success('Rule updated successfully');
    } catch (err) {
      console.error('Error updating rule:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update rule');
    } finally {
      setIsUpdating(false);
    }
  };

  // Voting handlers
  const handleVote = async (ruleId: number, action: 'support' | 'contest') => {
    if (!isLoggedIn) {
      toast.error('You must be logged in to vote on rules');
      return;
    }

    const actionKey = `${action}-${ruleId}`;
    setVotingActions(prev => new Set([...prev, actionKey]));

    try {
      const authHeader = getBasicAuthHeader();
      if (!authHeader) {
        throw new Error('No authentication found (username/password missing)');
      }

      console.log('Attempting to vote:', { ruleId, action, authHeader });

      const endpoint = action === 'support' 
        ? getAnnotationApiUrl(`/rule/${ruleId}/support`)
        : getAnnotationApiUrl(`/rule/${ruleId}/contest`);

      console.log('API Endpoint:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      console.log('API Response:', { status: response.status, statusText: response.statusText });

      if (response.ok) {
        // Update user vote state
        setUserVotes(prev => new Map(prev.set(ruleId, action)));
        
        // Update rule counts in the rules array
        setRules(prevRules => {
          const updatedRules = prevRules.map(rule => {
            if (rule.id === ruleId) {
              const updatedRule = { ...rule };
              if (action === 'support') {
                updatedRule.supportedBy = [...rule.supportedBy, currentUser?.userName || 'anonymous'];
              } else {
                updatedRule.contestedBy = [...rule.contestedBy, currentUser?.userName || 'anonymous'];
              }
              return updatedRule;
            }
            return rule;
          });
          onRulesLoadRef.current?.(updatedRules);
          return updatedRules;
        });

        toast.success(`Rule ${action === 'support' ? 'supported' : 'contested'} successfully`);
      } else {
        // Get more detailed error information
        let errorMessage = `Failed to ${action} rule (${response.status})`;
        try {
          const errorData = await response.text();
          console.error('API Error Response:', errorData);
          if (errorData) {
            errorMessage += `: ${errorData}`;
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error(`Error ${action}ing rule:`, err);
      toast.error(err instanceof Error ? err.message : `Failed to ${action} rule`);
    } finally {
      setVotingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  };

  const handleRemoveVote = async (ruleId: number, action: 'support' | 'contest') => {
    if (!isLoggedIn) {
      toast.error('You must be logged in to remove votes');
      return;
    }

    const actionKey = `remove-${action}-${ruleId}`;
    setVotingActions(prev => new Set([...prev, actionKey]));

    try {
      const authHeader = getBasicAuthHeader();
      if (!authHeader) {
        throw new Error('No authentication found (username/password missing)');
      }

      const endpoint = action === 'support' 
        ? getAnnotationApiUrl(`/rule/${ruleId}/removeSupport`)
        : getAnnotationApiUrl(`/rule/${ruleId}/removeContest`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update user vote state
        setUserVotes(prev => new Map(prev.set(ruleId, null)));
        
        // Update rule counts in the rules array
        setRules(prevRules => {
          const updatedRules = prevRules.map(rule => {
            if (rule.id === ruleId) {
              const updatedRule = { ...rule };
              const currentUserName = currentUser?.userName || 'anonymous';
              if (action === 'support') {
                updatedRule.supportedBy = rule.supportedBy.filter(user => user !== currentUserName);
              } else {
                updatedRule.contestedBy = rule.contestedBy.filter(user => user !== currentUserName);
              }
              return updatedRule;
            }
            return rule;
          });
          onRulesLoadRef.current?.(updatedRules);
          return updatedRules;
        });

        toast.success(`${action === 'support' ? 'Support' : 'Contest'} removed successfully`);
      } else {
        // Get more detailed error information
        let errorMessage = `Failed to remove ${action} (${response.status})`;
        try {
          const errorData = await response.text();
          console.error('API Error Response:', errorData);
          if (errorData) {
            errorMessage += `: ${errorData}`;
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error(`Error removing ${action}:`, err);
      toast.error(err instanceof Error ? err.message : `Failed to remove ${action}`);
    } finally {
      setVotingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  };

  const getAnnotationColor = (annotation: string) => {
    switch (annotation.toUpperCase()) {
      case 'SUSPICIOUS':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'NATIVE':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'MANAGED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'FORMER':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'VAGRANT':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const renderPolygonPreview = (multiPolygon: MultiPolygon | undefined, annotation: string) => {
    if (!multiPolygon || multiPolygon.polygons.length === 0) return null;

    // Helper function to detect if a polygon is inverted by checking if outer ring covers the world
    const isInvertedPolygon = (polygon: PolygonWithHoles): boolean => {
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

    // Convert MultiPolygon format to coordinates format expected by MiniMapPreview
    let coordinates: [number, number][] | [number, number][][];
    let isMultiPolygon = false;
    let isInverted = false;

    if (multiPolygon.polygons.length === 1) {
      const polygon = multiPolygon.polygons[0];
      const isOriginallyInverted = isInvertedPolygon(polygon);
      
      if (isOriginallyInverted && polygon.holes && polygon.holes.length > 0) {
        // For inverted polygons, pass the holes as coordinates and mark as inverted
        // This will show red overlay everywhere EXCEPT the hole areas
        if (polygon.holes.length === 1) {
          // Single hole - treat as single polygon
          coordinates = polygon.holes[0];
          isMultiPolygon = false;
        } else {
          // Multiple holes - treat as multipolygon
          coordinates = polygon.holes;
          isMultiPolygon = true;
        }
        isInverted = true; // Mark as inverted so MiniMapPreview shows proper inversion
      } else {
        // Normal polygon - use outer ring
        coordinates = polygon.outer;
        isMultiPolygon = false;
        isInverted = false;
      }
    } else {
      // Multiple polygons - convert to array of coordinate arrays
      coordinates = multiPolygon.polygons.map(poly => poly.outer);
      isMultiPolygon = true;
      // For simplicity, don't handle inversion for multipolygons in preview
      isInverted = false;
    }

    const previewElement = (
      <MiniMapPreview
        coordinates={coordinates}
        isMultiPolygon={isMultiPolygon}
        isInverted={isInverted}
        annotation={annotation}
        width={80}
        height={60}
        className="rounded-md shadow-sm"
      />
    );

    return previewElement;
  };

  if (!selectedSpecies) {
    return (
      <div className="text-gray-500 text-center py-4">
        Select a species to view previous rules
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-gray-500 text-center py-4">
        Loading annotation rules...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center py-4">
        Error: {error}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-gray-500 text-center py-4">
          No annotation rules found{showHigherOrderRules ? ' at any taxonomic level' : ' for this taxon'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {totalCount > pageSize && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 0 || loading}
                className="h-6 w-6 p-0"
                title="Previous page"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNextPage || loading}
                className="h-6 w-6 p-0"
                title="Next page"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </>
          )}
          <span>
            {totalCount > pageSize 
              ? `${Math.min((currentPage + 1) * pageSize, totalCount)} of ${totalCount}`
              : totalCount
            }
          </span>
        </div>
      </div>
      
      <div className="space-y-2">
        {rules.map((rule) => {
          return (
            <Card key={rule.id} className="p-3">
              <div className="flex gap-3">
                {/* Polygon preview */}
                {rule.multiPolygon && (
                  <div className="flex-shrink-0">
                    {renderPolygonPreview(rule.multiPolygon, rule.annotation)}
                  </div>
                )}
                
                {/* Rule details */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getAnnotationColor(rule.annotation)} variant="outline">
                      {rule.annotation}
                    </Badge>
                    {rule.projectId && (
                      <Link
                        to={`/project/${rule.projectId}`}
                        className="inline-block"
                        title={projectNames.get(rule.projectId) || `Project #${rule.projectId}`}
                      >
                        <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200 flex items-center gap-1 max-w-[150px] hover:bg-green-100 cursor-pointer transition-colors">
                          <Folder className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">
                            {projectNames.get(rule.projectId) || `Project #${rule.projectId}`}
                          </span>
                        </Badge>
                      </Link>
                    )}
                    {rule.taxonomicLevel && rule.taxonomicLevel !== 'selected' && (
                      <Badge variant="secondary" className="text-xs">
                        {rule.taxonomicLevel}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Rule description */}
                  {rule.scientificName && (
                    <div className="col-span-2 mb-2">
                      <div className="flex flex-col">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-fit px-2 self-start flex items-center gap-1"
                          onClick={() => {
                            const newExpanded = new Set(expandedDescriptions);
                            if (newExpanded.has(rule.id)) {
                              newExpanded.delete(rule.id);
                            } else {
                              newExpanded.add(rule.id);
                            }
                            setExpandedDescriptions(newExpanded);
                          }}
                          title={expandedDescriptions.has(rule.id) ? "Hide description" : "Show description"}
                        >
                          {expandedDescriptions.has(rule.id) ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              <span className="text-xs text-gray-500">Hide description</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              <span className="text-xs text-gray-500">Show description</span>
                            </>
                          )}
                        </Button>
                        {expandedDescriptions.has(rule.id) && (
                          <p className="text-sm mt-2">
                            <span className="text-gray-500">This rule designates all</span> <span className="font-semibold">future</span> <span className="text-gray-500">and</span> <span className="font-semibold">past</span> <span className="text-gray-500">occurrence records of</span> <SpeciesLink scientificName={rule.scientificName} taxonKey={rule.taxonKey} className="font-semibold" style={{color: '#4C9C2E'}} />
                            {rule.basisOfRecord && rule.basisOfRecord.length > 0 && (
                              rule.basisOfRecordNegated ? (
                                <><span className="text-gray-500"> with basis of record</span> <span className="font-semibold text-blue-600">NOT {rule.basisOfRecord.map(b => b.replace(/_/g, ' ')).join(', ')}</span></>
                              ) : (
                                <><span className="text-gray-500"> with basis of record</span> <span className="font-semibold text-blue-600">{rule.basisOfRecord.map(b => b.replace(/_/g, ' ')).join(', ')}</span></>
                              )
                            )}
                            {rule.datasetKey && (
                              <><span className="text-gray-500"> from dataset</span> <DatasetTitleDisplay datasetKey={rule.datasetKey} /></>
                            )}
                            {rule.yearRange && (
                              <><span className="text-gray-500"> from years</span> <span className="font-semibold">{rule.yearRange}</span></>
                            )}
                            <span className="text-gray-500"> within the</span> <span className="font-semibold">polygon area</span> <span className="text-gray-500">as</span> <span className={`font-semibold ${
                              rule.annotation === 'SUSPICIOUS' ? 'text-red-600' :
                              rule.annotation === 'NATIVE' ? 'text-green-600' :
                              rule.annotation === 'MANAGED' ? 'text-blue-600' :
                              rule.annotation === 'FORMER' ? 'text-purple-600' :
                              rule.annotation === 'VAGRANT' ? 'text-orange-600' :
                              'text-red-600'
                            }`}>{rule.annotation.toLowerCase()}</span><span className="text-gray-500">.</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <div className="text-xs text-gray-400 mb-0.5">Created by</div>
                      <div className="text-gray-900 truncate">{rule.createdBy}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-gray-400 mb-0.5">Date</div>
                      <div className="text-gray-900">
                        {new Date(rule.created).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comments and voting buttons */}
              <div className="mt-2 pt-2 border-t flex gap-1.5 items-center">
                {/* Voting buttons */}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={userVotes.get(rule.id) === 'support' ? 'default' : 'outline'}
                    disabled={!isLoggedIn || votingActions.has(`support-${rule.id}`) || votingActions.has(`remove-support-${rule.id}`)}
                    className="h-7 px-2 text-xs"
                    title={!isLoggedIn ? "Login to GBIF to vote" : userVotes.get(rule.id) === 'support' ? "Remove support" : "Support this rule"}
                    onClick={() => {
                      if (userVotes.get(rule.id) === 'support') {
                        handleRemoveVote(rule.id, 'support');
                      } else {
                        handleVote(rule.id, 'support');
                      }
                    }}
                  >
                    {votingActions.has(`support-${rule.id}`) || votingActions.has(`remove-support-${rule.id}`) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className="w-3.5 h-3.5" />
                    )}
                    {rule.supportedBy.length > 0 && (
                      <span className="ml-1">{rule.supportedBy.length}</span>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant={userVotes.get(rule.id) === 'contest' ? 'default' : 'outline'}
                    disabled={!isLoggedIn || votingActions.has(`contest-${rule.id}`) || votingActions.has(`remove-contest-${rule.id}`)}
                    className="h-7 px-2 text-xs"
                    title={!isLoggedIn ? "Login to GBIF to vote" : userVotes.get(rule.id) === 'contest' ? "Remove contest" : "Contest this rule"}
                    onClick={() => {
                      if (userVotes.get(rule.id) === 'contest') {
                        handleRemoveVote(rule.id, 'contest');
                      } else {
                        handleVote(rule.id, 'contest');
                      }
                    }}
                  >
                    {votingActions.has(`contest-${rule.id}`) || votingActions.has(`remove-contest-${rule.id}`) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ThumbsDown className="w-3.5 h-3.5" />
                    )}
                    {rule.contestedBy.length > 0 && (
                      <span className="ml-1">{rule.contestedBy.length}</span>
                    )}
                  </Button>
                </div>

                {/* Separator */}
                <div className="w-px h-6 bg-gray-300" />

                {/* Comment buttons */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleComments(rule.id)}
                  className="relative h-7 w-7 p-0"
                  title={commentCounts.has(rule.id) && commentCounts.get(rule.id)! > 0 
                    ? `View ${commentCounts.get(rule.id)} comment${commentCounts.get(rule.id)! > 1 ? 's' : ''}`
                    : 'View comments'
                  }
                >
                  {loadingComments.has(rule.id) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <MessageSquare className="w-3.5 h-3.5" />
                      {commentCounts.has(rule.id) && commentCounts.get(rule.id)! > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-xs flex items-center justify-center"
                        >
                          {commentCounts.get(rule.id)}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>

                {/* Separator */}
                <div className="w-px h-6 bg-gray-300" />

                {/* Edit button - only show for own rules or if user is logged in */}
                {isLoggedIn && currentUser && rule.createdBy === currentUser.userName && !rule.deleted && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditRule(rule)}
                    className="h-7 w-7 p-0"
                    title="Edit this rule"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}

                {/* Delete button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!isLoggedIn || deletingRuleId === rule.id}
                      className="h-7 w-7 p-0 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 disabled:opacity-50"
                      title={!isLoggedIn ? "Login to GBIF to delete rules" : "Delete rule"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Annotation Rule</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this annotation rule (ID: {rule.id})?
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteRule(rule.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Comments section */}
              {openComments.has(rule.id) && (
                <div className="mt-2">
                  {/* Inline comment form */}
                  {showInlineCommentForm === rule.id && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Label htmlFor={`comment-${rule.id}`} className="text-sm font-medium text-gray-700 mb-2 block">
                        Add Comment to Rule #{rule.id}
                      </Label>
                      <Textarea
                        id={`comment-${rule.id}`}
                        placeholder="Enter your comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={3}
                        className="mb-2"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAddComment(rule.id)}
                          disabled={submittingComment || !newComment.trim()}
                        >
                          {submittingComment ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            'Add Comment'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowInlineCommentForm(null);
                            setNewComment('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {loadingComments.has(rule.id) ? (
                    <div className="text-center py-2 text-gray-500 text-sm">
                      Loading comments...
                    </div>
                  ) : comments.has(rule.id) && comments.get(rule.id)!.length > 0 ? (
                    <div className="space-y-2">
                      {comments.get(rule.id)!.map((comment) => {
                        const commentKey = `${rule.id}-${comment.id}`;
                        const isCurrentUserComment = currentUser && comment.createdBy === currentUser.userName;
                        const isDeletingThisComment = deletingComments.has(commentKey);
                        
                        return (
                          <div key={comment.id} className="bg-gray-50 rounded p-3 text-sm">
                            <p className="text-gray-800">{comment.comment}</p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>{comment.createdBy}</span>
                                <span>•</span>
                                <span>{new Date(comment.created).toLocaleDateString()}</span>
                              </div>
                              {isCurrentUserComment && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteComment(rule.id, comment.id)}
                                  disabled={isDeletingThisComment}
                                  title="Delete comment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Add comment button under comments */}
                      <div className="flex justify-center pt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!isLoggedIn}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          title={!isLoggedIn ? "Login to GBIF to add comments" : "Add comment"}
                          onClick={() => {
                            if (showInlineCommentForm === rule.id) {
                              setShowInlineCommentForm(null);
                              setNewComment('');
                            } else {
                              setShowInlineCommentForm(rule.id);
                            }
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-center py-2 text-gray-500 text-sm">
                        No comments yet
                      </div>
                      
                      {/* Add comment button when no comments */}
                      <div className="flex justify-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!isLoggedIn}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          title={!isLoggedIn ? "Login to GBIF to add comments" : "Add comment"}
                          onClick={() => {
                            if (showInlineCommentForm === rule.id) {
                              setShowInlineCommentForm(null);
                              setNewComment('');
                            } else {
                              setShowInlineCommentForm(rule.id);
                            }
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Edit Rule Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Rule #{editingRule?.id}</DialogTitle>
            <DialogDescription>
              Update the annotation rule details. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          
          {editingRule && (
            <div className="space-y-4 py-4 overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="edit-annotation">Annotation Type</Label>
                <select
                  id="edit-annotation"
                  className="w-full p-2 border rounded-md"
                  value={editingRule.annotation}
                  onChange={(e) => setEditingRule({ ...editingRule, annotation: e.target.value })}
                >
                  <option value="NATIVE">Native</option>
                  <option value="INTRODUCED">Introduced</option>
                  <option value="MANAGED">Managed</option>
                  <option value="FORMER">Former</option>
                  <option value="VAGRANT">Vagrant</option>
                  <option value="SUSPICIOUS">Suspicious</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Basis of Record - Multi-select */}
              <BasisOfRecordMultiSelect
                options={basisOfRecordOptions}
                selected={editBasisOfRecord}
                onChange={setEditBasisOfRecord}
                negated={editBasisOfRecordNegated}
                onNegatedChange={setEditBasisOfRecordNegated}
              />

              {/* Dataset Key */}
              <div className="space-y-1 relative">
                <Label htmlFor="edit-dataset-key" className="text-xs text-gray-700">Dataset (optional)</Label>
                <div className="relative">
                  <Input
                    id="edit-dataset-key"
                    type="text"
                    value={editDatasetQuery}
                    onChange={(e) => {
                      setEditDatasetQuery(e.target.value);
                      searchDatasetsForEdit(e.target.value);
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
                          onClick={() => handleDatasetSelectForEdit(dataset)}
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
                {editSelectedDataset && (
                  <div className="text-xs text-gray-600 flex items-center justify-between">
                    <span>Selected: <span className="font-medium">{editSelectedDataset.title || editSelectedDataset.key}</span></span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditSelectedDataset(null);
                        setEditDatasetQuery('');
                      }}
                      className="text-xs text-red-600 hover:text-red-800 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-year-range">Year Range (optional)</Label>
                <Input
                  id="edit-year-range"
                  placeholder="e.g., 1900,2023 or *,1990 or 2000,*"
                  value={editingRule.yearRange || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, yearRange: e.target.value || undefined })}
                />
                <p className="text-xs text-gray-500">
                  Format: startYear,endYear. Use * for no limit (e.g., *,2020 for before 2020)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-project">Project (optional)</Label>
                <select
                  id="edit-project"
                  className="w-full p-2 border rounded-md"
                  value={editingRule.projectId || ''}
                  onChange={(e) => setEditingRule({ 
                    ...editingRule, 
                    projectId: e.target.value ? parseInt(e.target.value) : null 
                  })}
                  disabled={loadingProjects}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {loadingProjects && (
                  <p className="text-xs text-gray-500">Loading projects...</p>
                )}
              </div>

              <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
                <p className="font-medium text-gray-700">Current Rule Info</p>
                <p className="text-gray-600">Taxon Key: {editingRule.taxonKey}</p>
                {editingRule.datasetKey && (
                  <p className="text-gray-600">Dataset: {editingRule.datasetKey}</p>
                )}
                {editingRule.scientificName && (
                  <p className="text-gray-600 italic">Species: {editingRule.scientificName}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingRule(null);
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRule}
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Rule'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

