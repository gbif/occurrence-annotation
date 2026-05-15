import React, { useState, useEffect } from 'react';
import { CountryPolygon, fetchCountryPolygons } from '../utils/countryPolygons';
import { parseWKTGeometry } from '../utils/wktParser';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Globe } from 'lucide-react';

interface CountrySelectorProps {
  /** Callback when countries are selected and loaded */
  onCountriesSelected: (coordinates: [number, number][][]) => void;
  /** Optional trigger button text */
  triggerText?: string;
}

export function CountrySelector({ 
  onCountriesSelected,
  triggerText = "Select Countries"
}: CountrySelectorProps) {
  const [countries, setCountries] = useState<CountryPolygon[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Load countries when dialog opens
  useEffect(() => {
    if (isOpen && countries.length === 0) {
      loadCountries();
    }
  }, [isOpen]);

  const loadCountries = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCountryPolygons();
      // Sort countries alphabetically by name
      const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
      setCountries(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load countries');
      console.error('Error loading countries:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter countries based on search term
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.identifier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Toggle country selection
  const toggleCountry = (identifier: string) => {
    const newSelected = new Set(selectedCountries);
    if (newSelected.has(identifier)) {
      newSelected.delete(identifier);
    } else {
      newSelected.add(identifier);
    }
    setSelectedCountries(newSelected);
  };

  // Load selected countries and close dialog
  const handleLoadCountries = () => {
    if (selectedCountries.size === 0) {
      return;
    }

    // Get selected country objects
    const selectedCountryObjects = countries.filter(c => 
      selectedCountries.has(c.identifier)
    );

    // Parse WKT to coordinates for each country
    const allCoordinates: [number, number][][] = [];
    
    for (const country of selectedCountryObjects) {
      try {
        const parsed = parseWKTGeometry(country.wkt);
        if (parsed) {
          if ('polygons' in parsed) {
            // MultiPolygon - add all polygons
            for (const poly of parsed.polygons) {
              allCoordinates.push(poly.outer);
              // Note: Currently ignoring holes for simplicity
              // Could be enhanced to handle holes if needed
            }
          } else {
            // Single polygon
            allCoordinates.push(parsed.outer);
            // Note: Currently ignoring holes
          }
        }
      } catch (err) {
        console.error(`Failed to parse WKT for country ${country.name}:`, err);
      }
    }

    if (allCoordinates.length > 0) {
      onCountriesSelected(allCoordinates);
      
      // Reset state and close
      setSelectedCountries(new Set());
      setSearchTerm('');
      setIsOpen(false);
    } else {
      setError('Failed to parse any country polygons');
    }
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedCountries(new Set());
  };

  const selectedCount = selectedCountries.size;
  const selectedNames = countries
    .filter(c => selectedCountries.has(c.identifier))
    .map(c => c.name)
    .slice(0, 3); // Show first 3 names

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Globe className="w-4 h-4" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Countries</DialogTitle>
          <DialogDescription>
            Choose one or more countries to load their boundaries as polygons for your rule.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="flex-shrink-0 space-y-2">
          <Input
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          
          {/* Selection summary */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Selected: {selectedCount} {selectedCount === 1 ? 'country' : 'countries'}
              </span>
              {selectedNames.map(name => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
              {selectedCount > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{selectedCount - 3} more
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="h-6 px-2 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Country list */}
        <ScrollArea className="flex-1 border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading countries...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-destructive">{error}</div>
            </div>
          ) : filteredCountries.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                {searchTerm ? 'No countries found' : 'No countries available'}
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredCountries.map((country) => {
                const isSelected = selectedCountries.has(country.identifier);
                return (
                  <div
                    key={country.identifier}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                    onClick={() => toggleCountry(country.identifier)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleCountry(country.identifier)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {country.name}
                      </div>
                      {country.iso2 && (
                        <div className="text-xs text-muted-foreground">
                          {country.iso2} • {country.vertexCount} vertices
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleLoadCountries}
            disabled={selectedCount === 0}
          >
            Load {selectedCount > 0 ? `${selectedCount} ${selectedCount === 1 ? 'Country' : 'Countries'}` : 'Countries'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
