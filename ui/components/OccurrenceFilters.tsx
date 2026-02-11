import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Filter, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { getGbifApiUrl } from '../utils/apiConfig';

export interface OccurrenceFilterOptions {
  datasetKey?: string;
  year?: string;
  yearRange?: { min: number; max: number };
  hasGeospatialIssue?: boolean;
  basisOfRecord?: string[];
  distanceFromCentroid?: boolean;
}

interface OccurrenceFiltersProps {
  filters: OccurrenceFilterOptions;
  onFiltersChange: (filters: OccurrenceFilterOptions) => void;
}

interface Dataset {
  key: string;
  title: string;
  publishingOrganizationTitle?: string;
}

const basisOfRecordOptions = [
  'HUMAN_OBSERVATION',
  'PRESERVED_SPECIMEN',
  'FOSSIL_SPECIMEN',
  'LIVING_SPECIMEN',
  'MACHINE_OBSERVATION',
  'MATERIAL_SAMPLE',
  'OCCURRENCE',
  'MATERIAL_CITATION',
];

export function OccurrenceFilters({ filters, onFiltersChange }: OccurrenceFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<OccurrenceFilterOptions>(filters);
  
  // Dataset search state
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [datasetQuery, setDatasetQuery] = useState('');
  const [datasetSuggestions, setDatasetSuggestions] = useState<Dataset[]>([]);
  const [showDatasetSuggestions, setShowDatasetSuggestions] = useState(false);
  const datasetInputRef = useRef<HTMLInputElement>(null);

  // Initialize selected dataset from filters
  useEffect(() => {
    if (filters.datasetKey && !selectedDataset) {
      // If we have a datasetKey but no selected dataset, try to fetch it
      fetchDatasetByKey(filters.datasetKey);
    }
  }, [filters.datasetKey]);

  const fetchDatasetByKey = async (key: string) => {
    try {
      const response = await fetch(getGbifApiUrl(`/dataset/${key}`));
      if (response.ok) {
        const data = await response.json();
        setSelectedDataset(data);
        setDatasetQuery(data.title);
      }
    } catch (error) {
      console.error('Error fetching dataset:', error);
    }
  };

  const searchDatasets = async (query: string) => {
    if (query.length < 3) {
      setDatasetSuggestions([]);
      setShowDatasetSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        getGbifApiUrl(`/dataset/suggest?q=${encodeURIComponent(query)}&limit=10`)
      );
      
      if (response.ok) {
        const data = await response.json();
        setDatasetSuggestions(data || []);
        setShowDatasetSuggestions(true);
      }
    } catch (error) {
      console.error('Error searching datasets:', error);
    }
  };

  const handleDatasetSelect = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setDatasetQuery(dataset.title);
    setShowDatasetSuggestions(false);
    setLocalFilters({
      ...localFilters,
      datasetKey: dataset.key
    });
  };

  const handleDatasetClear = () => {
    setSelectedDataset(null);
    setDatasetQuery('');
    setDatasetSuggestions([]);
    setShowDatasetSuggestions(false);
    setLocalFilters({
      ...localFilters,
      datasetKey: undefined
    });
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datasetInputRef.current && !datasetInputRef.current.contains(event.target as Node)) {
        setShowDatasetSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    const cleared: OccurrenceFilterOptions = {};
    setLocalFilters(cleared);
    onFiltersChange(cleared);
    setSelectedDataset(null);
    setDatasetQuery('');
  };

  const handleResetToDefault = () => {
    const defaults: OccurrenceFilterOptions = {
      hasGeospatialIssue: false,
      basisOfRecord: [
        'HUMAN_OBSERVATION',
        'PRESERVED_SPECIMEN',
        'LIVING_SPECIMEN',
        'MACHINE_OBSERVATION',
        'MATERIAL_SAMPLE',
        'OCCURRENCE',
        'MATERIAL_CITATION'
      ]
    };
    setLocalFilters(defaults);
    setSelectedDataset(null);
    setDatasetQuery('');
  };

  const handleToggleBasisOfRecord = (option: string) => {
    const current = localFilters.basisOfRecord || [];
    const updated = current.includes(option)
      ? current.filter(b => b !== option)
      : [...current, option];
    
    setLocalFilters({
      ...localFilters,
      basisOfRecord: updated.length > 0 ? updated : undefined
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.datasetKey) count++;
    if (filters.year) count++;
    if (filters.yearRange) count++;
    if (filters.hasGeospatialIssue !== undefined) count++;
    if (filters.basisOfRecord && filters.basisOfRecord.length > 0) count++;
    if (filters.distanceFromCentroid !== undefined) count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative h-10 w-10 hover:bg-gray-100/50"
          title="Filter occurrence data"
        >
          <Filter className="w-4 h-4" />
          {activeCount > 0 && (
            <Badge 
              variant="default" 
              className="absolute -top-1 -right-1 px-1 py-0 text-[10px] h-3.5 min-w-3.5 rounded-full flex items-center justify-center leading-none"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Occurrence Filters</DialogTitle>
          <DialogDescription>
            Filter GBIF occurrence data displayed on the map.
            <br />
            <span className="text-xs text-muted-foreground italic">
              Note: The occurrences shown on the map do not affect the rules you make.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          {/* Dataset Search */}
          <div className="space-y-2 relative">
            <Label htmlFor="datasetKey" className="text-sm font-medium">
              Dataset
            </Label>
            <div className="relative" ref={datasetInputRef}>
              <Input
                id="datasetKey"
                placeholder="Search for dataset by title..."
                value={datasetQuery}
                onChange={(e) => {
                  setDatasetQuery(e.target.value);
                  searchDatasets(e.target.value);
                }}
                onFocus={() => {
                  if (datasetSuggestions.length > 0) {
                    setShowDatasetSuggestions(true);
                  }
                }}
                className="text-sm pr-8"
              />
              {selectedDataset && (
                <button
                  type="button"
                  onClick={handleDatasetClear}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              
              {/* Dataset suggestions dropdown */}
              {showDatasetSuggestions && datasetSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {datasetSuggestions.map((dataset) => (
                    <button
                      key={dataset.key}
                      type="button"
                      onClick={() => handleDatasetSelect(dataset)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
                    >
                      <div className="font-medium text-sm">{dataset.title}</div>
                      {dataset.publishingOrganizationTitle && (
                        <div className="text-xs text-gray-500">{dataset.publishingOrganizationTitle}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Search and select a dataset to filter occurrences
            </p>
          </div>

          {/* Year Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Year Range
              </Label>
              <span className="text-xs text-gray-600">
                {localFilters.yearRange?.min || 1700} - {localFilters.yearRange?.max || new Date().getFullYear()}
              </span>
            </div>
            <div className="relative pt-6 pb-2">
              {/* Background track */}
              <div className="absolute w-full h-2 bg-gray-200 rounded-lg" style={{ zIndex: 1 }} />
              
              {/* Track highlight between thumbs */}
              <div 
                className="absolute h-2 bg-blue-600 rounded-lg pointer-events-none"
                style={{
                  left: `${((localFilters.yearRange?.min || 1700) - 1700) / (new Date().getFullYear() - 1700) * 100}%`,
                  width: `${((localFilters.yearRange?.max || new Date().getFullYear()) - (localFilters.yearRange?.min || 1700)) / (new Date().getFullYear() - 1700) * 100}%`,
                  zIndex: 2
                }}
              />
              
              {/* Max year slider - lower z-index */}
              <input
                type="range"
                min="1700"
                max={new Date().getFullYear()}
                value={localFilters.yearRange?.max || new Date().getFullYear()}
                onChange={(e) => {
                  const newMax = parseInt(e.target.value);
                  const currentMin = localFilters.yearRange?.min || 1700;
                  if (newMax >= currentMin) {
                    setLocalFilters({
                      ...localFilters,
                      yearRange: {
                        min: currentMin,
                        max: newMax
                      }
                    });
                  }
                }}
                className="absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md"
                style={{ zIndex: 3 }}
              />
              
              {/* Min year slider - higher z-index so it's on top */}
              <input
                type="range"
                min="1700"
                max={new Date().getFullYear()}
                value={localFilters.yearRange?.min || 1700}
                onChange={(e) => {
                  const newMin = parseInt(e.target.value);
                  const currentMax = localFilters.yearRange?.max || new Date().getFullYear();
                  if (newMin <= currentMax) {
                    setLocalFilters({
                      ...localFilters,
                      yearRange: {
                        min: newMin,
                        max: currentMax
                      }
                    });
                  }
                }}
                className="absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md"
                style={{ zIndex: 4 }}
              />
            </div>
            <p className="text-xs text-gray-500">
              Filter occurrences by year range
            </p>
          </div>

          {/* Geospatial Issues */}
          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="hasGeospatialIssue"
                checked={localFilters.hasGeospatialIssue === false}
                onCheckedChange={(checked) => setLocalFilters({
                  ...localFilters,
                  hasGeospatialIssue: checked ? false : undefined
                })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="hasGeospatialIssue" className="text-sm font-medium cursor-pointer">
                  Exclude geospatial issues
                </Label>
                <p className="text-xs text-gray-500">
                  Only show occurrences without coordinate problems
                </p>
              </div>
            </div>
          </div>

          {/* Basis of Record */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Basis of Record
              </Label>
              {localFilters.basisOfRecord && localFilters.basisOfRecord.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocalFilters({ ...localFilters, basisOfRecord: undefined })}
                  className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear all
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
              {basisOfRecordOptions.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`basis-${option}`}
                    checked={localFilters.basisOfRecord?.includes(option) || false}
                    onCheckedChange={() => handleToggleBasisOfRecord(option)}
                  />
                  <Label 
                    htmlFor={`basis-${option}`} 
                    className="text-xs cursor-pointer font-normal"
                  >
                    {option.replace(/_/g, ' ')}
                  </Label>
                </div>
              ))}
            </div>
            {localFilters.basisOfRecord && localFilters.basisOfRecord.length > 0 && (
              <p className="text-xs text-blue-600">
                {localFilters.basisOfRecord.length} selected
              </p>
            )}
          </div>

          {/* Distance from Centroid */}
          <div className="space-y-2">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="distanceFromCentroid"
                checked={localFilters.distanceFromCentroid === true}
                onCheckedChange={(checked) => setLocalFilters({
                  ...localFilters,
                  distanceFromCentroid: checked ? true : undefined
                })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="distanceFromCentroid" className="text-sm font-medium cursor-pointer">
                  Near Centroid
                </Label>
                <p className="text-xs text-gray-500">
                  Only show occurrences within 5km of country/region centroid
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleResetToDefault}
              size="sm"
            >
              Reset to Default
            </Button>
          </div>
          <Button
            onClick={handleApplyFilters}
            size="sm"
          >
            Apply Filters
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
