import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
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
  DialogTrigger,
} from './ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { TooltipProvider } from './ui/tooltip';
import { Checkbox } from './ui/checkbox';
import { ArrowLeft, User, MapPin, Eye, ExternalLink, Loader2, Trash2, Folder, Users, Plus, Edit, Check, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { LoginButton } from './LoginButton';
import { UserPageFilters } from './UserPageFilters';
import { SelectedSpecies } from './SpeciesSelector';
import { getAnnotationApiUrl, getGbifApiUrl } from '../utils/apiConfig';
import { getSpeciesInfo } from '../utils/speciesCache';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious,
  PaginationEllipsis
} from './ui/pagination';

interface UserRule {
  id: number;
  createdBy: string;
  created: string;
  geometry: string; // WKT string format
  taxonKey?: number;
  datasetKey?: string;
  annotation: string;
  basisOfRecord?: string;
  yearRange?: string;
  rulesetId?: number;
  projectId?: number;
  supportedBy: any[];
  contestedBy: any[];
  deleted?: string;
  deletedBy?: string;
}

interface SpeciesInfo {
  key: number;
  scientificName: string;
  canonicalName?: string;
  vernacularName?: string;
  rank?: string;
}

interface Project {
  id: number;
  name: string;
  description: string;
  members: string[];
  created: string;
  createdBy: string;
  modified: string | null;
  modifiedBy: string | null;
  deleted: string | null;
  deletedBy: string | null;
}

interface UserPageProps {
  onNavigateToRule?: (rule: UserRule) => void;
}

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

export function UserPage({ onNavigateToRule }: UserPageProps) {
  const { username } = useParams<{ username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rules, setRules] = useState<UserRule[]>([]);
  const [allRules, setAllRules] = useState<UserRule[]>([]); // Store all rules for client-side pagination
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [totalProjects, setTotalProjects] = useState(0);
  
  // Active tab state - check URL query parameter for initial tab
  const initialTab = searchParams.get('tab') || 'rules';
  const [activeTab, setActiveTab] = useState(initialTab === 'projects' ? 'projects' : 'rules');
  
  // Create project dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Delete project dialog state
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit project dialog state
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [isEditingProject, setIsEditingProject] = useState(false);

  // Edit rule dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<UserRule | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Dataset search state for edit dialog
  const [datasetQuery, setDatasetQuery] = useState<string>('');
  const [datasetSuggestions, setDatasetSuggestions] = useState<any[]>([]);
  const [showDatasetSuggestions, setShowDatasetSuggestions] = useState(false);
  
  // Edit dialog form state
  const [editBasisOfRecord, setEditBasisOfRecord] = useState<string[]>([]);
  const [editBasisOfRecordNegated, setEditBasisOfRecordNegated] = useState<boolean>(false);
  const [editSelectedDataset, setEditSelectedDataset] = useState<any>(null);
  
  const basisOfRecordOptions = [
    'HUMAN_OBSERVATION',
    'PRESERVED_SPECIMEN',
    'FOSSIL_SPECIMEN',
    'LIVING_SPECIMEN',
    'MACHINE_OBSERVATION',
    'MATERIAL_SAMPLE',
    'OCCURRENCE'
  ];

  // Selected project for new rules (persistent across sessions)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
    const stored = localStorage.getItem('selectedProjectId');
    return stored ? parseInt(stored, 10) : null;
  });

  // Check if current user is viewing their own profile
  const getCurrentUser = () => {
    try {
      const userStr = localStorage.getItem('gbifUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.userName;
      }
    } catch {
      return null;
    }
    return null;
  };
  
  const isOwnProfile = getCurrentUser() === username;

  // Check if a rule belongs to the current user
  const isOwnRule = (rule: any) => {
    const currentUser = getCurrentUser();
    return currentUser && rule.createdBy === currentUser;
  };

  // Check if current user is an admin
  const isAdmin = () => {
    try {
      const userStr = localStorage.getItem('gbifUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.roles && user.roles.includes('REGISTRY_ADMIN');
      }
    } catch {
      return false;
    }
    return false;
  };

  // Helper function to get back-to-map URL with last species context
  const getBackToMapUrl = () => {
    try {
      const lastSpeciesStr = localStorage.getItem('lastSelectedSpecies');
      if (lastSpeciesStr) {
        const lastSpecies = JSON.parse(lastSpeciesStr);
        return `/?taxonKey=${lastSpecies.key}`;
      }
    } catch (error) {
      console.error('Error loading last species for navigation:', error);
    }
    return '/';
  };
  
  // Species info cache
  const [speciesCache, setSpeciesCache] = useState<Map<number, SpeciesInfo>>(new Map());
  const fetchedTaxonKeys = useRef<Set<number>>(new Set());
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRules, setTotalRules] = useState(0);
  const [pageSize] = useState(20);

  // Filter states
  const [speciesFilter, setSpeciesFilter] = useState<SelectedSpecies | null>(null);
  const [projectFilter, setProjectFilter] = useState<number | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [userFilter, setUserFilter] = useState<string | null>(null);

  // Multi-select states
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkEditDialogOpen, setIsBulkEditDialogOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkEditAnnotation, setBulkEditAnnotation] = useState<string>('');
  const [bulkEditProjectId, setBulkEditProjectId] = useState<string>('');

  // Get current page of rules (no filtering needed - API returns filtered results)
  const filteredRules = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return allRules.slice(startIndex, endIndex);
  }, [allRules, currentPage, pageSize]);

  // Calculate pagination values based on all rules
  const totalPages = Math.ceil(allRules.length / pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [speciesFilter, projectFilter, userFilter]);

  // Helper functions
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getAnnotationColor = (annotation: string) => {
    switch (annotation?.toLowerCase()) {
      case 'suspicious':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'valid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'invalid':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getGeometryDescription = (geometry: string) => {
    if (!geometry) return 'Unknown geometry';
    
    // Parse WKT geometry string to get basic info
    const wkt = geometry.toUpperCase();
    if (wkt.startsWith('POLYGON')) {
      // Count coordinate pairs roughly
      const coordPairs = (geometry.match(/[-\d\.]+\s+[-\d\.]+/g) || []).length;
      return `Polygon (${coordPairs} points)`;
    } else if (wkt.startsWith('MULTIPOLYGON')) {
      const polygonCount = (geometry.match(/\(\(/g) || []).length;
      return `MultiPolygon (${polygonCount} polygons)`;
    }
    
    return 'Geometry';
  };

  // Fetch species info for a rule
  const fetchSpeciesInfo = useCallback(async (taxonKey: number) => {
    // Mark as fetched to prevent duplicate requests
    fetchedTaxonKeys.current.add(taxonKey);
    
    try {
      console.log(`Fetching species info for taxonKey: ${taxonKey}`);
      const data = await getSpeciesInfo(taxonKey);
      console.log(`Received species data for ${taxonKey}:`, data);
      if (data) {
        setSpeciesCache(prev => {
          const newCache = new Map(prev);
          newCache.set(taxonKey, data);
          console.log(`Updated cache, new size: ${newCache.size}`);
          return newCache;
        });
        return data;
      }
    } catch (error) {
      console.error('Error fetching species info:', error);
    }
    return null;
  }, []);

  useEffect(() => {
    const fetchUserRules = async () => {
      if (!username) return;

      try {
        // Use tableLoading for subsequent fetches, loading only for initial
        if (loading) {
          setLoading(true);
        } else {
          setTableLoading(true);
        }
        setError(null);

        // Fetch total count from metrics API
        const metricsResponse = await fetch(
          getAnnotationApiUrl(`/rule/metrics?username=${encodeURIComponent(username)}`)
        );

        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json();
          setTotalRules(metricsData.ruleCount || 0);
        }

        // Build API URL with filters
        let apiUrl = showAllUsers 
          ? getAnnotationApiUrl('/rule')
          : getAnnotationApiUrl(`/rule?createdBy=${encodeURIComponent(username)}`);
        
        // Add taxonKey filter if species is selected
        if (speciesFilter) {
          const separator = apiUrl.includes('?') ? '&' : '?';
          apiUrl += `${separator}taxonKey=${speciesFilter.key}`;
        }

        // Add projectId filter if project is selected
        if (projectFilter !== null) {
          const separator = apiUrl.includes('?') ? '&' : '?';
          apiUrl += `${separator}projectId=${projectFilter}`;
        }

        // Add createdBy filter if user filter is active
        if (userFilter && showAllUsers) {
          const separator = apiUrl.includes('?') ? '&' : '?';
          apiUrl += `${separator}createdBy=${encodeURIComponent(userFilter)}`;
        }

        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch rules: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Store all rules for client-side pagination
          setAllRules(data);
          // If metrics API failed, fallback to counting rules
          if (!metricsResponse.ok) {
            setTotalRules(data.length);
          }
        } else {
          setAllRules([]);
          if (!metricsResponse.ok) {
            setTotalRules(0);
          }
        }
      } catch (err) {
        console.error('Error fetching user rules:', err);
        setError(err instanceof Error ? err.message : 'Failed to load user rules');
        toast.error('Failed to load user rules');
      } finally {
        setLoading(false);
        setTableLoading(false);
      }
    };

    // Fetch data when username, showAllUsers, or filters change
    fetchUserRules();
  }, [username, showAllUsers, speciesFilter, projectFilter, userFilter]);

  // Fetch projects where user is a member
  useEffect(() => {
    const fetchUserProjects = async () => {
      if (!username) return;

      try {
        setProjectsLoading(true);
        setProjectsError(null);

        // Fetch total project count from metrics API
        const metricsResponse = await fetch(
          getAnnotationApiUrl(`/rule/metrics?username=${encodeURIComponent(username)}`)
        );

        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json();
          setTotalProjects(metricsData.projectCount || 0);
        }

        const response = await fetch(getAnnotationApiUrl(`/project?member=${encodeURIComponent(username)}`));

        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Server already filters by member, just sort by id descending
          const userProjects = data.sort((a: Project, b: Project) => b.id - a.id);
          setProjects(userProjects);
          // If metrics API failed, fallback to counting projects
          if (!metricsResponse.ok) {
            setTotalProjects(userProjects.length);
          }
        } else {
          setProjects([]);
          if (!metricsResponse.ok) {
            setTotalProjects(0);
          }
        }
      } catch (err) {
        console.error('Error fetching user projects:', err);
        setProjectsError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchUserProjects();
  }, [username]);

  // Handle create project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    setIsCreating(true);
    
    try {
      const gbifAuth = localStorage.getItem('gbifAuth');
      
      const response = await fetch(getAnnotationApiUrl('/project'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${gbifAuth}`,
        },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status} ${response.statusText}`);
      }

      const newProject = await response.json();
      
      // Add new project to the list
      setProjects(prev => [newProject, ...prev]);
      
      // Reset form and close dialog
      setNewProjectName('');
      setNewProjectDescription('');
      setIsCreateDialogOpen(false);
      
      toast.success('Project created successfully');
    } catch (err) {
      console.error('Error creating project:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle selecting a project for new rules
  const handleSelectProject = (projectId: number | null) => {
    setSelectedProjectId(projectId);
    if (projectId) {
      localStorage.setItem('selectedProjectId', projectId.toString());
      const project = projects.find(p => p.id === projectId);
      if (project) {
        localStorage.setItem('selectedProjectName', project.name);
        toast.success(`Selected project: ${project.name}`);
      }
    } else {
      localStorage.removeItem('selectedProjectId');
      localStorage.removeItem('selectedProjectName');
      toast.info('Project selection cleared');
    }
  };

  // Handle delete project
  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    
    try {
      const gbifAuth = localStorage.getItem('gbifAuth');
      
      const response = await fetch(getAnnotationApiUrl(`/project/${projectToDelete.id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${gbifAuth}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete project: ${response.status} ${response.statusText}`);
      }

      // Remove project from the list
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      
      // Clear selection if deleted project was selected
      if (selectedProjectId === projectToDelete.id) {
        handleSelectProject(null);
      }
      
      // Close dialog
      setProjectToDelete(null);
      
      toast.success('Project deleted successfully');
    } catch (err) {
      console.error('Error deleting project:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditProject = async () => {
    if (!projectToEdit) return;

    if (!editProjectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    setIsEditingProject(true);

    try {
      const gbifAuth = localStorage.getItem('gbifAuth');

      const response = await fetch(getAnnotationApiUrl(`/project/${projectToEdit.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${gbifAuth}`,
        },
        body: JSON.stringify({
          name: editProjectName.trim(),
          description: editProjectDescription.trim(),
          members: projectToEdit.members, // Keep existing members
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication failed. Please login again.');
          return;
        }
        throw new Error(`Failed to update project: ${response.status}`);
      }

      const updatedProject = await response.json();

      // Update project in the list
      setProjects(prev => prev.map(p => p.id === projectToEdit.id ? updatedProject : p));

      // Close dialog and reset form
      setProjectToEdit(null);
      setEditProjectName('');
      setEditProjectDescription('');

      toast.success('Project updated successfully');
    } catch (err) {
      console.error('Error updating project:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setIsEditingProject(false);
    }
  };

  // Handle edit rule button click
  const handleEditRule = (rule: UserRule) => {
    setEditingRule(rule);
    
    // Initialize basis of record state
    setEditBasisOfRecord(Array.isArray(rule.basisOfRecord) ? rule.basisOfRecord : []);
    setEditBasisOfRecordNegated((rule as any).basisOfRecordNegated || false);
    
    // Initialize dataset state
    if (rule.datasetKey) {
      setDatasetQuery(rule.datasetKey);
      setEditSelectedDataset({ key: rule.datasetKey });
    } else {
      setDatasetQuery('');
      setEditSelectedDataset(null);
    }
    
    setDatasetSuggestions([]);
    setShowDatasetSuggestions(false);
    setIsEditDialogOpen(true);
  };

  // Handle update rule
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
      
      // Update the rule in the list
      setAllRules(prev => prev.map(r => r.id === updatedRule.id ? updatedRule : r));
      
      // Close dialog and reset state
      setIsEditDialogOpen(false);
      setEditingRule(null);
      setDatasetQuery('');
      setDatasetSuggestions([]);
      setShowDatasetSuggestions(false);
      setEditBasisOfRecord([]);
      setEditBasisOfRecordNegated(false);
      setEditSelectedDataset(null);
      
      toast.success('Rule updated successfully');
    } catch (err) {
      console.error('Error updating rule:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update rule');
    } finally {
      setIsUpdating(false);
    }
  };

  // Debounce function for dataset search
  const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
    let timeout: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func(...args), wait);
    };
  };

  // Dataset search with debouncing
  const searchDatasetsDebounced = useCallback(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 3) {
        setDatasetSuggestions([]);
        setShowDatasetSuggestions(false);
        return;
      }

      try {
        const response = await fetch(getGbifApiUrl(`/dataset/suggest?q=${encodeURIComponent(query)}&limit=10`));
        if (response.ok) {
          const suggestions = await response.json();
          setDatasetSuggestions(suggestions || []);
          setShowDatasetSuggestions((suggestions || []).length > 0);
        }
      } catch (error) {
        console.warn('Failed to fetch dataset suggestions:', error);
      }
    }, 300),
    []
  );

  // Handle dataset selection in edit dialog
  const handleDatasetSelectForEdit = (dataset: any) => {
    setEditSelectedDataset(dataset);
    setDatasetQuery(dataset.title || dataset.key);
    setShowDatasetSuggestions(false);
  };

  // Original dataset select handler (for compatibility)
  const handleDatasetSelect = (dataset: any) => {
    if (editingRule) {
      setEditingRule({ ...editingRule, datasetKey: dataset.key });
    }
    setDatasetQuery(dataset.title);
    setShowDatasetSuggestions(false);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showDatasetSuggestions) {
        setShowDatasetSuggestions(false);
      }
    };
    
    if (showDatasetSuggestions) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDatasetSuggestions]);

  // Prefetch species info for visible rules
  useEffect(() => {
    console.log('useEffect running - allRules:', allRules.length, 'cache size:', speciesCache.size);
    allRules.forEach(rule => {
      if (rule.taxonKey && !fetchedTaxonKeys.current.has(rule.taxonKey)) {
        console.log(`Requesting species for taxonKey: ${rule.taxonKey}`);
        fetchSpeciesInfo(rule.taxonKey);
      }
    });
  }, [allRules, fetchSpeciesInfo]);

  const handleViewRule = (rule: UserRule) => {
    if (onNavigateToRule) {
      onNavigateToRule(rule);
    } else {
      // Fallback: navigate to main app with rule context
      window.location.href = `/`;
    }
  };

  const handleViewRuleAPI = (ruleId: number) => {
    window.open(getAnnotationApiUrl(`/rule/${ruleId}`), '_blank');
  };

  const handleDeleteRule = async (ruleId: number) => {
    console.log('Attempting to delete rule:', ruleId);
    
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to delete annotation rules');
      return;
    }
    
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

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication failed. Please login again.');
          return;
        } else if (response.status === 403) {
          toast.error('You do not have permission to delete this rule.');
          return;
        }
        throw new Error(`Failed to delete rule: ${response.status} ${response.statusText}`);
      }

      console.log('Rule deleted successfully, updating local state');
      
      // Remove the rule from local state
      setAllRules(prevRules => {
        const newRules = prevRules.filter(rule => rule.id !== ruleId);
        
        // Update total count
        setTotalRules(newRules.length);
        
        // Check if current page will be empty after deletion
        const newTotalPages = Math.ceil(newRules.length / pageSize);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          // Move to the last available page
          setCurrentPage(newTotalPages);
        }
        
        return newRules;
      });
      
      toast.success('Rule deleted successfully');
    } catch (err) {
      console.error('Error deleting rule:', err);
      toast.error('Failed to delete rule');
    }
  };

  const handleBulkDelete = async () => {
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to delete annotation rules');
      return;
    }

    setIsBulkDeleting(true);
    const rulesToDelete = Array.from(selectedRules);
    const results = {
      success: [] as number[],
      failed: [] as number[],
    };

    try {
      // Delete all selected rules
      await Promise.all(
        rulesToDelete.map(async (ruleId) => {
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

            if (response.ok) {
              results.success.push(ruleId);
            } else {
              results.failed.push(ruleId);
            }
          } catch (err) {
            console.error(`Error deleting rule ${ruleId}:`, err);
            results.failed.push(ruleId);
          }
        })
      );

      // Update local state to remove successfully deleted rules
      if (results.success.length > 0) {
        setAllRules(prevRules => {
          const newRules = prevRules.filter(rule => !results.success.includes(rule.id));
          
          // Update total count
          setTotalRules(newRules.length);
          
          // Check if current page will be empty after deletion
          const newTotalPages = Math.ceil(newRules.length / pageSize);
          if (currentPage > newTotalPages && newTotalPages > 0) {
            setCurrentPage(newTotalPages);
          }
          
          return newRules;
        });
      }

      // Clear selection
      setSelectedRules(new Set());

      // Show appropriate toast message
      if (results.failed.length === 0) {
        toast.success(`Successfully deleted ${results.success.length} rule${results.success.length > 1 ? 's' : ''}`);
      } else if (results.success.length === 0) {
        toast.error(`Failed to delete ${results.failed.length} rule${results.failed.length > 1 ? 's' : ''}`);
      } else {
        toast.warning(`Deleted ${results.success.length} rule${results.success.length > 1 ? 's' : ''}, but ${results.failed.length} failed`);
      }
    } catch (err) {
      console.error('Error during bulk delete:', err);
      toast.error('An error occurred during bulk delete');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkEdit = async () => {
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to edit annotation rules');
      return;
    }

    setIsBulkUpdating(true);
    const rulesToEdit = Array.from(selectedRules);
    const results = {
      success: [] as number[],
      failed: [] as number[],
    };

    try {
      // Update all selected rules
      await Promise.all(
        rulesToEdit.map(async (ruleId) => {
          try {
            // Get the current rule data
            const currentRule = allRules.find(r => r.id === ruleId);
            if (!currentRule) {
              results.failed.push(ruleId);
              return;
            }

            const response = await fetch(
              getAnnotationApiUrl(`/rule/${ruleId}`),
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Basic ${gbifAuth}`,
                },
                body: JSON.stringify({
                  id: ruleId,
                  taxonKey: currentRule.taxonKey,
                  geometry: currentRule.geometry,
                  annotation: bulkEditAnnotation || currentRule.annotation,
                  basisOfRecord: Array.isArray(currentRule.basisOfRecord) 
                    ? currentRule.basisOfRecord 
                    : (currentRule.basisOfRecord ? [currentRule.basisOfRecord] : null),
                  basisOfRecordNegated: false,
                  datasetKey: currentRule.datasetKey,
                  yearRange: currentRule.yearRange,
                  rulesetId: currentRule.rulesetId,
                  projectId: bulkEditProjectId 
                    ? (bulkEditProjectId === 'CLEAR' ? null : parseInt(bulkEditProjectId))
                    : currentRule.projectId,
                }),
              }
            );

            if (response.ok) {
              results.success.push(ruleId);
            } else {
              results.failed.push(ruleId);
            }
          } catch (err) {
            console.error(`Error updating rule ${ruleId}:`, err);
            results.failed.push(ruleId);
          }
        })
      );

      // Update local state for successfully updated rules
      if (results.success.length > 0) {
        setAllRules(prevRules =>
          prevRules.map(rule => {
            if (results.success.includes(rule.id)) {
              const updates: any = { ...rule };
              
              // Update annotation if specified
              if (bulkEditAnnotation) {
                updates.annotation = bulkEditAnnotation;
              }
              
              // Update projectId if specified
              if (bulkEditProjectId) {
                updates.projectId = bulkEditProjectId === 'CLEAR' ? null : parseInt(bulkEditProjectId);
              }
              
              return updates;
            }
            return rule;
          })
        );
      }

      // Clear selection and close dialog
      setSelectedRules(new Set());
      setIsBulkEditDialogOpen(false);
      setBulkEditAnnotation('');
      setBulkEditProjectId('');

      // Show appropriate toast message
      if (results.failed.length === 0) {
        toast.success(`Successfully updated ${results.success.length} rule${results.success.length > 1 ? 's' : ''}`);
      } else if (results.success.length === 0) {
        toast.error(`Failed to update ${results.failed.length} rule${results.failed.length > 1 ? 's' : ''}`);
      } else {
        toast.warning(`Updated ${results.success.length} rule${results.success.length > 1 ? 's' : ''}, but ${results.failed.length} failed`);
      }
    } catch (err) {
      console.error('Error during bulk edit:', err);
      toast.error('An error occurred during bulk edit');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Keep filters active when changing pages
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis-start');
      }
      
      // Show current page and surrounding pages
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis-end');
      }
      
      // Always show last page if there are multiple pages
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="p-6 border-b bg-white">
          <div className="flex items-center gap-4">
            <Link to={getBackToMapUrl()}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Map
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Rules</h1>
              <p className="text-gray-600">Loading rules for {username}...</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading rules...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col">
        <div className="p-6 border-b bg-white">
          <div className="flex items-center gap-4">
            <Link to={getBackToMapUrl()}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Map
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Rules</h1>
              <p className="text-gray-600">Error loading rules for {username}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Rules</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <Link to={getBackToMapUrl()}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Map
              </Button>
            </Link>
            <div className="flex-1"></div>
            <LoginButton />
          </div>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          setSearchParams({ tab: value });
        }} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b">
            <TabsList>
              <TabsTrigger value="rules" className="gap-2">
                <MapPin className="w-4 h-4" />
                Rules ({totalRules})
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-2">
                <Folder className="w-4 h-4" />
                Projects ({totalProjects})
              </TabsTrigger>
            </TabsList>
          </div>

        {/* Rules Tab */}
        <TabsContent value="rules" className="flex-1 flex flex-col overflow-hidden m-0">
          {/* Filters */}
          <div className="px-6 py-3 bg-white border-b">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <UserPageFilters
                  speciesFilter={speciesFilter}
                  onSpeciesFilterChange={setSpeciesFilter}
                  projectFilter={projectFilter}
                  onProjectFilterChange={setProjectFilter}
                  userFilter={userFilter}
                  onUserFilterChange={setUserFilter}
                  projects={projects}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllUsers(!showAllUsers)}
                className={`h-8 w-8 p-0 ${showAllUsers ? 'bg-purple-100 hover:bg-purple-200' : ''}`}
                title={showAllUsers ? 'Show only this user\'s rules' : 'Show rules from all users'}
              >
                <User className={`h-4 w-4 ${showAllUsers ? 'text-purple-700' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Rules Content */}
          <div className="flex-1 overflow-auto p-6 relative">
        {tableLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading rules...</p>
            </div>
          </div>
        )}
        {filteredRules.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {rules.length === 0 ? 'No Rules Found' : 'No Matching Rules'}
            </h2>
            <p className="text-gray-600 max-w-md mx-auto">
              {rules.length === 0 
                ? `${username} hasn't created any annotation rules yet. Rules will appear here once they start creating them.`
                : 'No rules match your current filters. Try adjusting or clearing the filters above.'
              }
            </p>
          </div>
        ) : (
          <div className="max-w-full mx-auto">
            {/* Bulk Actions Bar */}
            {selectedRules.size > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-blue-900 font-medium">
                    {selectedRules.size} rule{selectedRules.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRules(new Set())}
                    >
                      Clear Selection
                    </Button>
                    {isOwnProfile && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setIsBulkEditDialogOpen(true)}
                          disabled={isBulkUpdating}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Selected
                        </Button>
                        <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isBulkDeleting}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Selected
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {selectedRules.size} Rule{selectedRules.size !== 1 ? 's' : ''}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {selectedRules.size} selected rule{selectedRules.size !== 1 ? 's' : ''}?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async (e) => {
                              e.preventDefault();
                              await handleBulkDelete();
                            }}
                            disabled={isBulkDeleting}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            {isBulkDeleting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              'Delete Rules'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </>
                  )}
                  </div>
                </div>
              </div>
            )}
            <div className="bg-white rounded-lg border shadow-sm mb-8">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={filteredRules.length > 0 && selectedRules.size === filteredRules.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRules(new Set(filteredRules.map(r => r.id)));
                          } else {
                            setSelectedRules(new Set());
                          }
                        }}
                        disabled={!isOwnProfile && !isAdmin() || showAllUsers}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead className="w-28">TaxonKey</TableHead>
                    <TableHead>Species</TableHead>
                    <TableHead className="w-24">Annotation</TableHead>
                    <TableHead className="w-32">Project</TableHead>
                    <TableHead className="w-32">User</TableHead>
                    <TableHead className="w-32">Created</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => {
                    const speciesInfo = rule.taxonKey ? speciesCache.get(rule.taxonKey) : null;
                    
                    return (
                      <TableRow 
                        key={rule.id}
                        className={selectedRules.has(rule.id) ? 'bg-blue-50' : ''}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedRules.has(rule.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedRules);
                              if (e.target.checked) {
                                newSelected.add(rule.id);
                              } else {
                                newSelected.delete(rule.id);
                              }
                              setSelectedRules(newSelected);
                            }}
                            disabled={!isOwnRule(rule) && !isAdmin()}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        
                        <TableCell>
                          {rule.taxonKey ? (
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                speciesFilter?.key === rule.taxonKey 
                                  ? 'bg-blue-100 text-blue-800 border-blue-200' 
                                  : ''
                              }`}
                            >
                              {rule.taxonKey}
                            </Badge>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {rule.taxonKey ? (
                            <div className="space-y-1">
                              {speciesInfo ? (
                                <>
                                  <div className="italic text-gray-900">{speciesInfo.scientificName}</div>
                                  {speciesInfo.vernacularName && (
                                    <div className="text-sm text-gray-600">{speciesInfo.vernacularName}</div>
                                  )}
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Loading...
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">No species</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={getAnnotationColor(rule.annotation)}
                          >
                            {rule.annotation || 'Unknown'}
                          </Badge>
                          {rule.deleted && (
                            <div className="text-xs text-red-600 mt-1">Deleted</div>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          {rule.projectId ? (
                            <div className="text-sm">
                              {(() => {
                                const project = projects.find(p => p.id === rule.projectId);
                                return project ? (
                                  <Link 
                                    to={`/project/${project.id}`}
                                    className="text-green-600 hover:text-green-700 hover:underline flex items-center gap-1"
                                  >
                                    <Folder className="w-3 h-3" />
                                    {project.name}
                                  </Link>
                                ) : (
                                  <span className="text-gray-500">Project #{rule.projectId}</span>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <Link
                            to={`/user/${rule.createdBy}?tab=rules`}
                            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            {rule.createdBy}
                          </Link>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm text-gray-600">
                            {formatDate(rule.created)}
                          </div>
                          {rule.deleted && (
                            <div className="text-xs text-red-600 mt-1">
                              Deleted: {formatDate(rule.deleted)}
                            </div>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewRule(rule)}
                              title="View on Map"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            {!rule.deleted && (isOwnRule(rule) || isAdmin()) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditRule(rule)}
                                title="Edit this rule"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {!rule.deleted && (isOwnRule(rule) || isAdmin()) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    title="Delete this rule"
                                  >
                                    <Trash2 className="w-4 h-4" />
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
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewRuleAPI(rule.id)}
                              title="View rule details in API"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {getPageNumbers().map((pageNum, index) => (
                      <PaginationItem key={index}>
                        {pageNum === 'ellipsis-start' || pageNum === 'ellipsis-end' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => handlePageChange(pageNum as number)}
                            isActive={pageNum === currentPage}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
          </div>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="flex-1 overflow-auto m-0 px-6 pt-4 pb-6">
          {/* Info text */}
          <p className="text-sm text-gray-500 mb-4">
            Projects help organize annotation rules. Anyone can view rules in a project, but only members can add or delete rules.
          </p>
          
          {/* Create Project Button - only show if viewing own profile */}
          {isOwnProfile && (
            <div className="mb-6 flex justify-end">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-gray-600 hover:text-green-700 hover:border-green-300">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Create a new project to organize and collaborate on annotation rules.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input
                        id="project-name"
                        placeholder="My Project"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="project-description">Description (optional)</Label>
                      <Textarea
                        id="project-description"
                        placeholder="Describe your project..."
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        setNewProjectName('');
                        setNewProjectDescription('');
                      }}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateProject}
                      disabled={isCreating}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Project'
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {projectsLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading projects...</p>
            </div>
          ) : projectsError ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Folder className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Projects</h2>
              <p className="text-gray-600 max-w-md mx-auto">{projectsError}</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Folder className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Projects</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                {username} is not a member of any projects yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                  <div 
                    key={project.id}
                    className={`bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition-all group relative ${
                      selectedProjectId === project.id 
                        ? 'border-2 border-green-500' 
                        : 'border border-gray-200'
                    }`}
                  >
                    {/* Action Buttons - Upper Right Corner */}
                    <div className="absolute top-3 right-3 z-10 flex gap-1">
                      {/* Delete Project Button */}
                      {isOwnProfile && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                setProjectToDelete(project);
                              }}
                              className="h-7 w-7 p-0 rounded-full text-gray-400 bg-gray-50 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete project</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Edit Project Button */}
                      {isOwnProfile && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                setProjectToEdit(project);
                                setEditProjectName(project.name);
                                setEditProjectDescription(project.description);
                              }}
                              className="h-7 w-7 p-0 rounded-full text-gray-400 bg-gray-50 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit project</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {/* Set as Active Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              if (selectedProjectId === project.id) {
                                handleSelectProject(null);
                              } else {
                                handleSelectProject(project.id);
                              }
                            }}
                            className={`h-7 w-7 p-0 rounded-full ${
                              selectedProjectId === project.id 
                                ? 'text-green-700 bg-green-100 hover:bg-green-200' 
                                : 'text-gray-400 bg-gray-50 hover:text-green-700 hover:bg-green-50'
                            }`}
                          >
                            <Check className={`w-4 h-4 ${selectedProjectId === project.id ? '' : 'opacity-30'}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{selectedProjectId === project.id ? 'Deselect as active project' : 'Set as active project'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    <Link 
                      to={`/project/${project.id}`}
                      className="block no-underline"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-colors">
                          <Folder className="w-5 h-5 text-green-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                            {project.name}
                          </h3>
                          {project.description && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {project.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              <span>{project.members.length} member{project.members.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>Created {formatDate(project.created)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                    
                    {/* Active Project Indicator */}
                    {selectedProjectId === project.id && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <div className="flex items-center gap-2 text-xs text-green-700">
                          <Check className="w-3.5 h-3.5" />
                          <span className="font-medium">Active for new rules</span>
                        </div>
                        <p className="text-xs text-green-600 mt-1">
                          All rules you create will be saved to this project
                        </p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </TabsContent>
        </Tabs>
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

              <div className="space-y-2 relative">
                <Label htmlFor="edit-dataset">Dataset (optional)</Label>
                <div className="relative">
                  <Input
                    id="edit-dataset"
                    type="text"
                    value={datasetQuery}
                    onChange={(e) => {
                      setDatasetQuery(e.target.value);
                      searchDatasetsDebounced(e.target.value);
                    }}
                    onFocus={() => {
                      if (datasetSuggestions.length > 0) {
                        setShowDatasetSuggestions(true);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Search for a dataset or leave empty for all datasets"
                    className="text-sm"
                  />
                  {showDatasetSuggestions && (
                    <div 
                      className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {datasetSuggestions.map((dataset) => (
                        <div
                          key={dataset.key}
                          className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          onClick={() => handleDatasetSelectForEdit(dataset)}
                        >
                          <div className="text-sm font-medium text-gray-900 truncate">
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
                  <div className="flex items-center justify-between text-xs text-gray-600 bg-blue-50 p-2 rounded">
                    <span>Selected: <span className="font-medium">{editSelectedDataset.title || editSelectedDataset.key}</span></span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditSelectedDataset(null);
                        setDatasetQuery('');
                      }}
                      className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                    >
                      ×
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-project">Project (optional)</Label>
                <select
                  id="edit-project"
                  className="w-full p-2 border rounded-md"
                  value={editingRule.projectId || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, projectId: e.target.value ? parseInt(e.target.value) : undefined })}
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Select a project to organize this rule. Only projects where you are a member are shown.
                </p>
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

              <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
                <div><strong>Species:</strong> {editingRule.taxonKey ? `${editingRule.taxonKey}` : 'All species'}</div>
                <div><strong>Geometry:</strong> {editingRule.geometry.substring(0, 50)}...</div>
                <div className="text-xs text-gray-500 mt-2">Note: Species and geometry cannot be edited</div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingRule(null);
                setDatasetQuery('');
                setDatasetSuggestions([]);
                setShowDatasetSuggestions(false);
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
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={isBulkEditDialogOpen} onOpenChange={setIsBulkEditDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit {selectedRules.size} Selected Rule{selectedRules.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Update fields for all selected rules. Leave fields empty to keep existing values.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2 overflow-y-auto flex-1">
            <div className="space-y-1">
              <Label htmlFor="bulk-annotation" className="text-sm">Annotation Type</Label>
              <select
                id="bulk-annotation"
                className="w-full p-2 border rounded-md text-sm"
                value={bulkEditAnnotation}
                onChange={(e) => setBulkEditAnnotation(e.target.value)}
              >
                <option value="">Don't change</option>
                <option value="NATIVE">Native</option>
                <option value="INTRODUCED">Introduced</option>
                <option value="MANAGED">Managed</option>
                <option value="FORMER">Former</option>
                <option value="VAGRANT">Vagrant</option>
                <option value="SUSPICIOUS">Suspicious</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bulk-project" className="text-sm">Project</Label>
              <select
                id="bulk-project"
                className="w-full p-2 border rounded-md text-sm"
                value={bulkEditProjectId}
                onChange={(e) => setBulkEditProjectId(e.target.value)}
              >
                <option value="">Don't change</option>
                <option value="CLEAR">Remove from project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 p-2 rounded-md text-xs text-blue-900">
              <strong>Note:</strong> Only changed fields will be updated.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsBulkEditDialogOpen(false);
                setBulkEditAnnotation('');
                setBulkEditProjectId('');
              }}
              disabled={isBulkUpdating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleBulkEdit}
              disabled={isBulkUpdating || (!bulkEditAnnotation && !bulkEditProjectId)}
              className="bg-green-600 hover:bg-green-700"
            >
              {isBulkUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating {selectedRules.size} rule{selectedRules.size !== 1 ? 's' : ''}...
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4 mr-2" />
                  Update {selectedRules.size} Rule{selectedRules.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={!!projectToEdit} onOpenChange={(open) => {
        if (!open) {
          setProjectToEdit(null);
          setEditProjectName('');
          setEditProjectDescription('');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project name and description
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleEditProject();
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Project Name *</Label>
              <Input
                id="edit-project-name"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                placeholder="Enter project name"
                required
                disabled={isEditingProject}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-description">Description</Label>
              <Textarea
                id="edit-project-description"
                value={editProjectDescription}
                onChange={(e) => setEditProjectDescription(e.target.value)}
                placeholder="Enter project description"
                rows={4}
                disabled={isEditingProject}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setProjectToEdit(null);
                  setEditProjectName('');
                  setEditProjectDescription('');
                }}
                disabled={isEditingProject}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isEditingProject}>
                {isEditingProject ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Project'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the project <strong>"{projectToDelete?.name}"</strong>?
              <br /><br />
              <span className="text-red-600 font-semibold">Warning: This action cannot be undone.</span>
              <br />
              All annotation rules associated with this project will also be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteProject();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Project'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}