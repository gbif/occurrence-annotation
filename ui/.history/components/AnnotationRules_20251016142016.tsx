import { useState, useEffect, useRef } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle, XCircle, Trash2, ChevronLeft, ChevronRight, MessageSquare, Loader2, Pencil, ThumbsUp, ThumbsDown } from 'lucide-react';
import { parseWKTGeometry, MultiPolygon } from '../utils/wktParser';
import { toast } from 'sonner';
import { SelectedSpecies } from './SpeciesSelector';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
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

export interface RuleComment {
  id: number;
  comment: string;
  created: string;
  createdBy: string;
}

export interface AnnotationRule {
  id: number;
  taxonKey: number;
  datasetKey: string | null;
  geometry: string; // WKT format (POLYGON or MULTIPOLYGON)
  annotation: string;
  rulesetId: number | null;
  projectId: number | null;
  supportedBy: any[];
  contestedBy: any[];
  created: string;
  createdBy: string;
  deleted: string | null;
  deletedBy: string | null;
  // Parsed geometry (can be single or multi polygon)
  multiPolygon?: MultiPolygon;
  // Higher order metadata
  taxonomicLevel?: string;
  scientificName?: string;
}

interface AnnotationRulesProps {
  selectedSpecies: SelectedSpecies | null;
  showHigherOrderRules?: boolean;
  onShowHigherOrderChange?: (show: boolean) => void;
  onRulesLoad?: (rules: AnnotationRule[]) => void;
  onNavigateToPolygon?: (lat: number, lng: number) => void;
  refreshTrigger?: number; // Add this to force refresh when rules are saved
}

export function AnnotationRules({ 
  selectedSpecies, 
  showHigherOrderRules = false,
  onShowHigherOrderChange,
  onRulesLoad,
  onNavigateToPolygon,
  refreshTrigger
}: AnnotationRulesProps) {
  const [rules, setRules] = useState<AnnotationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ userName: string } | null>(null);
  const [comments, setComments] = useState<Map<number, RuleComment[]>>(new Map());
  const [commentCounts, setCommentCounts] = useState<Map<number, number>>(new Map());
  const [loadingComments, setLoadingComments] = useState<Set<number>>(new Set());
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [showInlineCommentForm, setShowInlineCommentForm] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingComments, setDeletingComments] = useState<Set<string>>(new Set());
  
  // Voting state
  const [votingActions, setVotingActions] = useState<Set<string>>(new Set()); // Track ongoing voting actions
  const [userVotes, setUserVotes] = useState<Map<number, 'support' | 'contest' | null>>(new Map()); // Track user's votes per rule
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const pageSize = 20;
  
  const onRulesLoadRef = useRef(onRulesLoad);

  // Keep ref up to date
  useEffect(() => {
    onRulesLoadRef.current = onRulesLoad;
  }, [onRulesLoad]);

  // Check login status and get current user
  useEffect(() => {
    const checkLoginStatus = () => {
      const gbifAuth = localStorage.getItem('gbifAuth');
      const gbifUser = localStorage.getItem('gbifUser');
      
      setIsLoggedIn(!!gbifAuth);
      
      if (gbifUser) {
        try {
          const user = JSON.parse(gbifUser);
          setCurrentUser(user);
        } catch (error) {
          console.error('Error parsing user data:', error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    };
    
    // Check on mount
    checkLoginStatus();
    
    // Listen for storage changes (when user logs in/out in LoginButton)
    window.addEventListener('storage', checkLoginStatus);
    
    // Also check periodically in case login happens in same tab
    const interval = setInterval(checkLoginStatus, 1000);
    
    return () => {
      window.removeEventListener('storage', checkLoginStatus);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedSpecies) {
      setRules([]);
      setError(null);
      onRulesLoadRef.current?.([]);
      return;
    }

    const fetchRules = async (page: number = 0) => {
      setLoading(true);
      setError(null);
      
      try {
        // Collect taxon keys to fetch based on showHigherOrderRules
        const taxonKeys: { key: number; level: string }[] = [];
        
        // Always include the selected species/taxon
        taxonKeys.push({ key: selectedSpecies.key, level: 'selected' });
        
        // Add higher order taxonomic levels if enabled
        if (showHigherOrderRules) {
          if (selectedSpecies.genusKey && selectedSpecies.genusKey !== selectedSpecies.key) {
            taxonKeys.push({ key: selectedSpecies.genusKey, level: 'genus' });
          }
          if (selectedSpecies.familyKey) {
            taxonKeys.push({ key: selectedSpecies.familyKey, level: 'family' });
          }
          if (selectedSpecies.orderKey) {
            taxonKeys.push({ key: selectedSpecies.orderKey, level: 'order' });
          }
          if (selectedSpecies.classKey) {
            taxonKeys.push({ key: selectedSpecies.classKey, level: 'class' });
          }
          if (selectedSpecies.phylumKey) {
            taxonKeys.push({ key: selectedSpecies.phylumKey, level: 'phylum' });
          }
          if (selectedSpecies.kingdomKey) {
            taxonKeys.push({ key: selectedSpecies.kingdomKey, level: 'kingdom' });
          }
        }
        
        // Create mapping from taxon keys to scientific names
        const taxonKeyToScientificName = new Map<number, string>();
        
        // Fetch scientific names for all taxon keys
        const scientificNamePromises = taxonKeys.map(async ({ key, level }) => {
          if (level === 'selected') {
            taxonKeyToScientificName.set(key, selectedSpecies.scientificName);
            return;
          }
          
          try {
            // Fetch the scientific name from GBIF species API
            const response = await fetch(`https://api.gbif.org/v1/species/${key}`);
            if (response.ok) {
              const speciesData = await response.json();
              taxonKeyToScientificName.set(key, speciesData.scientificName || speciesData.canonicalName || 'Unknown taxon');
            } else {
              // Fallback for higher taxonomic levels
              const fallbackName = level === 'genus' 
                ? selectedSpecies.scientificName.split(' ')[0] 
                : `${level.charAt(0).toUpperCase() + level.slice(1)} of ${selectedSpecies.scientificName.split(' ')[0]}`;
              taxonKeyToScientificName.set(key, fallbackName);
            }
          } catch (error) {
            console.error(`Error fetching scientific name for taxon ${key}:`, error);
            const fallbackName = level === 'genus' 
              ? selectedSpecies.scientificName.split(' ')[0] 
              : `${level.charAt(0).toUpperCase() + level.slice(1)} of ${selectedSpecies.scientificName.split(' ')[0]}`;
            taxonKeyToScientificName.set(key, fallbackName);
          }
        });
        
        // Wait for all scientific names to be fetched
        await Promise.all(scientificNamePromises);

        // First, fetch ALL rules for all taxon keys to get the complete dataset
        const allRulesPromises = taxonKeys.map(async ({ key, level }) => {
          const response = await fetch(
            `https://api.gbif.org/v1/occurrence/experimental/annotation/rule?taxonKey=${key}`
          );
          
          if (!response.ok) {
            return [];
          }
          
          const data: AnnotationRule[] = await response.json();
          
          // Add taxonomic level metadata and scientific name
          return data.map(rule => ({
            ...rule,
            taxonomicLevel: level,
            scientificName: taxonKeyToScientificName.get(rule.taxonKey) || 'Unknown taxon',
          }));
        });
        
        const allRulesArrays = await Promise.all(allRulesPromises);
        const allRules = allRulesArrays.flat();
        
        // Remove duplicates by rule ID
        const uniqueRules = Array.from(
          new Map(allRules.map(rule => [rule.id, rule])).values()
        );
        
        // Apply pagination to the complete unique rules list
        const totalRulesCount = uniqueRules.length;
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedRules = uniqueRules.slice(startIndex, endIndex);
        
        // Parse WKT geometry for each paginated rule
        const rulesWithCoords = paginatedRules.map(rule => {
          const multiPolygon = parseWKTGeometry(rule.geometry);
          
          // DEBUG: Log coordinate information for the first few rules
          if (multiPolygon && multiPolygon.polygons && multiPolygon.polygons.length > 0) {
            const firstPolygon = multiPolygon.polygons[0];
            console.log('DEBUG: Annotation Rule Coordinates', {
              ruleId: rule.id,
              annotation: rule.annotation,
              originalWKT: rule.geometry.substring(0, 100) + '...', // First 100 chars
              polygonCount: multiPolygon.polygons.length,
              firstPolygonVertexCount: firstPolygon.outer.length,
              firstThreeVertices: firstPolygon.outer.slice(0, 3),
              hasHoles: firstPolygon.holes.length > 0
            });
          }
          
          return {
            ...rule,
            multiPolygon: multiPolygon || undefined
          };
        });
        
        setRules(rulesWithCoords);
        setTotalCount(totalRulesCount);
        setHasNextPage((page + 1) * pageSize < totalRulesCount);
        onRulesLoadRef.current?.(rulesWithCoords);
        
        // Initialize user votes based on current user being in supported/contested arrays
        if (currentUser?.userName) {
          const newUserVotes = new Map<number, 'support' | 'contest' | null>();
          rulesWithCoords.forEach(rule => {
            if (rule.supportedBy.includes(currentUser.userName)) {
              newUserVotes.set(rule.id, 'support');
            } else if (rule.contestedBy.includes(currentUser.userName)) {
              newUserVotes.set(rule.id, 'contest');
            } else {
              newUserVotes.set(rule.id, null);
            }
          });
          setUserVotes(newUserVotes);
        }
        
        // Fetch comment counts for all rules
        rulesWithCoords.forEach(rule => {
          fetchCommentCount(rule.id);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setRules([]);
        onRulesLoadRef.current?.([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRules(currentPage);
  }, [selectedSpecies, showHigherOrderRules, refreshTrigger, currentPage]);

  // Pagination handlers
  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageReset = () => {
    setCurrentPage(0);
  };

  // Reset page when species or filters change
  useEffect(() => {
    handlePageReset();
  }, [selectedSpecies, showHigherOrderRules]);

  const fetchCommentCount = async (ruleId: number) => {
    // Don't fetch if already have count
    if (commentCounts.has(ruleId)) {
      return;
    }

    try {
      const response = await fetch(
        `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/comment`
      );

      if (!response.ok) {
        return;
      }

      const data: RuleComment[] = await response.json();
      
      setCommentCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data.length);
        return newMap;
      });
      
      // Also cache the comments so we don't need to fetch again
      setComments(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data);
        return newMap;
      });
    } catch (err) {
      console.error('Error fetching comment count:', err);
    }
  };

  const fetchComments = async (ruleId: number) => {
    // Don't fetch if already loading or already have comments
    if (loadingComments.has(ruleId) || comments.has(ruleId)) {
      return;
    }

    setLoadingComments(prev => new Set(prev).add(ruleId));

    try {
      const response = await fetch(
        `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/comment`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }

      const data: RuleComment[] = await response.json();
      
      setComments(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data);
        return newMap;
      });
      
      setCommentCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data.length);
        return newMap;
      });
    } catch (err) {
      console.error('Error fetching comments:', err);
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    }
  };

  const forceRefreshComments = async (ruleId: number) => {
    // Force refresh comments even if already cached
    setLoadingComments(prev => new Set(prev).add(ruleId));

    try {
      const response = await fetch(
        `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/comment`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.status}`);
      }

      const data: RuleComment[] = await response.json();
      
      setComments(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data);
        return newMap;
      });
      
      setCommentCounts(prev => {
        const newMap = new Map(prev);
        newMap.set(ruleId, data.length);
        return newMap;
      });
    } catch (err) {
      console.error('Error refreshing comments:', err);
      toast.error('Failed to refresh comments');
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    }
  };

  const toggleComments = (ruleId: number) => {
    const isOpen = openComments.has(ruleId);
    
    if (!isOpen) {
      // Opening - fetch comments if not already loaded
      fetchComments(ruleId);
      setOpenComments(prev => new Set(prev).add(ruleId));
    } else {
      // Closing
      setOpenComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(ruleId);
        return newSet;
      });
    }
  };

  const handleAddComment = async (ruleId: number) => {
    if (!newComment.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    // Check if user is logged in
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to add comments');
      return;
    }

    try {
      setSubmittingComment(true);

      const response = await fetch(
        `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/comment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${gbifAuth}`,
          },
          body: JSON.stringify({ comment: newComment.trim() }),
        }
      );

      if (!response.ok) {
        let errorMessage = `Failed to add comment (${response.status})`;
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (response.status === 403) {
          errorMessage = 'Permission denied. You may not have access to comment on this rule.';
        } else if (response.status === 404) {
          errorMessage = 'Rule not found.';
        }
        throw new Error(errorMessage);
      }

      toast.success('Comment added successfully');
      
      // Clear the comment input and close inline form
      setNewComment('');
      setShowInlineCommentForm(null);
      
      // Add a small delay to allow server to process the new comment
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force refresh comments to get the latest data
      await forceRefreshComments(ruleId);
    } catch (err) {
      console.error('Error adding comment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add comment';
      toast.error(errorMessage);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (ruleId: number, commentId: number) => {
    // Check if user is logged in
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to delete comments');
      return;
    }

    const commentKey = `${ruleId}-${commentId}`;
    
    try {
      setDeletingComments(prev => new Set(prev).add(commentKey));

      const response = await fetch(
        `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/comment/${commentId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${gbifAuth}`,
          },
        }
      );

      if (!response.ok) {
        let errorMessage = `Failed to delete comment (${response.status})`;
        if (response.status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (response.status === 403) {
          errorMessage = 'Permission denied. You can only delete your own comments.';
        } else if (response.status === 404) {
          errorMessage = 'Comment not found.';
        }
        throw new Error(errorMessage);
      }

      toast.success('Comment deleted successfully');
      
      // Add a small delay to allow server to process the deletion
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force refresh comments to get the latest data
      await forceRefreshComments(ruleId);
    } catch (err) {
      console.error('Error deleting comment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete comment';
      toast.error(errorMessage);
    } finally {
      setDeletingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentKey);
        return newSet;
      });
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    // Check if user is logged in
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) {
      toast.error('Please login to GBIF to delete annotation rules');
      return;
    }

    setDeletingRuleId(ruleId);

    try {
      const response = await fetch(
        `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${gbifAuth}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please check your GBIF credentials');
        } else if (response.status === 403) {
          throw new Error('Forbidden - you may not have permission to delete this rule');
        } else if (response.status === 404) {
          throw new Error('Rule not found');
        } else {
          throw new Error(`Failed to delete rule (${response.status})`);
        }
      }

      // Remove the deleted rule from state
      setRules(prevRules => {
        const updatedRules = prevRules.filter(r => r.id !== ruleId);
        onRulesLoadRef.current?.(updatedRules);
        return updatedRules;
      });

      toast.success('Annotation rule deleted successfully');
    } catch (err) {
      console.error('Error deleting rule:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete annotation rule');
    } finally {
      setDeletingRuleId(null);
    }
  };

  // Helper to get Basic Auth header from GBIF login
  function getBasicAuthHeader() {
    const gbifAuth = localStorage.getItem('gbifAuth');
    if (!gbifAuth) return null;
    return 'Basic ' + gbifAuth;
  }

  // Voting handlers
  const handleVote = async (ruleId: number, action: 'support' | 'contest') => {
    if (!isLoggedIn) {
      toast.error('You must be logged in to vote on rules');
      return;
    }

    const actionKey = `${action}-${ruleId}`;
    setVotingActions(prev => new Set([...prev, actionKey]));

    try {
      const authHeader = getBasicAuthHeader();
      if (!authHeader) {
        throw new Error('No authentication found (username/password missing)');
      }

      console.log('Attempting to vote:', { ruleId, action, authHeader });

      const endpoint = action === 'support' 
        ? `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/support`
        : `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/contest`;

      console.log('API Endpoint:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      console.log('API Response:', { status: response.status, statusText: response.statusText });

      if (response.ok) {
        // Update user vote state
        setUserVotes(prev => new Map(prev.set(ruleId, action)));
        
        // Update rule counts in the rules array
        setRules(prevRules => {
          const updatedRules = prevRules.map(rule => {
            if (rule.id === ruleId) {
              const updatedRule = { ...rule };
              if (action === 'support') {
                updatedRule.supportedBy = [...rule.supportedBy, currentUser?.userName || 'anonymous'];
              } else {
                updatedRule.contestedBy = [...rule.contestedBy, currentUser?.userName || 'anonymous'];
              }
              return updatedRule;
            }
            return rule;
          });
          onRulesLoadRef.current?.(updatedRules);
          return updatedRules;
        });

        toast.success(`Rule ${action === 'support' ? 'supported' : 'contested'} successfully`);
      } else {
        // Get more detailed error information
        let errorMessage = `Failed to ${action} rule (${response.status})`;
        try {
          const errorData = await response.text();
          console.error('API Error Response:', errorData);
          if (errorData) {
            errorMessage += `: ${errorData}`;
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error(`Error ${action}ing rule:`, err);
      toast.error(err instanceof Error ? err.message : `Failed to ${action} rule`);
    } finally {
      setVotingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  };

  const handleRemoveVote = async (ruleId: number, action: 'support' | 'contest') => {
    if (!isLoggedIn) {
      toast.error('You must be logged in to remove votes');
      return;
    }

    const actionKey = `remove-${action}-${ruleId}`;
    setVotingActions(prev => new Set([...prev, actionKey]));

    try {
      const authHeader = getBasicAuthHeader();
      if (!authHeader) {
        throw new Error('No authentication found (username/password missing)');
      }

      const endpoint = action === 'support' 
        ? `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/removeSupport`
        : `https://api.gbif.org/v1/occurrence/experimental/annotation/rule/${ruleId}/removeContest`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update user vote state
        setUserVotes(prev => new Map(prev.set(ruleId, null)));
        
        // Update rule counts in the rules array
        setRules(prevRules => {
          const updatedRules = prevRules.map(rule => {
            if (rule.id === ruleId) {
              const updatedRule = { ...rule };
              const currentUserName = currentUser?.userName || 'anonymous';
              if (action === 'support') {
                updatedRule.supportedBy = rule.supportedBy.filter(user => user !== currentUserName);
              } else {
                updatedRule.contestedBy = rule.contestedBy.filter(user => user !== currentUserName);
              }
              return updatedRule;
            }
            return rule;
          });
          onRulesLoadRef.current?.(updatedRules);
          return updatedRules;
        });

        toast.success(`${action === 'support' ? 'Support' : 'Contest'} removed successfully`);
      } else {
        // Get more detailed error information
        let errorMessage = `Failed to remove ${action} (${response.status})`;
        try {
          const errorData = await response.text();
          console.error('API Error Response:', errorData);
          if (errorData) {
            errorMessage += `: ${errorData}`;
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error(`Error removing ${action}:`, err);
      toast.error(err instanceof Error ? err.message : `Failed to remove ${action}`);
    } finally {
      setVotingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionKey);
        return newSet;
      });
    }
  };

  const getAnnotationIcon = (annotation: string) => {
    switch (annotation.toUpperCase()) {
      case 'SUSPICIOUS':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'CONFIRMED':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getAnnotationColor = (annotation: string) => {
    switch (annotation.toUpperCase()) {
      case 'SUSPICIOUS':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'NATIVE':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'MANAGED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'FORMER':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'VAGRANT':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPolygonStrokeColor = (annotation: string) => {
    switch (annotation.toUpperCase()) {
      case 'SUSPICIOUS':
        return '#dc2626'; // red-600
      case 'NATIVE':
        return '#059669'; // green-600
      case 'MANAGED':
        return '#2563eb'; // blue-600
      case 'FORMER':
        return '#9333ea'; // purple-600
      case 'VAGRANT':
        return '#ea580c'; // orange-600
      default:
        return '#6b7280'; // gray-500
    }
  };

  const getPolygonFillColor = (annotation: string) => {
    switch (annotation.toUpperCase()) {
      case 'SUSPICIOUS':
        return 'rgba(220, 38, 38, 0.1)'; // red with opacity
      case 'NATIVE':
        return 'rgba(5, 150, 105, 0.1)'; // green with opacity
      case 'MANAGED':
        return 'rgba(37, 99, 235, 0.1)'; // blue with opacity
      case 'FORMER':
        return 'rgba(147, 51, 234, 0.1)'; // purple with opacity
      case 'VAGRANT':
        return 'rgba(234, 88, 12, 0.1)'; // orange with opacity
      default:
        return 'rgba(107, 114, 128, 0.1)'; // gray with opacity
    }
  };

  // Calculate center point of a multipolygon
  const calculatePolygonCenter = (multiPolygon: MultiPolygon): [number, number] => {
    const allCoords = multiPolygon.polygons.flatMap(poly => 
      poly.outer // Just use outer ring for center calculation
    );
    
    if (allCoords.length === 0) return [0, 0];
    
    // Calculate centroid
    const sumLat = allCoords.reduce((sum, coord) => sum + coord[0], 0);
    const sumLng = allCoords.reduce((sum, coord) => sum + coord[1], 0);
    
    return [sumLat / allCoords.length, sumLng / allCoords.length];
  };

  const renderPolygonPreview = (multiPolygon: MultiPolygon | undefined, annotation: string, onClick?: () => void) => {
    if (!multiPolygon || multiPolygon.polygons.length === 0) return null;

    // Get all coordinates from all polygons for bounding box
    const allCoords = multiPolygon.polygons.flatMap(poly => 
      [poly.outer, ...poly.holes].flat()
    );
    
    if (allCoords.length === 0) return null;
    
    const lats = allCoords.map(c => c[0]);
    const lngs = allCoords.map(c => c[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding
    const padding = 0.1;
    const latRange = maxLat - minLat;
    const lngRange = maxLng - minLng;
    const range = Math.max(latRange, lngRange);

    const viewMinLat = minLat - range * padding;
    const viewMaxLat = maxLat + range * padding;
    const viewMinLng = minLng - range * padding;
    const viewMaxLng = maxLng + range * padding;

    // Scale coordinates to SVG viewport (60x60)
    const svgSize = 60;
    const scaleCoord = ([lat, lng]: [number, number]): [number, number] => {
      const x = ((lng - viewMinLng) / (viewMaxLng - viewMinLng)) * svgSize;
      const y = ((viewMaxLat - lat) / (viewMaxLat - viewMinLat)) * svgSize;
      return [x, y];
    };

    // Build SVG path for all polygons
    const buildPath = () => {
      let path = '';
      
      // Render each polygon in the multipolygon
      multiPolygon.polygons.forEach(polygonWithHoles => {
        // Outer ring
        const outerScaled = polygonWithHoles.outer.map(scaleCoord);
        path += `M ${outerScaled.map(([x, y]) => `${x},${y}`).join(' L ')} Z `;
        
        // Holes
        polygonWithHoles.holes.forEach(hole => {
          const holeScaled = hole.map(scaleCoord);
          path += `M ${holeScaled.map(([x, y]) => `${x},${y}`).join(' L ')} Z `;
        });
      });
      
      return path;
    };

    return (
      <svg 
        width="60" 
        height="60" 
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className={`border border-gray-200 rounded bg-gray-50 ${onClick ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
        onClick={onClick}
      >
        <path
          d={buildPath()}
          fill={getPolygonFillColor(annotation)}
          stroke={getPolygonStrokeColor(annotation)}
          strokeWidth="1.5"
          fillRule="evenodd"
        />
      </svg>
    );
  };

  if (!selectedSpecies) {
    return (
      <div className="text-gray-500 text-center py-4">
        Select a species to view previous rules
      </div>
    );
  }

  const hasHigherOrderKeys = !!(
    selectedSpecies.genusKey ||
    selectedSpecies.familyKey ||
    selectedSpecies.orderKey ||
    selectedSpecies.classKey ||
    selectedSpecies.phylumKey ||
    selectedSpecies.kingdomKey
  );

  if (loading) {
    return (
      <div className="text-gray-500 text-center py-4">
        Loading annotation rules...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center py-4">
        Error: {error}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="space-y-2">
        {hasHigherOrderKeys && onShowHigherOrderChange && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onShowHigherOrderChange(!showHigherOrderRules)}
            className="w-full text-xs h-8"
          >
            {showHigherOrderRules ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide Higher Order Rules
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show Higher Order Rules
              </>
            )}
          </Button>
        )}
        <div className="text-gray-500 text-center py-4">
          No annotation rules found{showHigherOrderRules ? ' at any taxonomic level' : ' for this taxon'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {hasHigherOrderKeys && onShowHigherOrderChange && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onShowHigherOrderChange(!showHigherOrderRules)}
            className="text-xs h-7 flex-shrink-0"
          >
            {showHigherOrderRules ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide Higherorder
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show Higherorder
              </>
            )}
          </Button>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          {totalCount > pageSize && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 0 || loading}
                className="h-6 w-6 p-0"
                title="Previous page"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNextPage || loading}
                className="h-6 w-6 p-0"
                title="Next page"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
              <span>•</span>
            </>
          )}
          <span>{Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        {rules.map((rule) => {
          return (
            <Card key={rule.id} className="p-3">
              <div className="flex gap-3">
                {/* Polygon preview */}
                {rule.multiPolygon && (
                  <div className="flex-shrink-0">
                    {renderPolygonPreview(rule.multiPolygon, rule.annotation, 
                      onNavigateToPolygon ? () => {
                        const [lat, lng] = calculatePolygonCenter(rule.multiPolygon!);
                        onNavigateToPolygon(lat, lng);
                      } : undefined
                    )}
                  </div>
                )}
                
                {/* Rule details */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getAnnotationIcon(rule.annotation)}
                    <Badge className={getAnnotationColor(rule.annotation)} variant="outline">
                      {rule.annotation}
                    </Badge>
                    {rule.taxonomicLevel && rule.taxonomicLevel !== 'selected' && (
                      <Badge variant="secondary" className="text-xs">
                        {rule.taxonomicLevel}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Rule ID</div>
                      <div className="text-gray-900 truncate">{rule.id}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Taxon Key</div>
                      <div className="text-gray-900 truncate">{rule.taxonKey}</div>
                    </div>
                    {rule.scientificName && (
                      <div className="col-span-2">
                        <div className="text-xs text-gray-400 mb-0.5">Scientific Name</div>
                        <div className="text-gray-900 italic truncate">{rule.scientificName}</div>
                      </div>
                    )}
                    <div className="col-span-2">
                      <div className="text-xs text-gray-400 mb-0.5">Created by</div>
                      <div className="text-gray-900 truncate">{rule.createdBy}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-gray-400 mb-0.5">Date</div>
                      <div className="text-gray-900">
                        {new Date(rule.created).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delete button */}
                <div className="flex-shrink-0">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!isLoggedIn || deletingRuleId === rule.id}
                        className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 disabled:opacity-50"
                        title={!isLoggedIn ? "Login to GBIF to delete rules" : "Delete rule"}
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
                </div>
              </div>

              {/* Comments and voting buttons */}
              <div className="mt-2 pt-2 border-t flex gap-1.5 items-center">
                {/* Voting buttons */}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={userVotes.get(rule.id) === 'support' ? 'default' : 'outline'}
                    disabled={!isLoggedIn || votingActions.has(`support-${rule.id}`) || votingActions.has(`remove-support-${rule.id}`)}
                    className="h-7 px-2 text-xs"
                    title={!isLoggedIn ? "Login to GBIF to vote" : userVotes.get(rule.id) === 'support' ? "Remove support" : "Support this rule"}
                    onClick={() => {
                      if (userVotes.get(rule.id) === 'support') {
                        handleRemoveVote(rule.id, 'support');
                      } else {
                        handleVote(rule.id, 'support');
                      }
                    }}
                  >
                    {votingActions.has(`support-${rule.id}`) || votingActions.has(`remove-support-${rule.id}`) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ThumbsUp className="w-3.5 h-3.5" />
                    )}
                    {rule.supportedBy.length > 0 && (
                      <span className="ml-1">{rule.supportedBy.length}</span>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant={userVotes.get(rule.id) === 'contest' ? 'default' : 'outline'}
                    disabled={!isLoggedIn || votingActions.has(`contest-${rule.id}`) || votingActions.has(`remove-contest-${rule.id}`)}
                    className="h-7 px-2 text-xs"
                    title={!isLoggedIn ? "Login to GBIF to vote" : userVotes.get(rule.id) === 'contest' ? "Remove contest" : "Contest this rule"}
                    onClick={() => {
                      if (userVotes.get(rule.id) === 'contest') {
                        handleRemoveVote(rule.id, 'contest');
                      } else {
                        handleVote(rule.id, 'contest');
                      }
                    }}
                  >
                    {votingActions.has(`contest-${rule.id}`) || votingActions.has(`remove-contest-${rule.id}`) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ThumbsDown className="w-3.5 h-3.5" />
                    )}
                    {rule.contestedBy.length > 0 && (
                      <span className="ml-1">{rule.contestedBy.length}</span>
                    )}
                  </Button>
                </div>

                {/* Separator */}
                <div className="w-px h-6 bg-gray-300" />

                {/* Comment buttons */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleComments(rule.id)}
                  className="relative h-7 w-7 p-0"
                  title={commentCounts.has(rule.id) && commentCounts.get(rule.id)! > 0 
                    ? `View ${commentCounts.get(rule.id)} comment${commentCounts.get(rule.id)! > 1 ? 's' : ''}`
                    : 'View comments'
                  }
                >
                  {loadingComments.has(rule.id) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <MessageSquare className="w-3.5 h-3.5" />
                      {commentCounts.has(rule.id) && commentCounts.get(rule.id)! > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-xs flex items-center justify-center"
                        >
                          {commentCounts.get(rule.id)}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isLoggedIn}
                  className="h-7 w-7 p-0"
                  title={!isLoggedIn ? "Login to GBIF to add comments" : "Add comment"}
                  onClick={() => {
                    if (showInlineCommentForm === rule.id) {
                      setShowInlineCommentForm(null);
                      setNewComment('');
                    } else {
                      setShowInlineCommentForm(rule.id);
                      // Also ensure comments are open to show the form
                      if (!openComments.has(rule.id)) {
                        toggleComments(rule.id);
                      }
                    }
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Comments section */}
              {openComments.has(rule.id) && (
                <div className="mt-2">
                  {/* Inline comment form */}
                  {showInlineCommentForm === rule.id && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Label htmlFor={`comment-${rule.id}`} className="text-sm font-medium text-gray-700 mb-2 block">
                        Add Comment to Rule #{rule.id}
                      </Label>
                      <Textarea
                        id={`comment-${rule.id}`}
                        placeholder="Enter your comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={3}
                        className="mb-2"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAddComment(rule.id)}
                          disabled={submittingComment || !newComment.trim()}
                        >
                          {submittingComment ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            'Add Comment'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowInlineCommentForm(null);
                            setNewComment('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {loadingComments.has(rule.id) ? (
                    <div className="text-center py-2 text-gray-500 text-sm">
                      Loading comments...
                    </div>
                  ) : comments.has(rule.id) && comments.get(rule.id)!.length > 0 ? (
                    <div className="space-y-2">
                      {comments.get(rule.id)!.map((comment) => {
                        const commentKey = `${rule.id}-${comment.id}`;
                        const isCurrentUserComment = currentUser && comment.createdBy === currentUser.userName;
                        const isDeletingThisComment = deletingComments.has(commentKey);
                        
                        return (
                          <div key={comment.id} className="bg-gray-50 rounded p-3 text-sm">
                            <p className="text-gray-800">{comment.comment}</p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>{comment.createdBy}</span>
                                <span>•</span>
                                <span>{new Date(comment.created).toLocaleDateString()}</span>
                              </div>
                              {isCurrentUserComment && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDeleteComment(rule.id, comment.id)}
                                  disabled={isDeletingThisComment}
                                  title="Delete comment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-gray-500 text-sm">
                      No comments yet
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

