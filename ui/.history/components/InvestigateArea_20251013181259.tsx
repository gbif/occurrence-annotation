import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { Search, ExternalLink, Loader2, MapPin, Calendar, User, Database, Eye, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { SelectedSpecies } from './SpeciesSelector';

interface GBIFOccurrence {
  key: number;
  scientificName: string;
  decimalLatitude: number;
  decimalLongitude: number;
  eventDate?: string;
  recordedBy?: string;
  datasetKey: string;
  datasetTitle?: string;
  publishingOrgKey?: string;
  publisher?: string;
  basisOfRecord?: string;
  coordinateUncertaintyInMeters?: number;
  media?: Array<{
    type: string;
    format: string;
    identifier: string;
    title?: string;
    creator?: string;
    license?: string;
  }>;
}

interface InvestigateAreaProps {
  selectedSpecies: SelectedSpecies | null;
  isInvestigateMode: boolean;
  onToggleInvestigateMode: (enabled: boolean) => void;
  onRadiusChange?: (radius: number) => void;
}

export function InvestigateArea({ 
  selectedSpecies, 
  isInvestigateMode, 
  onToggleInvestigateMode,
  onRadiusChange
}: InvestigateAreaProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [occurrences, setOccurrences] = useState<GBIFOccurrence[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [investigationPoint, setInvestigationPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(5000); // Default 5km radius

  // Notify parent of radius changes
  useEffect(() => {
    onRadiusChange?.(searchRadius);
  }, [searchRadius, onRadiusChange]);

  // Function to be called when user clicks on map in investigate mode
  const investigateArea = useCallback(async (lat: number, lng: number) => {
    console.log('🔍 InvestigateArea: Function called with coordinates:', { lat, lng, selectedSpecies: selectedSpecies?.scientificName, isInvestigateMode });
    
    if (!selectedSpecies || !isInvestigateMode) {
      console.log('🔍 InvestigateArea: Aborting - missing species or not in investigate mode');
      return;
    }
    
    setInvestigationPoint({ lat, lng });
    setIsLoading(true);
    setIsDialogOpen(true);
    
    console.log('🔍 InvestigateArea: Starting search with radius:', searchRadius);
    
    try {
      // Use a simple bounding box for more reliable results
      const radiusInDegrees = searchRadius / 111000; // Rough conversion: 1 degree ≈ 111km
      const latAdjustment = radiusInDegrees;
      const lngAdjustment = radiusInDegrees / Math.cos(lat * Math.PI / 180); // Adjust longitude for latitude
      
      const north = lat + latAdjustment;
      const south = lat - latAdjustment;
      const east = lng + lngAdjustment;
      const west = lng - lngAdjustment;
      
      console.log('🔍 InvestigateArea: Search bounds:', { north, south, east, west, radiusKm: searchRadius/1000 });
      
      // Search for occurrences within the bounding box
      const apiUrl = `https://api.gbif.org/v1/occurrence/search?` +
        `taxonKey=${selectedSpecies.key}&` +
        `hasCoordinate=true&` +
        `decimalLatitude=${south},${north}&` +
        `decimalLongitude=${west},${east}&` +
        `limit=50`;
      
      console.log('🔍 InvestigateArea: API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      console.log('🔍 InvestigateArea: API response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to fetch GBIF occurrences');
      }
      
      const data = await response.json();
      console.log('🔍 InvestigateArea: API response data:', data);
      
      // Fetch additional dataset information for each occurrence
      const enrichedOccurrences = await Promise.all(
        data.results.map(async (occurrence: any) => {
          try {
            // Fetch dataset info
            const datasetResponse = await fetch(
              `https://api.gbif.org/v1/dataset/${occurrence.datasetKey}`
            );
            
            let datasetInfo = {};
            if (datasetResponse.ok) {
              const dataset = await datasetResponse.json();
              datasetInfo = {
                datasetTitle: dataset.title,
                publisher: dataset.publishingOrganizationTitle || dataset.publisher
              };
            }
            
            return {
              key: occurrence.key,
              scientificName: occurrence.scientificName,
              decimalLatitude: occurrence.decimalLatitude,
              decimalLongitude: occurrence.decimalLongitude,
              eventDate: occurrence.eventDate,
              recordedBy: occurrence.recordedBy,
              datasetKey: occurrence.datasetKey,
              basisOfRecord: occurrence.basisOfRecord,
              coordinateUncertaintyInMeters: occurrence.coordinateUncertaintyInMeters,
              media: occurrence.media || [],
              ...datasetInfo
            };
          } catch (err) {
            console.error('Error fetching dataset info:', err);
            return occurrence;
          }
        })
      );
      
      setOccurrences(enrichedOccurrences);
      
      if (enrichedOccurrences.length === 0) {
        toast.info(`No occurrences found for ${selectedSpecies.scientificName} within ${searchRadius/1000}km of this location`);
      } else {
        toast.success(`Found ${enrichedOccurrences.length} occurrence(s) for ${selectedSpecies.scientificName}`);
      }
      
    } catch (error) {
      console.error('Error investigating area:', error);
      toast.error('Failed to search for occurrences in this area');
      setOccurrences([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSpecies, isInvestigateMode, searchRadius]);

  // Expose the investigation function globally so MapComponent can call it
  useEffect(() => {
    if (isInvestigateMode) {
      console.log('🔍 InvestigateArea: Setting up global investigate function');
      (window as any).__investigateArea = investigateArea;
    } else {
      console.log('🔍 InvestigateArea: Removing global investigate function');
      (window as any).__investigateArea = null;
    }
    
    return () => {
      (window as any).__investigateArea = null;
    };
  }, [isInvestigateMode, investigateArea]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getDistanceString = (lat: number, lng: number) => {
    if (!investigationPoint) return '';
    
    // Calculate distance using Haversine formula
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat - investigationPoint.lat) * Math.PI / 180;
    const dLng = (lng - investigationPoint.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(investigationPoint.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    if (distance < 1000) {
      return `${Math.round(distance)}m away`;
    } else {
      return `${(distance / 1000).toFixed(1)}km away`;
    }
  };

  return (
    <>
      {/* Investigate Area Controls */}
      <div className="flex items-center gap-2">
        {/* Investigate Area Toggle Button */}
        <Button
          variant={isInvestigateMode ? "default" : "outline"}
          size="icon"
          onClick={() => {
            const newMode = !isInvestigateMode;
            console.log('🔍 InvestigateArea: Toggle investigate mode to:', newMode);
            onToggleInvestigateMode(newMode);
          }}
          disabled={!selectedSpecies}
          title={selectedSpecies ? "Click on map to investigate area for occurrences" : "Select a species first"}
          className={isInvestigateMode ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          <Search className="w-5 h-5" />
        </Button>

        {/* Radius Controls - only show when in investigate mode */}
        {isInvestigateMode && (
          <>
            <div className="flex items-center gap-1 bg-white rounded-lg shadow-sm border px-2 py-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setSearchRadius(Math.max(1000, searchRadius - 1000))}
                disabled={searchRadius <= 1000}
                title="Decrease radius"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-xs font-medium min-w-[3rem] text-center">
                {(searchRadius / 1000).toFixed(0)}km
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setSearchRadius(Math.min(20000, searchRadius + 1000))}
                disabled={searchRadius >= 20000}
                title="Increase radius"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Results Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Area Investigation Results
            </DialogTitle>
            <DialogDescription>
              {selectedSpecies && investigationPoint && (
                <>
                  Occurrences of <em>{selectedSpecies.scientificName}</em> near{' '}
                  {investigationPoint.lat.toFixed(4)}, {investigationPoint.lng.toFixed(4)} 
                  ({(searchRadius/1000)}km radius)
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Searching for occurrences...</span>
              </div>
            ) : occurrences.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No occurrences found in this area</p>
                <p className="text-sm">Try investigating a different location</p>
              </div>
            ) : (
              <div className="space-y-4">
                {occurrences.map((occurrence) => (
                  <Card key={occurrence.key} className="p-4">
                    <div className="flex gap-4">
                      {/* Image */}
                      <div className="flex-shrink-0">
                        {occurrence.media && occurrence.media.length > 0 && occurrence.media[0].identifier ? (
                          <img
                            src={occurrence.media[0].identifier}
                            alt={occurrence.media[0].title || 'Occurrence image'}
                            className="w-24 h-24 object-cover rounded border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-100 rounded border flex items-center justify-center">
                            <Eye className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Occurrence Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{occurrence.scientificName}</h4>
                            <p className="text-xs text-gray-500">
                              GBIF Key: {occurrence.key}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {occurrence.basisOfRecord || 'Unknown'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-600">
                                {occurrence.decimalLatitude?.toFixed(4)}, {occurrence.decimalLongitude?.toFixed(4)}
                              </span>
                            </div>
                            <div className="text-gray-500">
                              {getDistanceString(occurrence.decimalLatitude, occurrence.decimalLongitude)}
                            </div>
                            {occurrence.coordinateUncertaintyInMeters && (
                              <div className="text-gray-500">
                                ±{occurrence.coordinateUncertaintyInMeters}m uncertainty
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              <span className="text-gray-600">
                                {formatDate(occurrence.eventDate)}
                              </span>
                            </div>
                            {occurrence.recordedBy && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-600 truncate">
                                  {occurrence.recordedBy}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Dataset Information */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Database className="w-3 h-3 text-gray-400" />
                            <span className="text-xs font-medium">Dataset</span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {occurrence.datasetTitle || 'Unknown dataset'}
                          </p>
                          {occurrence.publisher && (
                            <p className="text-xs text-gray-500">
                              Published by: {occurrence.publisher}
                            </p>
                          )}
                        </div>

                        {/* Links */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => window.open(`https://www.gbif.org/occurrence/${occurrence.key}`, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View on GBIF
                          </Button>
                          {occurrence.datasetKey && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => window.open(`https://www.gbif.org/dataset/${occurrence.datasetKey}`, '_blank')}
                            >
                              <Database className="w-3 h-3 mr-1" />
                              Dataset
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}