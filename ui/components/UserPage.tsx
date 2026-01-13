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
import { ArrowLeft, User, MapPin, Eye, ExternalLink, Loader2, Trash2, Folder, Users, Plus, Edit, Check } from 'lucide-react';
import { toast } from 'sonner';
import { UserPageFilters } from './UserPageFilters';
import { SelectedSpecies } from './SpeciesSelector';
import { getAnnotationApiUrl } from '../utils/apiConfig';
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

export function UserPage({ onNavigateToRule }: UserPageProps) {
  const { username } = useParams<{ username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rules, setRules] = useState<UserRule[]>([]);
  const [allRules, setAllRules] = useState<UserRule[]>([]); // Store all rules for client-side pagination
  const [loading, setLoading] = useState(true);
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

  // Edit rule dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<UserRule | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Dataset search state for edit dialog
  const [datasetQuery, setDatasetQuery] = useState<string>('');
  const [datasetSuggestions, setDatasetSuggestions] = useState<any[]>([]);
  const [showDatasetSuggestions, setShowDatasetSuggestions] = useState(false);

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

  // Apply filters to all rules first
  const filteredAllRules = useMemo(() => {
    let filtered = allRules;

    if (speciesFilter) {
      filtered = filtered.filter(rule => 
        rule.taxonKey === speciesFilter.key
      );
    }

    if (projectFilter !== null) {
      filtered = filtered.filter(rule => 
        rule.projectId === projectFilter
      );
    }

    return filtered;
  }, [allRules, speciesFilter, projectFilter]);

  // Calculate pagination values based on filtered results
  const totalPages = Math.ceil(filteredAllRules.length / pageSize);

  // Get current page of filtered rules
  const filteredRules = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAllRules.slice(startIndex, endIndex);
  }, [filteredAllRules, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [speciesFilter, projectFilter]);

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
        setLoading(true);
        setError(null);

        // Fetch total count from metrics API
        const metricsResponse = await fetch(
          getAnnotationApiUrl(`/rule/metrics?username=${encodeURIComponent(username)}`)
        );

        if (metricsResponse.ok) {
          const metricsData = await metricsResponse.json();
          setTotalRules(metricsData.ruleCount || 0);
        }

        // Fetch all rules (API currently returns all rules as array)
        const response = await fetch(
          getAnnotationApiUrl(`/rule?createdBy=${encodeURIComponent(username)}`)
        );

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
      }
    };

    // Only fetch data when username changes
    fetchUserRules();
  }, [username]);

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

  // Handle edit rule button click
  const handleEditRule = (rule: UserRule) => {
    setEditingRule(rule);
    setDatasetQuery(rule.datasetKey || '');
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
          datasetKey: editingRule.datasetKey,
          geometry: editingRule.geometry,
          annotation: editingRule.annotation,
          basisOfRecord: editingRule.basisOfRecord ? [editingRule.basisOfRecord] : null,
          basisOfRecordNegated: false,
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

  // Handle dataset selection
  const handleDatasetSelect = (dataset: any) => {
    if (editingRule) {
      setEditingRule({ ...editingRule, datasetKey: dataset.key });
      setDatasetQuery(dataset.title);
      setShowDatasetSuggestions(false);
    }
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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{username}</h1>
              </div>
            </div>
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
            <UserPageFilters
              speciesFilter={speciesFilter}
              onSpeciesFilterChange={setSpeciesFilter}
              projectFilter={projectFilter}
              onProjectFilterChange={setProjectFilter}
              projects={projects}
            />
          </div>
          
          {/* Rules Content */}
          <div className="flex-1 overflow-auto p-6">
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
            <div className="bg-white rounded-lg border shadow-sm mb-8">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">ID</TableHead>
                    <TableHead className="w-28">TaxonKey</TableHead>
                    <TableHead>Species</TableHead>
                    <TableHead className="w-24">Annotation</TableHead>
                    <TableHead className="w-32">Project</TableHead>
                    <TableHead className="w-32">Created</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => {
                    const speciesInfo = rule.taxonKey ? speciesCache.get(rule.taxonKey) : null;
                    
                    return (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="font-medium">#{rule.id}</div>
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
                            
                            {!rule.deleted && isOwnProfile && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditRule(rule)}
                                title="Edit this rule"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {!rule.deleted && (
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

              <div className="space-y-2">
                <Label htmlFor="edit-basis">Basis of Record (optional)</Label>
                <select
                  id="edit-basis"
                  className="w-full p-2 border rounded-md"
                  value={editingRule.basisOfRecord || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, basisOfRecord: e.target.value || undefined })}
                >
                  <option value="">No filter</option>
                  <option value="HUMAN_OBSERVATION">Human Observation</option>
                  <option value="PRESERVED_SPECIMEN">Preserved Specimen</option>
                  <option value="FOSSIL_SPECIMEN">Fossil Specimen</option>
                  <option value="LIVING_SPECIMEN">Living Specimen</option>
                  <option value="MACHINE_OBSERVATION">Machine Observation</option>
                  <option value="MATERIAL_SAMPLE">Material Sample</option>
                  <option value="OCCURRENCE">Occurrence</option>
                </select>
              </div>

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
                          onClick={() => handleDatasetSelect(dataset)}
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
                {editingRule?.datasetKey && (
                  <div className="flex items-center justify-between text-xs text-gray-600 bg-blue-50 p-2 rounded">
                    <span>Selected: <span className="font-medium">{editingRule.datasetKey}</span></span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingRule({ ...editingRule, datasetKey: undefined });
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