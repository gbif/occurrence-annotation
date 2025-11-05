import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Filter } from 'lucide-react';
import { SpeciesSelector, SelectedSpecies } from './SpeciesSelector';

interface UserPageFiltersProps {
  speciesFilter: SelectedSpecies | null;
  onSpeciesFilterChange: (species: SelectedSpecies | null) => void;
}

export function UserPageFilters({
  speciesFilter,
  onSpeciesFilterChange,
}: UserPageFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const clearAllFilters = () => {
    onSpeciesFilterChange(null);
  };

  const hasActiveFilters = speciesFilter;

  return (
    <div className="space-y-2">
      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs">
              1
            </Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-gray-600 hover:text-gray-900"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <Card>
          <CardContent className="p-3">
            {/* Species Filter */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Species
              </label>
              <SpeciesSelector
                selectedSpecies={speciesFilter}
                onSelectSpecies={onSpeciesFilterChange}
                placeholder="Filter by species..."
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}