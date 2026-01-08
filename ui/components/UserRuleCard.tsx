import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Calendar, Eye, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { getSpeciesInfo } from '../utils/speciesCache';

interface UserRule {
  id: number;
  createdBy: string;
  created: string;
  geometry: string; // WKT string format
  taxonKey?: number;
  datasetKey?: string;
  annotation: string;
  basisOfRecord?: string;
  yearRange?: string;
  rulesetId?: number;
  projectId?: number;
  supportedBy: any[];
  contestedBy: any[];
  deleted?: string;
  deletedBy?: string;
}

interface SpeciesInfo {
  key: number;
  scientificName: string;
  canonicalName?: string;
  vernacularName?: string;
  rank?: string;
}

interface UserRuleCardProps {
  rule: UserRule;
  onViewRule: (rule: UserRule) => void;
  onDeleteRule?: (ruleId: number) => void;
  highlightTaxonKey?: number; // For highlighting when filtering by species
}

export function UserRuleCard({ rule, onViewRule, onDeleteRule, highlightTaxonKey }: UserRuleCardProps) {
  const [speciesInfo, setSpeciesInfo] = useState<SpeciesInfo | null>(null);
  const [loadingSpecies, setLoadingSpecies] = useState(false);

  // Fetch species information when component mounts or taxonKey changes
  useEffect(() => {
    const fetchSpeciesInfo = async () => {
      if (!rule.taxonKey) return;

      try {
        setLoadingSpecies(true);
        const data = await getSpeciesInfo(rule.taxonKey);
        
        if (data) {
          setSpeciesInfo(data);
        }
      } catch (error) {
        console.error('Error fetching species info:', error);
      } finally {
        setLoadingSpecies(false);
      }
    };

    fetchSpeciesInfo();
  }, [rule.taxonKey]);
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const getAnnotationColor = (annotation: string) => {
    switch (annotation?.toLowerCase()) {
      case 'suspicious':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'valid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'invalid':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getGeometryDescription = (geometry: string) => {
    if (!geometry) return 'Unknown geometry';
    
    // Parse WKT geometry string to get basic info
    const wkt = geometry.toUpperCase();
    if (wkt.startsWith('POLYGON')) {
      // Count coordinate pairs roughly
      const coordPairs = (geometry.match(/[-\d\.]+\s+[-\d\.]+/g) || []).length;
      return `Polygon (${coordPairs} points)`;
    } else if (wkt.startsWith('MULTIPOLYGON')) {
      const polygonCount = (geometry.match(/\(\(/g) || []).length;
      return `MultiPolygon (${polygonCount} polygons)`;
    }
    
    return 'Geometry';
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">
              Rule #{rule.id}
            </CardTitle>
            <CardDescription className="mt-1">
              {speciesInfo ? (
                <div className="space-y-1">
                  <span className="italic text-gray-700">{speciesInfo.scientificName}</span>
                  <br />
                  <span className="text-gray-500">{getGeometryDescription(rule.geometry)}</span>
                </div>
              ) : (
                getGeometryDescription(rule.geometry)
              )}
            </CardDescription>
          </div>
          <Badge 
            variant="outline" 
            className={getAnnotationColor(rule.annotation)}
          >
            {rule.annotation || 'Unknown'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Species Information - Only show detailed section if there's additional info like vernacular name */}
        {rule.taxonKey && speciesInfo && (speciesInfo.vernacularName || speciesInfo.rank) && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Species Details</p>
            <div className="space-y-1">
              {speciesInfo.vernacularName && (
                <p className="text-sm text-gray-900">
                  {speciesInfo.vernacularName}
                </p>
              )}
              {speciesInfo.rank && (
                <Badge variant="outline" className="text-xs">
                  {speciesInfo.rank}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Loading state for species when no data yet */}
        {rule.taxonKey && loadingSpecies && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Species</p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading species information...
            </div>
          </div>
        )}

        {/* Taxon Key */}
        {rule.taxonKey && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Taxon Key</p>
            <div className="flex flex-wrap gap-1">
              <Badge 
                variant="secondary" 
                className={`text-xs ${
                  highlightTaxonKey === rule.taxonKey 
                    ? 'bg-blue-100 text-blue-800 border-blue-200' 
                    : ''
                }`}
              >
                {rule.taxonKey}
              </Badge>
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>Created: {formatDate(rule.created)}</span>
          </div>
          {rule.deleted && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="text-red-600">Deleted: {formatDate(rule.deleted)}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewRule(rule)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            View on Map
          </Button>
          {onDeleteRule && !rule.deleted && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  title="Delete this rule"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Annotation Rule</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this annotation rule (ID: {rule.id})?
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDeleteRule(rule.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Open rule details in new tab
              window.open(`http://localhost:8080/occurrence/experimental/annotation/rule/${rule.id}`, '_blank');
            }}
            title="View rule details in API"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}