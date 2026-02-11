import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious,
  PaginationEllipsis
} from './ui/pagination';
import { ArrowLeft, Folder, Users, User, ExternalLink, Loader2, UserPlus, X, BarChart3, MapPin, Bug, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { getAnnotationApiUrl } from '../utils/apiConfig';
import { getSpeciesInfo } from '../utils/speciesCache';
import { SpeciesSelector, SelectedSpecies } from './SpeciesSelector';

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

interface ProjectRule {
  id: number;
  createdBy: string;
  created: string;
  geometry: string;
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

interface ProjectMetrics {
  username: string;
  ruleCount: number;
  datasetCount: number;
  projectCount: number;
  taxonCount: number;
  supportCount: number;
  contestCount: number;
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Metrics state
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Rules state
  const [rules, setRules] = useState<ProjectRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  
  // Filter state
  const [speciesFilter, setSpeciesFilter] = useState<SelectedSpecies | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  
  // Species cache for rule table
  const [speciesCache, setSpeciesCache] = useState<Map<number, SpeciesInfo>>(new Map());
  const fetchedTaxonKeys = useRef<Set<number>>(new Set());

  // Add member dialog state
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Check if current user is a member (can edit)
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

  const isCurrentUserMember = () => {
    const currentUser = getCurrentUser();
    return currentUser && project?.members.includes(currentUser);
  };

  const isLoggedIn = () => {
    return !!localStorage.getItem('gbifAuth');
  };

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

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
      case 'absent':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'wild':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'not_wild':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'uncertain':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Fetch species info for a rule
  const fetchSpeciesInfo = useCallback(async (taxonKey: number) => {
    fetchedTaxonKeys.current.add(taxonKey);
    
    try {
      const data = await getSpeciesInfo(taxonKey);
      if (data) {
        setSpeciesCache(prev => {
          const newCache = new Map(prev);
          newCache.set(taxonKey, data);
          return newCache;
        });
        return data;
      }
    } catch (error) {
      console.error('Error fetching species info:', error);
    }
    return null;
  }, []);

  // Filter rules by species
  const filteredRules = useMemo(() => {
    let filtered = rules;

    if (speciesFilter) {
      filtered = filtered.filter(rule => 
        rule.taxonKey === speciesFilter.key
      );
    }

    return filtered;
  }, [rules, speciesFilter]);

  // Calculate pagination values
  const totalPages = Math.ceil(filteredRules.length / pageSize);

  // Get current page of rules
  const paginatedRules = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredRules.slice(startIndex, endIndex);
  }, [filteredRules, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [speciesFilter]);

  const handleViewProjectAPI = () => {
    if (projectId) {
      window.open(getAnnotationApiUrl(`/project/${projectId}`), '_blank');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!project || !newMemberUsername.trim()) {
      toast.error('Please enter a username');
      return;
    }

    const username = newMemberUsername.trim().toLowerCase();
    
    // Check if already a member
    if (project.members.map(m => m.toLowerCase()).includes(username)) {
      toast.error('User is already a member of this project');
      return;
    }

    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to add members');
      return;
    }

    setIsAddingMember(true);

    try {
      const updatedMembers = [...project.members, username];
      
      const response = await fetch(getAnnotationApiUrl(`/project/${project.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${gbifAuth}`,
        },
        body: JSON.stringify({
          ...project,
          members: updatedMembers,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication failed. Please login again.');
          return;
        }
        if (response.status === 403) {
          toast.error('You must be a member of this project to add members.');
          return;
        }
        throw new Error(`Failed to add member: ${response.status}`);
      }

      const updatedProject = await response.json();
      setProject(updatedProject);
      
      // Reset form and close dialog
      setNewMemberUsername('');
      setIsAddMemberDialogOpen(false);
      
      toast.success(`Added ${username} to the project!`);
    } catch (err) {
      console.error('Error adding member:', err);
      toast.error('Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberToRemove: string) => {
    if (!project) return;
    
    // Can't remove the last member
    if (project.members.length <= 1) {
      toast.error('Cannot remove the last member from a project');
      return;
    }

    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to remove members');
      return;
    }

    try {
      const updatedMembers = project.members.filter(m => m !== memberToRemove);
      
      const response = await fetch(getAnnotationApiUrl(`/project/${project.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${gbifAuth}`,
        },
        body: JSON.stringify({
          ...project,
          members: updatedMembers,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication failed. Please login again.');
          return;
        }
        if (response.status === 403) {
          toast.error('You must be a member of this project to remove members.');
          return;
        }
        throw new Error(`Failed to remove member: ${response.status}`);
      }

      const updatedProject = await response.json();
      setProject(updatedProject);
      
      toast.success(`Removed ${memberToRemove} from the project`);
    } catch (err) {
      console.error('Error removing member:', err);
      toast.error('Failed to remove member');
    }
  };

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(getAnnotationApiUrl(`/project/${projectId}`));

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Project not found');
          }
          throw new Error(`Failed to fetch project: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        setProject(data);
      } catch (err) {
        console.error('Error fetching project:', err);
        setError(err instanceof Error ? err.message : 'Failed to load project');
        toast.error('Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  // Fetch project metrics
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!projectId) return;

      try {
        setMetricsLoading(true);
        const response = await fetch(getAnnotationApiUrl(`/rule/metrics?projectId=${projectId}`));

        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error('Error fetching metrics:', err);
      } finally {
        setMetricsLoading(false);
      }
    };

    fetchMetrics();
  }, [projectId]);

  // Fetch project rules
  useEffect(() => {
    const fetchRules = async () => {
      if (!projectId) return;

      try {
        setRulesLoading(true);
        const response = await fetch(getAnnotationApiUrl(`/rule?projectId=${projectId}`));

        if (!response.ok) {
          throw new Error(`Failed to fetch rules: ${response.status}`);
        }

        const data = await response.json();
        if (Array.isArray(data)) {
          setRules(data);
        } else {
          setRules([]);
        }
      } catch (err) {
        console.error('Error fetching project rules:', err);
        toast.error('Failed to load project rules');
      } finally {
        setRulesLoading(false);
      }
    };

    fetchRules();
  }, [projectId]);

  // Prefetch species info for rules
  useEffect(() => {
    rules.forEach(rule => {
      if (rule.taxonKey && !fetchedTaxonKeys.current.has(rule.taxonKey)) {
        fetchSpeciesInfo(rule.taxonKey);
      }
    });
  }, [rules, fetchSpeciesInfo]);

  if (loading) {
    const currentUser = getCurrentUser();
    const backLink = currentUser ? `/user/${currentUser}?tab=projects` : '/projects';

    return (
      <div className="h-screen flex flex-col">
        <div className="p-6 border-b bg-white">
          <div className="flex items-center gap-4">
            <Link to={backLink}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to My Projects
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Project</h1>
              <p className="text-gray-600">Loading project...</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading project...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    const currentUser = getCurrentUser();
    const backLink = currentUser ? `/user/${currentUser}?tab=projects` : '/projects';

    return (
      <div className="h-screen flex flex-col">
        <div className="p-6 border-b bg-white">
          <div className="flex items-center gap-4">
            <Link to={backLink}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to My Projects
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Project</h1>
              <p className="text-gray-600">Error loading project</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Folder className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Project</h2>
            <p className="text-gray-600 mb-4">{error || 'Project not found'}</p>
            <div className="flex gap-2 justify-center">
              <Link to={backLink}>
                <Button variant="outline">Back to My Projects</Button>
              </Link>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentUser = getCurrentUser();
  const backLink = currentUser ? `/user/${currentUser}?tab=projects` : '/projects';

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <Link to={backLink}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to My Projects
              </Button>
            </Link>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Folder className="w-5 h-5 text-blue-700" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                  <Badge variant="secondary" className="text-xs">#{project.id}</Badge>
                </div>
                <p className="text-gray-600">{project.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewProjectAPI}
                title="View in API"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                API
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Project Metrics Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Project Statistics
              </CardTitle>
              <CardDescription>
                Overview of annotation rules in this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : metrics ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-blue-700" />
                      <p className="text-xs font-medium text-blue-900">Total Rules</p>
                    </div>
                    <p className="text-xl font-bold text-blue-700">{metrics.ruleCount}</p>
                  </div>
                  
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Bug className="w-4 h-4 text-green-700" />
                      <p className="text-xs font-medium text-green-900">Taxa</p>
                    </div>
                    <p className="text-xl font-bold text-green-700">{metrics.taxonCount}</p>
                  </div>
                  
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-amber-700" />
                      <p className="text-xs font-medium text-amber-900">Support / Contest</p>
                    </div>
                    <p className="text-xl font-bold text-amber-700">
                      {metrics.supportCount} / {metrics.contestCount}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No metrics available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Members Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Project Members
                  </CardTitle>
                  <CardDescription>
                    Users who can contribute to this project
                  </CardDescription>
                </div>
                
                {/* Add Member Button/Dialog */}
                {isLoggedIn() && (
                  <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        size="sm"
                        disabled={!isCurrentUserMember()}
                        title={isCurrentUserMember() ? 'Add a new member' : 'Only project members can add new members'}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Project Member</DialogTitle>
                        <DialogDescription>
                          Enter the GBIF username of the person you want to add to this project.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddMember} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="memberUsername">GBIF Username *</Label>
                          <Input
                            id="memberUsername"
                            type="text"
                            placeholder="e.g., johndoe"
                            value={newMemberUsername}
                            onChange={(e) => setNewMemberUsername(e.target.value)}
                            disabled={isAddingMember}
                            required
                          />
                          <p className="text-xs text-gray-500">
                            The user must have a valid GBIF account.
                          </p>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsAddMemberDialogOpen(false)}
                            disabled={isAddingMember}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={isAddingMember || !newMemberUsername.trim()}
                            className="flex-1"
                          >
                            {isAddingMember ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              'Add Member'
                            )}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {project.members.length === 0 ? (
                <p className="text-gray-500 text-sm">No members in this project</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {project.members.map((member) => (
                    <div
                      key={member}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg group"
                    >
                      <Link
                        to={`/user/${member}`}
                        className="inline-flex items-center gap-2 hover:underline"
                      >
                        <User className="w-4 h-4 text-green-700" />
                        <span className="text-sm font-medium text-green-900">{member}</span>
                      </Link>
                      {/* Show remove button only for members who can edit and not for the last member */}
                      {isCurrentUserMember() && project.members.length > 1 && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          className="ml-1 p-0.5 rounded hover:bg-green-200 text-green-600 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title={`Remove ${member} from project`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Rules Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Project Rules
                {!rulesLoading && rules.length > 0 && (
                  <Badge variant="secondary">{rules.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                All annotation rules that belong to this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Species Filter */}
              {!rulesLoading && rules.length > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <SpeciesSelector
                      selectedSpecies={speciesFilter}
                      onSelectSpecies={setSpeciesFilter}
                    />
                    {speciesFilter && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSpeciesFilter(null)}
                        className="flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Clear filter
                      </Button>
                    )}
                  </div>
                  {speciesFilter && (
                    <div className="text-sm text-gray-600">
                      Filtering by: <span className="font-medium italic">{speciesFilter.scientificName}</span>
                      {speciesFilter.vernacularName && (
                        <span className="text-gray-500"> ({speciesFilter.vernacularName})</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {rulesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading rules...</span>
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MapPin className="w-6 h-6 text-gray-400" />
                  </div>
                  {rules.length === 0 ? (
                    <p className="text-gray-500 text-sm">No rules in this project yet</p>
                  ) : (
                    <>
                      <p className="text-gray-500 text-sm mb-2">No rules match the current filter</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSpeciesFilter(null)}
                      >
                        Clear filter
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">ID</TableHead>
                        <TableHead className="w-28">TaxonKey</TableHead>
                        <TableHead>Species</TableHead>
                        <TableHead className="w-24">Annotation</TableHead>
                        <TableHead className="w-32">Created By</TableHead>
                        <TableHead className="w-32">Created</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRules.map((rule) => {
                        const speciesInfo = rule.taxonKey ? speciesCache.get(rule.taxonKey) : null;
                        
                        return (
                          <TableRow key={rule.id}>
                            <TableCell>
                              <div className="font-medium">#{rule.id}</div>
                            </TableCell>
                            
                            <TableCell>
                              {rule.taxonKey ? (
                                <Badge variant="secondary" className="text-xs">
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
                              <Link
                                to={`/user/${rule.createdBy}`}
                                className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                              >
                                <User className="w-3 h-3" />
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (rule.taxonKey) {
                                    window.location.href = `/#/?taxonKey=${rule.taxonKey}`;
                                  }
                                }}
                                title="View on map"
                                disabled={!rule.taxonKey}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {!rulesLoading && filteredRules.length > pageSize && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredRules.length)} of {filteredRules.length} rules
                  </div>
                  
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {/* First page */}
                      {currentPage > 2 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setCurrentPage(1)} className="cursor-pointer">
                            1
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      
                      {/* Ellipsis before */}
                      {currentPage > 3 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      
                      {/* Previous page */}
                      {currentPage > 1 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setCurrentPage(currentPage - 1)} className="cursor-pointer">
                            {currentPage - 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      
                      {/* Current page */}
                      <PaginationItem>
                        <PaginationLink isActive className="cursor-default">
                          {currentPage}
                        </PaginationLink>
                      </PaginationItem>
                      
                      {/* Next page */}
                      {currentPage < totalPages && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setCurrentPage(currentPage + 1)} className="cursor-pointer">
                            {currentPage + 1}
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      
                      {/* Ellipsis after */}
                      {currentPage < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      
                      {/* Last page */}
                      {currentPage < totalPages - 1 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setCurrentPage(totalPages)} className="cursor-pointer">
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last Modified Info */}
          {project.modified && (
            <Card>
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">
                  Last modified on {formatDateTime(project.modified)}
                  {project.modifiedBy && ` by ${project.modifiedBy}`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
