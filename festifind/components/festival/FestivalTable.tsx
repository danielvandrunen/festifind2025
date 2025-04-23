import { useState, useMemo } from "react";
import { 
  HeartIcon, 
  ArchiveIcon, 
  ExternalLinkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PencilIcon
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [noteContent, setNoteContent] = useState<string>("");
  const [activeFestivalId, setActiveFestivalId] = useState<string | null>(null);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  
  // For optimistic UI updates
  const [optimisticNotes, setOptimisticNotes] = useState<Record<string, string>>({});
  const [optimisticFavorites, setOptimisticFavorites] = useState<Record<string, boolean>>({});
  const [optimisticArchived, setOptimisticArchived] = useState<Record<string, boolean>>({});

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

  // Handle opening note dialog
  const handleNoteOpen = (festival: Festival) => {
    const currentNote = optimisticNotes[festival.id] ?? festival.notes;
    setNoteContent(currentNote);
    setActiveFestivalId(festival.id);
    setIsNoteDialogOpen(true);
  };

  // Handle saving a note with optimistic UI
  const handleNoteSave = () => {
    if (activeFestivalId && onNoteChange) {
      // Optimistic update
      setOptimisticNotes(prev => ({
        ...prev,
        [activeFestivalId]: noteContent
      }));
      
      // Close dialog first for better UX
      setIsNoteDialogOpen(false);
      
      // Call API
      onNoteChange(activeFestivalId, noteContent);
      
      // Show toast
      toast.success("Note saved", {
        description: "Your note has been updated."
      });
      
      setActiveFestivalId(null);
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
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-gray-50 min-w-[200px]" 
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
              className="cursor-pointer hover:bg-gray-50" 
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
              className="cursor-pointer hover:bg-gray-50" 
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
              className="cursor-pointer hover:bg-gray-50" 
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
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFestivals.map(festival => {
            // Get optimistic states if available
            const isFavorite = optimisticFavorites[festival.id] ?? festival.isFavorite;
            const isArchived = optimisticArchived[festival.id] ?? festival.isArchived;
            const noteContent = optimisticNotes[festival.id] ?? festival.notes;
            const hasNotes = noteContent && noteContent.trim() !== '';
            
            return (
              <TableRow 
                key={festival.id}
                className={isArchived ? "opacity-60 bg-gray-50" : ""}
              >
                <TableCell className="font-medium">{festival.name}</TableCell>
                <TableCell>{formatDateRange(festival.startDate, festival.endDate)}</TableCell>
                <TableCell>{`${festival.location.city}, ${festival.location.country}`}</TableCell>
                <TableCell>{festival.source.name}</TableCell>
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
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleNoteOpen(festival)}
                      className={hasNotes ? "text-amber-500" : "text-gray-400 hover:text-amber-400"}
                      title="Edit notes"
                    >
                      <PencilIcon className="w-4 h-4 mr-1" />
                      {hasNotes ? "Notes" : "Add Notes"}
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
      
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {activeFestivalId && 
                `Notes for ${festivals.find(f => f.id === activeFestivalId)?.name}`
              }
            </DialogTitle>
          </DialogHeader>
          <form 
            className="space-y-4" 
            onSubmit={(e) => {
              e.preventDefault();
              handleNoteSave();
            }}
          >
            <Textarea 
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add your notes here..."
              className="min-h-[120px]"
            />
            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsNoteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Notes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
} 