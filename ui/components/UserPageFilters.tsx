import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { X } from 'lucide-react';
import { SpeciesSelector, SelectedSpecies } from './SpeciesSelector';

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
  projects: Project[];
}

export function UserPageFilters({
  speciesFilter,
  onSpeciesFilterChange,
  projectFilter,
  onProjectFilterChange,
  userFilter,
  onUserFilterChange,
  projects,
}: UserPageFiltersProps) {
  const clearAllFilters = () => {
    onSpeciesFilterChange(null);
    onProjectFilterChange(null);
    onUserFilterChange(null);
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
                {projects.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={projectFilter || ''}
                      onChange={(e) => onProjectFilterChange(e.target.value ? parseInt(e.target.value) : null)}
                      className="flex-1 h-9 px-2 py-1 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">All projects</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    {projectFilter && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onProjectFilterChange(null)}
                        className="h-9 w-9 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">No projects available</p>
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