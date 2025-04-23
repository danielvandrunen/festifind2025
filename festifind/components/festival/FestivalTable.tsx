import { useState, useMemo } from "react";
import { 
  HeartIcon, 
  ArchiveIcon, 
  ExternalLinkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  Save,
  X,
  FileTextIcon
} from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export interface Festival {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: {
    city: string;
    country: string;
  };
  source: {
    name: string;
    url: string;
  };
  isFavorite: boolean;
  isArchived: boolean;
  notes: string;
}

type SortField = 'name' | 'date' | 'location' | 'source';
type SortDirection = 'asc' | 'desc';

interface FestivalTableProps {
  festivals: Festival[];
  onFavoriteToggle?: (festivalId: string, isFavorite: boolean) => void;
  onArchiveToggle?: (festivalId: string, isArchived: boolean) => void;
  onNoteChange?: (festivalId: string, note: string) => void;
}

export default function FestivalTable({
  festivals,
  onFavoriteToggle,
  onArchiveToggle,
  onNoteChange
}: FestivalTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // For optimistic UI updates
  const [optimisticNotes, setOptimisticNotes] = useState<Record<string, string>>({});
  const [optimisticFavorites, setOptimisticFavorites] = useState<Record<string, boolean>>({});
  const [optimisticArchived, setOptimisticArchived] = useState<Record<string, boolean>>({});
  
  // Track which festivals have their notes editor open
  const [editingNotes, setEditingNotes] = useState<Record<string, boolean>>({});
  // Keep track of current note content while editing
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({});

  // Sort festivals based on current sort field and direction
  const sortedFestivals = useMemo(() => {
    return [...festivals].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case 'location':
          comparison = a.location.city.localeCompare(b.location.city);
          break;
        case 'source':
          comparison = a.source.name.localeCompare(b.source.name);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [festivals, sortField, sortDirection]);

  // Handle column header click to change sort
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle opening notes editor
  const handleEditNotes = (festival: Festival) => {
    const currentNote = optimisticNotes[festival.id] ?? festival.notes;
    setNoteEdits({
      ...noteEdits,
      [festival.id]: currentNote
    });
    setEditingNotes({
      ...editingNotes,
      [festival.id]: true
    });
  };

  // Handle canceling notes edit
  const handleCancelNoteEdit = (festivalId: string) => {
    setEditingNotes({
      ...editingNotes,
      [festivalId]: false
    });
  };

  // Handle saving a note with optimistic UI
  const handleNoteSave = (festivalId: string) => {
    if (onNoteChange) {
      const noteContent = noteEdits[festivalId] || '';
      
      // Optimistic update
      setOptimisticNotes(prev => ({
        ...prev,
        [festivalId]: noteContent
      }));
      
      // Close editor
      setEditingNotes({
        ...editingNotes,
        [festivalId]: false
      });
      
      // Call API
      onNoteChange(festivalId, noteContent);
      
      // Show toast
      toast.success("Note saved", {
        description: "Your note has been updated."
      });
    }
  };
  
  // Handle favorite toggle with optimistic UI
  const handleFavoriteToggle = (festival: Festival) => {
    if (!onFavoriteToggle) return;
    
    const newStatus = !(optimisticFavorites[festival.id] ?? festival.isFavorite);
    
    // Optimistic update
    setOptimisticFavorites(prev => ({
      ...prev,
      [festival.id]: newStatus
    }));
    
    // Call API
    onFavoriteToggle(festival.id, newStatus);
    
    // Show toast
    if (newStatus) {
      toast.success("Added to favorites");
    }
  };
  
  // Handle archive toggle with optimistic UI
  const handleArchiveToggle = (festival: Festival) => {
    if (!onArchiveToggle) return;
    
    const newStatus = !(optimisticArchived[festival.id] ?? festival.isArchived);
    
    // Optimistic update
    setOptimisticArchived(prev => ({
      ...prev,
      [festival.id]: newStatus
    }));
    
    // Call API
    onArchiveToggle(festival.id, newStatus);
    
    // Show toast
    if (newStatus) {
      toast.info("Festival archived");
    } else {
      toast.info("Festival unarchived");
    }
  };

  // Format date range
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Same month
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')} (${getDurationDays(start, end)} days)`;
    }
    
    // Same year
    if (start.getFullYear() === end.getFullYear()) {
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')} (${getDurationDays(start, end)} days)`;
    }
    
    // Different year
    return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')} (${getDurationDays(start, end)} days)`;
  };
  
  // Calculate duration in days
  const getDurationDays = (start: Date, end: Date) => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead 
            className="cursor-pointer hover:bg-gray-50 min-w-[200px] w-1/6" 
            onClick={() => handleSort('name')}
          >
            <div className="flex items-center">
              Name
              {sortField === 'name' && (
                sortDirection === 'asc' 
                  ? <ChevronUpIcon className="h-4 w-4 ml-1" /> 
                  : <ChevronDownIcon className="h-4 w-4 ml-1" />
              )}
            </div>
          </TableHead>
          <TableHead 
            className="cursor-pointer hover:bg-gray-50 w-1/6" 
            onClick={() => handleSort('date')}
          >
            <div className="flex items-center">
              Date
              {sortField === 'date' && (
                sortDirection === 'asc' 
                  ? <ChevronUpIcon className="h-4 w-4 ml-1" /> 
                  : <ChevronDownIcon className="h-4 w-4 ml-1" />
              )}
            </div>
          </TableHead>
          <TableHead 
            className="cursor-pointer hover:bg-gray-50 w-1/6" 
            onClick={() => handleSort('location')}
          >
            <div className="flex items-center">
              Location
              {sortField === 'location' && (
                sortDirection === 'asc' 
                  ? <ChevronUpIcon className="h-4 w-4 ml-1" /> 
                  : <ChevronDownIcon className="h-4 w-4 ml-1" />
              )}
            </div>
          </TableHead>
          <TableHead 
            className="cursor-pointer hover:bg-gray-50 w-1/6" 
            onClick={() => handleSort('source')}
          >
            <div className="flex items-center">
              Source
              {sortField === 'source' && (
                sortDirection === 'asc' 
                  ? <ChevronUpIcon className="h-4 w-4 ml-1" /> 
                  : <ChevronDownIcon className="h-4 w-4 ml-1" />
              )}
            </div>
          </TableHead>
          <TableHead className="w-1/6">Notes</TableHead>
          <TableHead className="text-right w-[120px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedFestivals.map(festival => {
          // Get optimistic states if available
          const isFavorite = optimisticFavorites[festival.id] ?? festival.isFavorite;
          const isArchived = optimisticArchived[festival.id] ?? festival.isArchived;
          const noteContent = optimisticNotes[festival.id] ?? festival.notes;
          const hasNotes = noteContent && noteContent.trim() !== '';
          const isEditing = editingNotes[festival.id] ?? false;
          
          return (
            <TableRow 
              key={festival.id}
              className={isArchived ? "opacity-60 bg-gray-50" : ""}
            >
              <TableCell className="font-medium">{festival.name}</TableCell>
              <TableCell>{formatDateRange(festival.startDate, festival.endDate)}</TableCell>
              <TableCell>{`${festival.location.city}, ${festival.location.country}`}</TableCell>
              <TableCell>{festival.source.name}</TableCell>
              <TableCell>
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea 
                      value={noteEdits[festival.id] || ''}
                      onChange={(e) => setNoteEdits({
                        ...noteEdits,
                        [festival.id]: e.target.value
                      })}
                      placeholder="Add your notes here..."
                      className="min-h-[80px] text-sm"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCancelNoteEdit(festival.id)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                      <Button 
                        type="button"
                        size="sm"
                        onClick={() => handleNoteSave(festival.id)}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : hasNotes ? (
                  <div 
                    className="text-sm text-gray-600 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    onClick={() => handleEditNotes(festival)}
                  >
                    <div className="flex items-start gap-2">
                      <FileTextIcon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="line-clamp-2 whitespace-pre-wrap">{noteContent}</div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleEditNotes(festival)}
                    className="text-gray-400 hover:text-blue-500 text-sm flex items-center p-2 rounded hover:bg-gray-50 w-full justify-center"
                  >
                    <FileTextIcon className="h-4 w-4 mr-1" />
                    Add notes
                  </button>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end items-center space-x-2">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleFavoriteToggle(festival)}
                    className={isFavorite ? "text-red-500" : "text-gray-400 hover:text-red-400"}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <HeartIcon className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleArchiveToggle(festival)}
                    className={isArchived ? "text-blue-500" : "text-gray-400 hover:text-blue-400"}
                    title={isArchived ? "Unarchive" : "Archive"}
                  >
                    <ArchiveIcon className="w-5 h-5" />
                  </Button>
                  
                  <a 
                    href={festival.source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-500 hover:text-blue-700"
                    title="Visit source website"
                  >
                    <ExternalLinkIcon className="w-4 h-4" />
                  </a>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
} 