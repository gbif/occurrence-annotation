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
import { toast } from 'sonner';

interface CountrySelectorProps {
  /** Callback when countries are selected and loaded */
  onCountriesSelected: (coordinates: [number, number][][]) => void;
  /** Optional trigger button text */
  triggerText?: string;
}

export function CountrySelector({ 
  onCountriesSelected,
  triggerText = "Political"
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

    // Parse WKT to coordinates and check for holes
    const allCoordinates: [number, number][][] = [];
    const countriesWithHoles: string[] = [];
    let totalHolesCount = 0;
    
    for (const country of selectedCountryObjects) {
      try {
        const parsed = parseWKTGeometry(country.wkt);
        if (parsed) {
          if ('polygons' in parsed) {
            // MultiPolygon - check each polygon for holes
            for (const poly of parsed.polygons) {
              if (poly.holes && poly.holes.length > 0) {
                totalHolesCount += poly.holes.length;
                if (!countriesWithHoles.includes(country.name)) {
                  countriesWithHoles.push(country.name);
                }
              }
              allCoordinates.push(poly.outer);
            }
          } else {
            // Single polygon - check for holes
            if (parsed.holes && parsed.holes.length > 0) {
              totalHolesCount += parsed.holes.length;
              countriesWithHoles.push(country.name);
            }
            allCoordinates.push(parsed.outer);
          }
        }
      } catch (err) {
        console.error(`Failed to parse WKT for political boundary ${country.name}:`, err);
      }
    }

    if (allCoordinates.length > 0) {
      onCountriesSelected(allCoordinates);
      
      // Show single consolidated toast based on whether holes were detected
      if (countriesWithHoles.length > 0) {
        const boundaryText = countriesWithHoles.length === 1 ? 'boundary has' : 'boundaries have';
        const holeText = totalHolesCount === 1 ? 'hole' : 'holes';
        
        // Limit displayed names to prevent overflow
        const displayNames = countriesWithHoles.slice(0, 3).join(', ');
        const remainingCount = countriesWithHoles.length - 3;
        const namesList = remainingCount > 0 
          ? `${displayNames} (and ${remainingCount} more)` 
          : displayNames;
        
        toast.warning(
          `Loaded ${selectedCount} boundaries - ${totalHolesCount} interior ${holeText} ignored`,
          {
            description: `${namesList} have interior regions (e.g., enclaves) that will be included in rule area. Edit boundaries to match biological distributions.`,
            duration: 8000,
          }
        );
      } else {
        toast.success(
          `Loaded ${selectedCount} ${selectedCount === 1 ? 'political boundary' : 'political boundaries'}`,
          {
            description: `${allCoordinates.length} polygon${allCoordinates.length === 1 ? '' : 's'} added. Edit boundaries to match biological distributions - species rarely follow political borders.`,
            duration: 6000,
          }
        );
      }
      
      // Reset state and close
      setSelectedCountries(new Set());
      setSearchTerm('');
      setIsOpen(false);
    } else {
      const errorMsg = 'Failed to parse any political boundary polygons';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedCountries(new Set());
  };

  const selectedCount = selectedCountries.size;
  const selectedItems = countries
    .filter(c => selectedCountries.has(c.identifier))
    .slice(0, 3)
    .map((c, idx) => ({ name: c.name, key: `${c.identifier}-${idx}` }));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-6 px-2 gap-1.5 text-xs">
          <Globe className="w-3.5 h-3.5" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col gap-4 p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Select Political Boundaries</DialogTitle>
          <DialogDescription className="space-y-2">
            <p>Choose one or more political boundaries to load as polygons for your rule.</p>
            <p className="text-amber-600 dark:text-amber-500 font-medium">
              ⚠️ Note: The living world does not follow political boundaries. Please edit the loaded polygons to more accurately reflect real species distributions.
            </p>
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="flex-shrink-0 space-y-2">
          <Input
            placeholder="Search political boundaries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
          
          {/* Selection summary */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">
                Selected: {selectedCount} {selectedCount === 1 ? 'political boundary' : 'political boundaries'}
              </span>
              {selectedItems.map(item => (
                <Badge key={item.key} variant="secondary" className="text-xs">
                  {item.name}
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
        <ScrollArea className="flex-1 min-h-0 border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">Loading political boundaries...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-destructive">{error}</div>
            </div>
          ) : filteredCountries.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">
                {searchTerm ? 'No political boundaries found' : 'No political boundaries available'}
              </div>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredCountries.map((country, index) => {
                const uniqueKey = `${country.identifier}-${index}`;
                const isSelected = selectedCountries.has(country.identifier);
                return (
                  <div
                    key={uniqueKey}
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

        <DialogFooter className="flex-shrink-0">
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
