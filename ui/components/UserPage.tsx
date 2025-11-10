import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { ArrowLeft, User, MapPin, Eye, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { UserPageFilters } from './UserPageFilters';
import { SelectedSpecies } from './SpeciesSelector';
import { getAnnotationApiUrl } from '../utils/apiConfig';
import { getSpeciesInfo } from '../utils/speciesCache';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious,
  PaginationEllipsis
} from './ui/pagination';

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

interface UserPageProps {
  onNavigateToRule?: (rule: UserRule) => void;
}

export function UserPage({ onNavigateToRule }: UserPageProps) {
  const { username } = useParams<{ username: string }>();
  const [rules, setRules] = useState<UserRule[]>([]);
  const [allRules, setAllRules] = useState<UserRule[]>([]); // Store all rules for client-side pagination
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Species info cache
  const [speciesCache, setSpeciesCache] = useState<Map<number, SpeciesInfo>>(new Map());
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRules, setTotalRules] = useState(0);
  const [pageSize] = useState(20);

  // Filter states
  const [speciesFilter, setSpeciesFilter] = useState<SelectedSpecies | null>(null);

  // Calculate pagination values
  const totalPages = Math.ceil(totalRules / pageSize);

  // Helper functions
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

  // Fetch species info for a rule
  const fetchSpeciesInfo = async (taxonKey: number) => {
    if (speciesCache.has(taxonKey)) {
      return speciesCache.get(taxonKey);
    }

    try {
      const data = await getSpeciesInfo(taxonKey);
      if (data) {
        setSpeciesCache(prev => new Map(prev).set(taxonKey, data));
        return data;
      }
    } catch (error) {
      console.error('Error fetching species info:', error);
    }
    return null;
  };

  // Filtered rules (client-side filtering on current page)
  const filteredRules = useMemo(() => {
    let filtered = rules;

    if (speciesFilter) {
      filtered = filtered.filter(rule => 
        rule.taxonKey === speciesFilter.key
      );
    }

    return filtered;
  }, [rules, speciesFilter]);

  useEffect(() => {
    const fetchUserRules = async () => {
      if (!username) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch all rules (API currently returns all rules as array)
        const response = await fetch(
          `http://localhost:8080/occurrence/experimental/annotation/rule?createdBy=${encodeURIComponent(username)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch rules: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Store all rules for client-side pagination
          setAllRules(data);
          setTotalRules(data.length);
        } else {
          setAllRules([]);
          setTotalRules(0);
        }
      } catch (err) {
        console.error('Error fetching user rules:', err);
        setError(err instanceof Error ? err.message : 'Failed to load user rules');
        toast.error('Failed to load user rules');
      } finally {
        setLoading(false);
      }
    };

    // Only fetch data when username changes
    fetchUserRules();
  }, [username]);

  // Handle pagination - slice data when page changes
  useEffect(() => {
    if (allRules.length > 0) {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      setRules(allRules.slice(startIndex, endIndex));
    }
  }, [allRules, currentPage, pageSize]);

  // Prefetch species info for visible rules
  useEffect(() => {
    rules.forEach(rule => {
      if (rule.taxonKey && !speciesCache.has(rule.taxonKey)) {
        fetchSpeciesInfo(rule.taxonKey);
      }
    });
  }, [rules, speciesCache, fetchSpeciesInfo]);

  const handleViewRule = (rule: UserRule) => {
    if (onNavigateToRule) {
      onNavigateToRule(rule);
    } else {
      // Fallback: navigate to main app with rule context
      window.location.href = `/`;
    }
  };

  const handleViewRuleAPI = (ruleId: number) => {
    window.open(`http://localhost:8080/occurrence/experimental/annotation/rule/${ruleId}`, '_blank');
  };

  const handleDeleteRule = async (ruleId: number) => {
    console.log('Attempting to delete rule:', ruleId);
    
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to delete annotation rules');
      return;
    }
    
    try {
      const response = await fetch(
        getAnnotationApiUrl(`/rule/${ruleId}`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${gbifAuth}`,
          },
        }
      );

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Authentication failed. Please login again.');
          return;
        } else if (response.status === 403) {
          toast.error('You do not have permission to delete this rule.');
          return;
        }
        throw new Error(`Failed to delete rule: ${response.status} ${response.statusText}`);
      }

      console.log('Rule deleted successfully, updating local state');
      
      // Remove the rule from local state
      setAllRules(prevRules => {
        const newRules = prevRules.filter(rule => rule.id !== ruleId);
        
        // Update total count
        setTotalRules(newRules.length);
        
        // Check if current page will be empty after deletion
        const newTotalPages = Math.ceil(newRules.length / pageSize);
        if (currentPage > newTotalPages && newTotalPages > 0) {
          // Move to the last available page
          setCurrentPage(newTotalPages);
        }
        
        return newRules;
      });
      
      toast.success('Rule deleted successfully');
    } catch (err) {
      console.error('Error deleting rule:', err);
      toast.error('Failed to delete rule');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Keep filters active when changing pages
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis-start');
      }
      
      // Show current page and surrounding pages
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis-end');
      }
      
      // Always show last page if there are multiple pages
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="p-6 border-b bg-white">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Map
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Rules</h1>
              <p className="text-gray-600">Loading rules for {username}...</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading rules...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col">
        <div className="p-6 border-b bg-white">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Map
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">User Rules</h1>
              <p className="text-gray-600">Error loading rules for {username}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Rules</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Map
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{username}</h1>
                <p className="text-gray-600">
                  {totalRules > 0 ? (
                    <>
                      {filteredRules.length} of {Math.min(rules.length, pageSize)} rules on page {currentPage}
                      {totalRules > pageSize && ` (${totalRules} total)`}
                      {speciesFilter ? ' (filtered)' : ''}
                    </>
                  ) : (
                    'No rules found'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Filters in header */}
        <div className="px-6 pb-3">
          <UserPageFilters
            speciesFilter={speciesFilter}
            onSpeciesFilterChange={setSpeciesFilter}
          />
        </div>
      </div>

      {/* Rules Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredRules.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {rules.length === 0 ? 'No Rules Found' : 'No Matching Rules'}
            </h2>
            <p className="text-gray-600 max-w-md mx-auto">
              {rules.length === 0 
                ? `${username} hasn't created any annotation rules yet. Rules will appear here once they start creating them.`
                : 'No rules match your current filters. Try adjusting or clearing the filters above.'
              }
            </p>
          </div>
        ) : (
          <div className="max-w-full mx-auto">
            <div className="bg-white rounded-lg border shadow-sm mb-8">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule ID</TableHead>
                    <TableHead>TaxonKey</TableHead>
                    <TableHead>Species</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>Annotation</TableHead>
                    <TableHead>Geometry</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => {
                    const speciesInfo = rule.taxonKey ? speciesCache.get(rule.taxonKey) : null;
                    
                    return (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="font-medium">#{rule.id}</div>
                        </TableCell>
                        
                        <TableCell>
                          {rule.taxonKey ? (
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                speciesFilter?.key === rule.taxonKey 
                                  ? 'bg-blue-100 text-blue-800 border-blue-200' 
                                  : ''
                              }`}
                            >
                              {rule.taxonKey}
                            </Badge>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {rule.taxonKey ? (
                            <div className="space-y-1">
                              {speciesInfo ? (
                                <>
                                  <div className="italic text-gray-900">{speciesInfo.scientificName}</div>
                                  {speciesInfo.vernacularName && (
                                    <div className="text-sm text-gray-600">{speciesInfo.vernacularName}</div>
                                  )}
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Loading...
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">No species</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          {rule.taxonKey && speciesInfo?.rank ? (
                            <Badge variant="outline" className="text-xs">
                              {speciesInfo.rank}
                            </Badge>
                          ) : rule.taxonKey && !speciesInfo ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={getAnnotationColor(rule.annotation)}
                          >
                            {rule.annotation || 'Unknown'}
                          </Badge>
                          {rule.deleted && (
                            <div className="text-xs text-red-600 mt-1">Deleted</div>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm text-gray-600">
                            {getGeometryDescription(rule.geometry)}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="text-sm text-gray-600">
                            {formatDate(rule.created)}
                          </div>
                          {rule.deleted && (
                            <div className="text-xs text-red-600 mt-1">
                              Deleted: {formatDate(rule.deleted)}
                            </div>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewRule(rule)}
                              title="View on Map"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            {!rule.deleted && (
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
                                      onClick={() => handleDeleteRule(rule.id)}
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
                              onClick={() => handleViewRuleAPI(rule.id)}
                              title="View rule details in API"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {getPageNumbers().map((pageNum, index) => (
                      <PaginationItem key={index}>
                        {pageNum === 'ellipsis-start' || pageNum === 'ellipsis-end' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => handlePageChange(pageNum as number)}
                            isActive={pageNum === currentPage}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}