import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog';
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
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Loader2, BookOpen, Plus, Pencil, Trash2, RotateCcw, Lock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { getAnnotationApiUrl } from '../utils/apiConfig';

interface VocabularyTerm {
  term: string;
  description?: string;
  color: string;
  locked: boolean;
}

interface VocabularyManagerProps {
  projectId: number;
  isUserMember: boolean;
}

const DEFAULT_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue  
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ef4444', // red
  '#6b7280', // gray
  '#ec4899', // pink
  '#eab308', // yellow
  '#8b5cf6', // violet
];

export function VocabularyManager({ projectId, isUserMember }: VocabularyManagerProps) {
  const [vocabulary, setVocabulary] = useState<VocabularyTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCustom, setIsCustom] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTerm, setEditTerm] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#22c55e');
  const [isSaving, setIsSaving] = useState(false);

  // Add dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTerm, setNewTerm] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState('#22c55e');

  useEffect(() => {
    fetchVocabulary();
  }, [projectId]);

  const fetchVocabulary = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        getAnnotationApiUrl(`/project/${projectId}/vocabulary`)
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch vocabulary');
      }
      
      const data = await response.json();
      setVocabulary(data);
      
      // Check if project has custom vocabulary by fetching project details
      const projectResponse = await fetch(
        getAnnotationApiUrl(`/project/${projectId}`)
      );
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        setIsCustom(projectData.customVocabulary !== null);
      }
    } catch (error) {
      console.error('Error fetching vocabulary:', error);
      toast.error('Failed to load vocabulary');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTerm = async () => {
    if (!newTerm.trim()) {
      toast.error('Term name is required');
      return;
    }

    // Check for duplicate terms (case-insensitive)
    if (vocabulary.some(t => t.term.toUpperCase() === newTerm.trim().toUpperCase())) {
      toast.error('A term with this name already exists');
      return;
    }

    // Check max limit
    if (vocabulary.length >= 50) {
      toast.error('Maximum 50 terms allowed');
      return;
    }

    try {
      setIsSaving(true);
      const newTermData: VocabularyTerm = {
        term: newTerm.trim().toUpperCase(),
        color: newColor,
        locked: false,
      };
      
      // Only add description if it's not empty
      if (newDescription.trim()) {
        newTermData.description = newDescription.trim();
      }
      
      const updatedVocabulary = [...vocabulary, newTermData];

      console.log('Adding term to vocabulary:', {
        projectId,
        newTerm: newTermData.term,
        vocabularyLength: updatedVocabulary.length,
        hasSuspicious: updatedVocabulary.some(t => t.term === 'SUSPICIOUS'),
        suspiciousLocked: updatedVocabulary.find(t => t.term === 'SUSPICIOUS')?.locked
      });

      const gbifAuth = localStorage.getItem('gbifAuth');
      if (!gbifAuth) {
        toast.error('Please log in to add vocabulary terms');
        return;
      }

      const response = await fetch(
        getAnnotationApiUrl(`/project/${projectId}/vocabulary`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${gbifAuth}`,
          },
          body: JSON.stringify(updatedVocabulary),
        }
      );

      if (!response.ok) {
        let errorMessage = `Failed to add term (${response.status})`;
        try {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        } catch (e) {
          // Ignore parsing errors
        }
        console.error('Vocabulary update failed:', {
          status: response.status,
          statusText: response.statusText,
          projectId,
          vocabularyLength: updatedVocabulary.length,
          newTerm: newTerm.trim().toUpperCase()
        });
        throw new Error(errorMessage);
      }

      try {
        const data = await response.json();
        console.log('Vocabulary update successful, received:', {
          termCount: data.length,
          terms: data.map((t: VocabularyTerm) => t.term),
          newTermIncluded: data.some((t: VocabularyTerm) => t.term === newTerm.trim().toUpperCase())
        });
        
        setVocabulary(data);
        setIsCustom(true);
        setIsAddDialogOpen(false);
        setNewTerm('');
        setNewDescription('');
        setNewColor('#22c55e');
        toast.success('Term added successfully');
        console.log('State updates complete, dialog should close');
      } catch (parseError: any) {
        console.error('Error parsing successful response:', parseError);
        toast.error('Response parsing failed: ' + parseError.message);
        throw parseError;
      }
    } catch (error: any) {
      console.error('Error adding term:', error);
      toast.error(error.message || 'Failed to add term');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTerm = (index: number) => {
    const term = vocabulary[index];
    setEditingIndex(index);
    setEditTerm(term.term);
    setEditDescription(term.description || '');
    setEditColor(term.color);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTerm.trim()) {
      toast.error('Term name is required');
      return;
    }

    // Check for duplicate terms (excluding current term)
    if (vocabulary.some((t, i) => 
      i !== editingIndex && t.term.toUpperCase() === editTerm.trim().toUpperCase()
    )) {
      toast.error('A term with this name already exists');
      return;
    }

    try {
      setIsSaving(true);
      const gbifAuth = localStorage.getItem('gbifAuth');
      if (!gbifAuth) {
        toast.error('Please log in to edit vocabulary terms');
        return;
      }

      const updatedVocabulary = vocabulary.map((term, i) => {
        if (i === editingIndex) {
          const updatedTerm: VocabularyTerm = {
            ...term,
            term: editTerm.trim().toUpperCase(),
            color: editColor,
          };
          // Only add description if it's not empty
          if (editDescription.trim()) {
            updatedTerm.description = editDescription.trim();
          } else {
            delete updatedTerm.description;
          }
          return updatedTerm;
        }
        return term;
      });

      const response = await fetch(
        getAnnotationApiUrl(`/project/${projectId}/vocabulary`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${gbifAuth}`,
          },
          body: JSON.stringify(updatedVocabulary),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update term');
      }

      const data = await response.json();
      setVocabulary(data);
      setIsEditDialogOpen(false);
      setEditingIndex(null);
      toast.success('Term updated successfully');
    } catch (error: any) {
      console.error('Error updating term:', error);
      toast.error(error.message || 'Failed to update term');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTerm = async (index: number) => {
    const term = vocabulary[index];
    
    if (term.locked) {
      toast.error('Cannot delete locked term (SUSPICIOUS)');
      return;
    }

    try {
      setIsSaving(true);
      const gbifAuth = localStorage.getItem('gbifAuth');
      if (!gbifAuth) {
        toast.error('Please log in to delete vocabulary terms');
        return;
      }

      const updatedVocabulary = vocabulary.filter((_, i) => i !== index);

      const response = await fetch(
        getAnnotationApiUrl(`/project/${projectId}/vocabulary`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${gbifAuth}`,
          },
          body: JSON.stringify(updatedVocabulary),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to delete term');
      }

      const data = await response.json();
      setVocabulary(data);
      toast.success('Term deleted successfully');
    } catch (error: any) {
      console.error('Error deleting term:', error);
      toast.error(error.message || 'Failed to delete term');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    try {
      setIsSaving(true);
      const gbifAuth = localStorage.getItem('gbifAuth');
      if (!gbifAuth) {
        toast.error('Please log in to reset vocabulary');
        setIsSaving(false);
        return;
      }

      const response = await fetch(
        getAnnotationApiUrl(`/project/${projectId}/vocabulary`),
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${gbifAuth}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reset vocabulary');
      }

      const data = await response.json();
      setVocabulary(data);
      setIsCustom(false);
      toast.success('Vocabulary reset to default');
    } catch (error) {
      console.error('Error resetting vocabulary:', error);
      toast.error('Failed to reset vocabulary');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Project Vocabulary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Project Vocabulary
                {isCustom && (
                  <Badge variant="secondary" className="ml-2">
                    Custom
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isCustom 
                  ? 'Custom terms for this project'
                  : 'Default GBIF annotation terms (click "Add Term" to customize)'}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          {isUserMember && (
            <div className="flex gap-2 mb-4">
              {isCustom && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isSaving}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset to Default
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset to Default Vocabulary?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all custom terms and restore the default GBIF project vocabulary. 
                        Existing rules will not be affected, but you won't be able to create new rules with custom terms.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetToDefault}>
                        Reset to Default
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    disabled={vocabulary.length >= 50 || isSaving}
                    title={vocabulary.length >= 50 ? 'Maximum 50 terms reached' : 'Add a new term'}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Term
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Vocabulary Term</DialogTitle>
                    <DialogDescription>
                      Create a new annotation term for this project. Maximum 50 terms allowed.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="term">Term Name *</Label>
                      <Input
                        id="term"
                        value={newTerm}
                        onChange={(e) => setNewTerm(e.target.value)}
                        placeholder="e.g., INVASIVE"
                        maxLength={50}
                      />
                      <p className="text-xs text-gray-500">
                        Will be converted to uppercase. Must be unique.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Optional description"
                        rows={2}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="color">Color</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          id="color"
                          type="color"
                          value={newColor}
                          onChange={(e) => setNewColor(e.target.value)}
                          className="w-20 h-10"
                        />
                        <span className="text-sm text-gray-600">{newColor}</span>
                        <div className="flex gap-1 ml-auto">
                          {DEFAULT_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => setNewColor(color)}
                              className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                              style={{ 
                                backgroundColor: color,
                                borderColor: newColor === color ? '#000' : '#ddd'
                              }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAddTerm} disabled={isSaving || !newTerm.trim()}>
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add Term'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
          
        {!isCustom && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Using Default Vocabulary</p>
              <p className="text-blue-700">
                SUSPICIOUS term is always required and locked. Click "Add Term" to create custom terms for your project.
              </p>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          {vocabulary.map((term, index) => (
            <div
              key={term.term}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-4 h-4 rounded flex-shrink-0"
                  style={{ backgroundColor: term.color }}
                  title={term.color}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{term.term}</span>
                    {term.locked && (
                      <Lock className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                  {term.description && (
                    <p className="text-xs text-gray-600 truncate">{term.description}</p>
                  )}
                </div>
              </div>
              
              {isUserMember && (
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditTerm(index)}
                    disabled={term.locked || isSaving}
                    title={term.locked ? 'Cannot edit locked term' : 'Edit term'}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={term.locked || isSaving}
                        title={term.locked ? 'Cannot delete locked term' : 'Delete term'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Term "{term.term}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the term from your vocabulary. Existing rules using this term will not be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteTerm(index)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {vocabulary.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No vocabulary terms available
          </p>
        )}
        
        <div className="mt-4 pt-4 border-t text-xs text-gray-500">
          <p className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            SUSPICIOUS term is required and cannot be modified or deleted
          </p>
          <p className="mt-1">
            {vocabulary.length} / 50 terms used
          </p>
        </div>
        </CardContent>
      )}
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Vocabulary Term</DialogTitle>
            <DialogDescription>
              Update the term details. The term name will be converted to uppercase.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-term">Term Name *</Label>
              <Input
                id="edit-term"
                value={editTerm}
                onChange={(e) => setEditTerm(e.target.value)}
                placeholder="e.g., INVASIVE"
                maxLength={50}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-color">Color</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="edit-color"
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-20 h-10"
                />
                <span className="text-sm text-gray-600">{editColor}</span>
                <div className="flex gap-1 ml-auto">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                      style={{ 
                        backgroundColor: color,
                        borderColor: editColor === color ? '#000' : '#ddd'
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editTerm.trim()}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
