import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ArrowLeft, Folder, Users, ExternalLink, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getAnnotationApiUrl } from '../utils/apiConfig';

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

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create project dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Check if user is logged in
  const isLoggedIn = () => {
    return !!localStorage.getItem('gbifAuth');
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

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(getAnnotationApiUrl('/project'));

        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Filter out deleted projects and sort by id descending (newest first)
          const activeProjects = data
            .filter((p: Project) => !p.deleted)
            .sort((a: Project, b: Project) => b.id - a.id);
          setProjects(activeProjects);
        } else {
          setProjects([]);
        }
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError(err instanceof Error ? err.message : 'Failed to load projects');
        toast.error('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const handleViewProjectAPI = (projectId: number) => {
    window.open(getAnnotationApiUrl(`/project/${projectId}`), '_blank');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to create a project');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(getAnnotationApiUrl('/project'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${gbifAuth}`,
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDescription.trim(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication failed. Please login again.');
          return;
        }
        throw new Error(`Failed to create project: ${response.status}`);
      }

      const newProject = await response.json();
      
      // Add to local state
      setProjects(prev => [newProject, ...prev]);
      
      // Reset form and close dialog
      setNewProjectName('');
      setNewProjectDescription('');
      setIsCreateDialogOpen(false);
      
      toast.success(`Project "${newProject.name}" created successfully!`);
    } catch (err) {
      console.error('Error creating project:', err);
      toast.error('Failed to create project');
    } finally {
      setIsCreating(false);
    }
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
              <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
              <p className="text-gray-600">Loading projects...</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading projects...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
              <p className="text-gray-600">Error loading projects</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Folder className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Projects</h2>
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
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Folder className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
                <p className="text-gray-600">
                  {projects.length} {projects.length === 1 ? 'project' : 'projects'} available
                </p>
              </div>
            </div>
            
            {/* Create Project Button */}
            <div className="ml-auto">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    disabled={!isLoggedIn()}
                    title={isLoggedIn() ? 'Create a new project' : 'Login to create a project'}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Create a new annotation project. You will be the first member and can add others later.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateProject} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="projectName">Project Name *</Label>
                      <Input
                        id="projectName"
                        type="text"
                        placeholder="e.g., Rules for Orchidaceae"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        disabled={isCreating}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="projectDescription">Description</Label>
                      <Textarea
                        id="projectDescription"
                        placeholder="Describe the purpose of this project..."
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        disabled={isCreating}
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                        disabled={isCreating}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isCreating || !newProjectName.trim()}
                        className="flex-1"
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
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-auto p-6">
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Folder className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Projects Found</h2>
            <p className="text-gray-600 max-w-md mx-auto mb-4">
              No annotation projects have been created yet.
            </p>
            {isLoggedIn() && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create First Project
              </Button>
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="max-w-md">Description</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          #{project.id}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <Link 
                          to={`/project/${project.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {project.name}
                        </Link>
                      </TableCell>
                      
                      <TableCell className="max-w-md">
                        <p className="text-sm text-gray-600 truncate" title={project.description}>
                          {project.description}
                        </p>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {project.members.length}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Link 
                          to={`/user/${project.createdBy}`}
                          className="text-sm text-green-600 hover:text-green-800 hover:underline"
                        >
                          {project.createdBy}
                        </Link>
                      </TableCell>
                      
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatDate(project.created)}
                        </span>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex gap-1">
                          <Link to={`/project/${project.id}`}>
                            <Button variant="outline" size="sm" title="View Project">
                              View
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewProjectAPI(project.id)}
                            title="View in API"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
