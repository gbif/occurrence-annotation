import { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Search, X, Loader2, Clock } from 'lucide-react';

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
  placeholder?: string;
}

export function SpeciesSelector({ selectedSpecies, onSelectSpecies, placeholder = "Search for scientific name..." }: SpeciesSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Species[]>([]);
  const [recentSpecies, setRecentSpecies] = useState<SelectedSpecies[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent species from localStorage on mount
  useEffect(() => {
    const loadRecentSpecies = () => {
      try {
        const stored = localStorage.getItem('recentSpecies');
        if (stored) {
          const recent: SelectedSpecies[] = JSON.parse(stored);
          setRecentSpecies(recent);
        }
      } catch (error) {
        console.error('Error loading recent species:', error);
      }
    };

    loadRecentSpecies();
  }, []);

  // Save recent species to localStorage
  const saveRecentSpecies = (species: SelectedSpecies) => {
    try {
      setRecentSpecies(prev => {
        // Remove if already exists to avoid duplicates
        const filtered = prev.filter(s => s.key !== species.key);
        // Add to beginning and limit to 10 most recent
        const updated = [species, ...filtered].slice(0, 10);
        
        // Save to localStorage
        localStorage.setItem('recentSpecies', JSON.stringify(updated));
        
        return updated;
      });
    } catch (error) {
      console.error('Error saving recent species:', error);
    }
  };

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

    // If search term is empty, clear results and potentially show recent
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    // Hide recent species when user starts typing
    setShowRecent(false);

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
    } else if (e.key === 'Escape') {
      // Hide recent species and clear search
      setShowRecent(false);
      setSearchTerm('');
      setSearchResults([]);
      inputRef.current?.blur();
    }
  };

  const handleInputFocus = () => {
    // Show recent species if input is empty and we have recent species
    if (!searchTerm.trim() && recentSpecies.length > 0) {
      setShowRecent(true);
    }
  };

  const handleInputBlur = () => {
    // Increase delay to allow for clicks on recent species
    setTimeout(() => {
      setShowRecent(false);
    }, 200);
  };

  const handleSpeciesSelect = (species: SelectedSpecies) => {
    console.log('Regular species selected:', species);
    
    // Save to recent species
    saveRecentSpecies(species);
    
    // Select the species
    onSelectSpecies(species);
    
    // Clear UI state
    setSearchResults([]);
    setSearchTerm('');
    setShowRecent(false);
  };

  const handleRecentSpeciesClick = (species: SelectedSpecies) => {
    console.log('Recent species clicked:', species);
    
    // Save to recent species (move to top of list)
    saveRecentSpecies(species);
    
    // Select the species immediately
    onSelectSpecies(species);
    
    // Clear UI state
    setSearchResults([]);
    setSearchTerm('');
    setShowRecent(false);
    
    console.log('Species selection completed');
  };

  return (
    <div className="relative">
      {selectedSpecies ? (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-green-900">{selectedSpecies.name}</span>
              <span className="text-green-700 text-xs italic ml-2">({selectedSpecies.scientificName})</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onSelectSpecies(null);
              setSearchResults([]);
              setSearchTerm('');
              setShowRecent(false);
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Input
              ref={inputRef}
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
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
                        handleSpeciesSelect({
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

          {showRecent && recentSpecies.length > 0 && !searchTerm.trim() && (
            <div 
              className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-80 overflow-auto"
              onMouseDown={(e) => e.preventDefault()} // Prevent input blur when clicking in dropdown
            >
              <div className="p-2">
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 font-medium border-b border-gray-100 mb-1">
                  <Clock className="w-3 h-3" />
                  Recent Searches
                </div>
                <div className="space-y-1">
                  {recentSpecies.map((species) => (
                    <button
                      key={species.key}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        handleRecentSpeciesClick(species);
                      }}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded transition-colors border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900">{species.name}</p>
                          {species.scientificName && species.scientificName !== species.name && (
                            <p className="text-gray-500 text-sm italic mt-0.5 truncate">
                              {species.scientificName}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
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

