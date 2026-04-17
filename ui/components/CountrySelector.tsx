import { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { X, Loader2, Globe, Map, Waves } from 'lucide-react';
import { fetchCountryGeometries, filterByType, getTypeLabel, type Country, type BoundaryType } from '../utils/countryApi';
import { toast } from 'sonner';
import { Badge } from './ui/badge';

interface CountrySelectorProps {
  selectedCountries: string[]; // Array of identifiers (title for Continent/IHO)
  onCountriesChange: (identifiers: string[]) => void;
  maxSelections?: number; // Optional limit on number of boundaries
  onClose?: () => void; // Optional callback to close dialog after selection
  allowedTypes?: BoundaryType[]; // Types of boundaries to show (default: ['Continent', 'IHO'])
}

export function CountrySelector({
  selectedCountries,
  onCountriesChange,
  maxSelections,
  onClose,
  allowedTypes = ['Continent', 'IHO'], // Default to Continent + Ocean only (no countries)
}: CountrySelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [allCountries, setAllCountries] = useState<Country[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all countries on mount
  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    setLoading(true);
    try {
      console.log('[CountrySelector] Loading countries with allowedTypes:', allowedTypes);
      const countries = await fetchCountryGeometries();
      console.log('[CountrySelector] Fetched countries:', countries.length);
      // Filter by allowed types
      const filtered = filterByType(countries, allowedTypes);
      console.log('[CountrySelector] After filtering:', filtered.length);
      setAllCountries(filtered);
    } catch (error) {
      console.error('[CountrySelector] Failed to load boundaries:', error);
      toast.error('Failed to load boundary list');
    } finally {
      setLoading(false);
    }
  };

  // Debounced client-side filtering
  useEffect(() => {
    if (searchRef.current) {
      clearTimeout(searchRef.current);
    }

    if (!searchTerm.trim()) {
      setFilteredCountries([]);
      setShowDropdown(false);
      return;
    }

    searchRef.current = setTimeout(() => {
      const lowerSearch = searchTerm.toLowerCase();
      const matches = allCountries
        .filter(
          (country) => {
            const name = String(country.name || '').toLowerCase();
            const identifier = String(country.identifier || '').toLowerCase();
            const iso2 = String(country.iso2 || '').toLowerCase();
            return name.includes(lowerSearch) || identifier.includes(lowerSearch) || iso2.includes(lowerSearch);
          }
        )
        // Exclude already selected boundaries
        .filter((country) => !selectedCountries.includes(country.identifier))
        .slice(0, 20); // Limit results for performance

      setFilteredCountries(matches);
      setShowDropdown(true);
    }, 300);

    return () => {
      if (searchRef.current) {
        clearTimeout(searchRef.current);
      }
    };
  }, [searchTerm, allCountries, selectedCountries]);

  const handleSelectCountry = (country: Country) => {
    console.log('[CountrySelector] Selecting boundary:', {
      identifier: country.identifier,
      name: country.name,
      type: country.type,
      vertexCount: country.vertexCount,
      hasWkt: !!country.wkt,
      wktLength: country.wkt?.length
    });
    
    if (maxSelections && selectedCountries.length >= maxSelections) {
      const typeLabel = allowedTypes.length === 1 ? getTypeLabel(allowedTypes[0]).toLowerCase() + 's' : 'boundaries';
      toast.warning(`Maximum ${maxSelections} ${typeLabel} allowed`);
      return;
    }

    onCountriesChange([...selectedCountries, country.identifier]);
    setSearchTerm('');
    setShowDropdown(false);
    toast.success(`Added ${country.name || country.identifier}`);
    
    // Close the dialog after selection
    if (onClose) {
      onClose();
    }
  };

  const handleRemoveCountry = (identifier: string) => {
    const country = allCountries.find((c) => c.identifier === identifier);
    onCountriesChange(selectedCountries.filter((id) => id !== identifier));
    if (country) {
      toast.success(`Removed ${country.name || country.identifier}`);
    }
  };

  const handleClearAll = () => {
    onCountriesChange([]);
    toast.success('Cleared all selections');
  };

  // Get icon component for boundary type
  const getTypeIcon = (type: BoundaryType) => {
    const iconClass = "h-3 w-3";
    switch (type) {
      case 'Political':
        return <Globe className={iconClass} />;
      case 'Continent':
        return <Map className={iconClass} />;
      case 'IHO':
        return <Waves className={iconClass} />;
      default:
        return <Globe className={iconClass} />;
    }
  };

  // Get selected boundary names for display
  const getBoundaryName = (identifier: string): string => {
    const boundary = allCountries.find((c) => c.identifier === identifier);
    return boundary?.name || identifier;
  };

  // Get boundary by identifier
  const getBoundary = (identifier: string): Country | undefined => {
    return allCountries.find((c) => c.identifier === identifier);
  };

  return (
    <div className="space-y-2">
      {/* Selected boundaries as chips */}
      {selectedCountries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCountries.map((identifier) => {
            const boundary = getBoundary(identifier);
            return (
              <div
                key={identifier}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
              >
                {boundary && getTypeIcon(boundary.type)}
                <span>{getBoundaryName(identifier)}</span>
                <button
                  onClick={() => handleRemoveCountry(identifier)}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  title={`Remove ${getBoundaryName(identifier)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          {selectedCountries.length > 1 && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
              title="Clear all selections"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Search input with dropdown */}
      <div className="relative">
        <div className="relative">
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => searchTerm && setShowDropdown(true)}
            placeholder={`Search ${allowedTypes.map(t => getTypeLabel(t).toLowerCase()).join(', ')}...`}
            className="h-10 text-sm pr-10"
            disabled={loading}
          />
          {loading && allCountries.length === 0 && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
          )}
          {!loading && allCountries.length > 0 && (
            <Globe className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          )}
        </div>

        {/* Search results dropdown */}
        {showDropdown && filteredCountries.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredCountries.map((country) => (
              <button
                key={country.identifier}
                onClick={() => handleSelectCountry(country)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-sm first:rounded-t-lg last:rounded-b-lg flex items-center gap-2"
              >
                <div className="flex-shrink-0">
                  {getTypeIcon(country.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{country.name || country.identifier}</div>
                </div>
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {getTypeLabel(country.type)}
                </Badge>
              </button>
            ))}
          </div>
        )}

        {/* No results message */}
        {showDropdown &&
          searchTerm &&
          !loading &&
          filteredCountries.length === 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
              No results found
            </div>
          )}
      </div>

      {/* Selection count and limit */}
      {selectedCountries.length > 0 && (
        <div className="text-xs text-gray-600">
          {selectedCountries.length} {selectedCountries.length === 1 ? 'boundary' : 'boundaries'} selected
          {maxSelections && ` (max ${maxSelections})`}
        </div>
      )}
    </div>
  );
}
