import { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search, X, Loader2, Clock } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface Species {
  key: number;
  scientificName: string;
  canonicalName: string;
  rank: string;
  speciesKey?: number;
  genusKey?: number;
  familyKey?: number;
  orderKey?: number;
  classKey?: number;
  phylumKey?: number;
  kingdomKey?: number;
}

export interface SelectedSpecies {
  name: string;
  scientificName: string;
  key: number;
  speciesKey?: number;
  genusKey?: number;
  familyKey?: number;
  orderKey?: number;
  classKey?: number;
  phylumKey?: number;
  kingdomKey?: number;
}

interface SpeciesSelectorProps {
  selectedSpecies: SelectedSpecies | null;
  onSelectSpecies: (species: SelectedSpecies | null) => void;
}

export function SpeciesSelector({ selectedSpecies, onSelectSpecies }: SpeciesSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Species[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = async (term: string) => {
    const trimmedTerm = term.trim();
    
    // Don't search if less than 2 characters
    if (trimmedTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    // Cancel previous request if it exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.gbif.org/v1/species/suggest?q=${encodeURIComponent(trimmedTerm)}&limit=10`,
        { signal: abortControllerRef.current.signal }
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error searching species:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // If search term is empty, clear results immediately
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      handleSearch(searchTerm);
    }, 300); // 300ms debounce delay

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      // Clear debounce timer and search immediately
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      handleSearch(searchTerm);
    }
  };

  return (
    <div className="relative">
      {selectedSpecies ? (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-sm">Species:</span>
            <div>
              <span className="text-green-900">{selectedSpecies.name}</span>
              <span className="text-green-700 text-sm italic ml-2">({selectedSpecies.scientificName})</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onSelectSpecies(null);
              setSearchResults([]);
              setSearchTerm('');
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Input
              placeholder="Type to search for species..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pr-10"
              autoComplete="off"
            />
            {isLoading ? (
              <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
            ) : (
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
              <div className="p-2 space-y-1">
                {searchResults.map((species) => {
                  const canonicalName = species.canonicalName || species.scientificName;
                  const hasFullName = species.scientificName && species.scientificName !== canonicalName;
                  
                  return (
                    <button
                      key={species.key}
                      onClick={() => {
                        onSelectSpecies({
                          name: canonicalName,
                          scientificName: species.scientificName,
                          key: species.key,
                          speciesKey: species.speciesKey,
                          genusKey: species.genusKey,
                          familyKey: species.familyKey,
                          orderKey: species.orderKey,
                          classKey: species.classKey,
                          phylumKey: species.phylumKey,
                          kingdomKey: species.kingdomKey,
                        });
                        setSearchResults([]);
                        setSearchTerm('');
                      }}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded transition-colors border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900">{canonicalName}</p>
                          {hasFullName && (
                            <p className="text-gray-500 text-sm italic mt-0.5 truncate">
                              {species.scientificName}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 uppercase tracking-wide flex-shrink-0 mt-0.5">
                          {species.rank}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {searchTerm.trim() && searchTerm.trim().length < 2 && (
            <p className="text-gray-400 text-xs mt-1">Type at least 2 characters to search</p>
          )}
        </div>
      )}
    </div>
  );
}

