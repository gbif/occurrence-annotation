import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowLeft, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { UserRuleCard } from './UserRuleCard';
import { UserPageFilters } from './UserPageFilters';
import { SelectedSpecies } from './SpeciesSelector';
import { getAnnotationApiUrl } from '../utils/apiConfig';
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

interface UserPageProps {
  onNavigateToRule?: (rule: UserRule) => void;
}

export function UserPage({ onNavigateToRule }: UserPageProps) {
  const { username } = useParams<{ username: string }>();
  const [rules, setRules] = useState<UserRule[]>([]);
  const [allRules, setAllRules] = useState<UserRule[]>([]); // Store all rules for client-side pagination
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRules, setTotalRules] = useState(0);
  const [pageSize] = useState(20);

  // Filter states
  const [speciesFilter, setSpeciesFilter] = useState<SelectedSpecies | null>(null);

  // Calculate pagination values
  const totalPages = Math.ceil(totalRules / pageSize);

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

  const handleViewRule = (rule: UserRule) => {
    if (onNavigateToRule) {
      onNavigateToRule(rule);
    } else {
      // Fallback: navigate to main app with rule context
      window.location.href = `/`;
    }
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
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredRules.map((rule) => (
                <UserRuleCard
                  key={rule.id}
                  rule={rule}
                  onViewRule={handleViewRule}
                  onDeleteRule={handleDeleteRule}
                  highlightTaxonKey={speciesFilter?.key}
                />
              ))}
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