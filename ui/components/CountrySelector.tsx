import { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { X, Loader2, Globe } from 'lucide-react';
import { fetchCountryGeometries, type Country } from '../utils/countryApi';
import { toast } from 'sonner';

interface CountrySelectorProps {
  selectedCountries: string[]; // Array of ISO2 codes
  onCountriesChange: (iso2Codes: string[]) => void;
  maxSelections?: number; // Optional limit on number of countries
  onClose?: () => void; // Optional callback to close dialog after selection
}

export function CountrySelector({
  selectedCountries,
  onCountriesChange,
  maxSelections,
  onClose,
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
      const countries = await fetchCountryGeometries();
      setAllCountries(countries);
    } catch (error) {
      console.error('Failed to load countries:', error);
      toast.error('Failed to load political boundary list');
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
            const iso2 = String(country.iso2 || '').toLowerCase();
            return name.includes(lowerSearch) || iso2.includes(lowerSearch);
          }
        )
        // Exclude already selected countries
        .filter((country) => !selectedCountries.includes(country.iso2))
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
    if (maxSelections && selectedCountries.length >= maxSelections) {
      toast.warning(`Maximum ${maxSelections} political boundaries allowed`);
      return;
    }

    onCountriesChange([...selectedCountries, country.iso2]);
    setSearchTerm('');
    setShowDropdown(false);
    toast.success(`Added ${country.name || country.iso2}`);
    
    // Close the dialog after selection
    if (onClose) {
      onClose();
    }
  };

  const handleRemoveCountry = (iso2: string) => {
    const country = allCountries.find((c) => c.iso2 === iso2);
    onCountriesChange(selectedCountries.filter((code) => code !== iso2));
    if (country) {
      toast.success(`Removed ${country.name || country.iso2}`);
    }
  };

  const handleClearAll = () => {
    onCountriesChange([]);
    toast.success('Cleared all selections');
  };

  // Get selected country names for display
  const getCountryName = (iso2: string): string => {
    const country = allCountries.find((c) => c.iso2 === iso2);
    return country?.name || iso2;
  };

  return (
    <div className="space-y-2">
      {/* Selected countries as chips */}
      {selectedCountries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCountries.map((iso2) => (
            <div
              key={iso2}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
            >
              <Globe className="h-3 w-3" />
              <span>{getCountryName(iso2)}</span>
              <button
                onClick={() => handleRemoveCountry(iso2)}
                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                title={`Remove ${getCountryName(iso2)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
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
            placeholder="Type to search political boundaries..."
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
                key={country.iso2}
                onClick={() => handleSelectCountry(country)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-sm first:rounded-t-lg last:rounded-b-lg flex items-center justify-between"
              >
                <span className="font-medium">{country.name || country.iso2}</span>
                <span className="text-xs text-gray-500">{country.iso2}</span>
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
