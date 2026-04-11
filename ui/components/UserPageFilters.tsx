import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { X, Loader2 } from 'lucide-react';
import { SpeciesSelector, SelectedSpecies } from './SpeciesSelector';
import { useState, useEffect, useRef } from 'react';
import { getAnnotationApiUrl } from '../utils/apiConfig';

interface Project {
  id: number;
  name: string;
}

interface UserPageFiltersProps {
  speciesFilter: SelectedSpecies | null;
  onSpeciesFilterChange: (species: SelectedSpecies | null) => void;
  projectFilter: number | null;
  onProjectFilterChange: (projectId: number | null) => void;
  userFilter: string | null;
  onUserFilterChange: (username: string | null) => void;
  selectedProjectName: string | null;
}

export function UserPageFilters({
  speciesFilter,
  onSpeciesFilterChange,
  projectFilter,
  onProjectFilterChange,
  userFilter,
  onUserFilterChange,
  selectedProjectName,
}: UserPageFiltersProps) {
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [projectSearchResults, setProjectSearchResults] = useState<Project[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [searchingProjects, setSearchingProjects] = useState(false);
  const projectSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced project search
  useEffect(() => {
    if (projectSearchRef.current) {
      clearTimeout(projectSearchRef.current);
    }

    if (!projectSearchTerm.trim()) {
      setProjectSearchResults([]);
      setShowProjectDropdown(false);
      return;
    }

    projectSearchRef.current = setTimeout(async () => {
      setSearchingProjects(true);
      try {
        const response = await fetch(
          getAnnotationApiUrl(`/project?name=${encodeURIComponent(projectSearchTerm)}&limit=20`)
        );
        
        if (response.ok) {
          const data = await response.json();
          const results = Array.isArray(data) 
            ? data.map((p: any) => ({ id: p.id, name: p.name }))
            : [];
          
          setProjectSearchResults(results);
          setShowProjectDropdown(results.length > 0);
        }
      } catch (error) {
        console.error('Error searching projects:', error);
      } finally {
        setSearchingProjects(false);
      }
    }, 300);

    return () => {
      if (projectSearchRef.current) {
        clearTimeout(projectSearchRef.current);
      }
    };
  }, [projectSearchTerm]);

  const clearAllFilters = () => {
    onSpeciesFilterChange(null);
    onProjectFilterChange(null);
    onUserFilterChange(null);
  };

  const handleSelectProject = (project: Project) => {
    onProjectFilterChange(project.id);
    setProjectSearchTerm('');
    setProjectSearchResults([]);
    setShowProjectDropdown(false);
  };

  const hasActiveFilters = speciesFilter || projectFilter || userFilter;

  return (
    <div className="space-y-2">
      {/* Filter Controls */}
      <Card>
        <CardContent className="p-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Species Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Species
                </label>
                <SpeciesSelector
                  selectedSpecies={speciesFilter}
                  onSelectSpecies={onSpeciesFilterChange}
                  placeholder="Filter by species..."
                />
              </div>

              {/* Project Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Project
                </label>
                
                {/* Selected project chip */}
                {projectFilter && selectedProjectName && (
                  <div className="flex items-center gap-1 mb-1">
                    <div className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      <span>{selectedProjectName}</span>
                      <button
                        onClick={() => onProjectFilterChange(null)}
                        className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        title={`Remove ${selectedProjectName}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Search input with dropdown */}
                {!projectFilter && (
                  <div className="relative">
                    <div className="relative">
                      <Input
                        type="text"
                        value={projectSearchTerm}
                        onChange={(e) => setProjectSearchTerm(e.target.value)}
                        onFocus={() => projectSearchTerm && setShowProjectDropdown(true)}
                        placeholder="Type to search projects..."
                        className="h-9 text-sm pr-10"
                      />
                      {searchingProjects && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                      )}
                    </div>
                    
                    {/* Search results dropdown */}
                    {showProjectDropdown && projectSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {projectSearchResults.map(project => (
                          <button
                            key={project.id}
                            onClick={() => handleSelectProject(project)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-sm first:rounded-t-lg last:rounded-b-lg"
                          >
                            {project.name}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* No results message */}
                    {showProjectDropdown && projectSearchTerm && !searchingProjects && projectSearchResults.length === 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
                        No projects found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Username Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">
                  Username
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    placeholder="Filter by username..."
                    value={userFilter || ''}
                    onChange={(e) => onUserFilterChange(e.target.value || null)}
                    className="flex-1 h-9 text-sm"
                  />
                  {userFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUserFilterChange(null)}
                      className="h-9 w-9 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}