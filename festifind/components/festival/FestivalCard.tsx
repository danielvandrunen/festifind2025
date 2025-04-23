import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, MapPin, Heart, Archive, ExternalLink, Save, X, FileTextIcon, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FestivalWithPreferences } from "@/types/festival";
import { toast } from "sonner";

interface FestivalCardProps {
  festival: FestivalWithPreferences;
  onFavoriteToggle?: (festivalId: string, isFavorite: boolean) => void;
  onArchiveToggle?: (festivalId: string, isArchived: boolean) => void;
  onNoteChange?: (festivalId: string, note: string) => void;
}

export default function FestivalCard({
  festival,
  onFavoriteToggle,
  onArchiveToggle,
  onNoteChange
}: FestivalCardProps) {
  const {
    id,
    name,
    startDate,
    endDate,
    location,
    source,
    isFavorite,
    isArchived,
    notes
  } = festival;

  // State for editing notes
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [noteContent, setNoteContent] = useState(notes);
  // For optimistic UI update
  const [displayedNotes, setDisplayedNotes] = useState(notes);

  // Format date function
  const formatDateRange = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Same month and year
    if (
      start.getMonth() === end.getMonth() && 
      start.getFullYear() === end.getFullYear()
    ) {
      return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
    }
    
    // Same year
    if (start.getFullYear() === end.getFullYear()) {
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    
    // Different years
    return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
  };

  // Handle favorite toggle
  const handleFavoriteToggle = () => {
    if (onFavoriteToggle) {
      onFavoriteToggle(id, !isFavorite);
    }
  };

  // Handle archive toggle
  const handleArchiveToggle = () => {
    if (onArchiveToggle) {
      onArchiveToggle(id, !isArchived);
    }
  };

  // Handle edit notes click
  const handleEditNotes = () => {
    setNoteContent(displayedNotes);
    setIsEditingNotes(true);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditingNotes(false);
  };

  // Handle save notes
  const handleSaveNotes = () => {
    if (onNoteChange) {
      // Optimistic update
      setDisplayedNotes(noteContent);
      setIsEditingNotes(false);
      
      // Call API
      onNoteChange(id, noteContent);
      
      // Show toast
      toast.success("Note saved");
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow 
      ${isArchived ? 'opacity-70 bg-gray-50' : 'bg-white'}`}>
      {/* Festival image or placeholder */}
      <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 relative">
        {isFavorite && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="bg-white/90 text-red-500 font-semibold">
              <Heart className="h-3 w-3 mr-1 fill-current" />
              Favorite
            </Badge>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-xl mb-2 line-clamp-1">{name}</h3>
        
        <div className="space-y-2 mb-3">
          <div className="flex items-center text-gray-600">
            <CalendarDays className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{formatDateRange()}</span>
          </div>
          
          <div className="flex items-center text-gray-600">
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{`${location.city}, ${location.country}`}</span>
          </div>
        </div>
        
        {/* Notes section */}
        <div className="mt-3 border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium flex items-center text-gray-700">
              <FileTextIcon className="h-3 w-3 mr-1" />
              Notes
            </h4>
            {!isEditingNotes && (
              <button
                onClick={handleEditNotes}
                className="text-xs text-blue-500 hover:text-blue-700 flex items-center"
              >
                <Edit className="h-3 w-3 mr-1" />
                {displayedNotes ? 'Edit' : 'Add'}
              </button>
            )}
          </div>
          
          {isEditingNotes ? (
            <div className="space-y-2">
              <Textarea 
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add your notes here..."
                className="min-h-[80px] text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-1">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={handleCancelEdit}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
                <Button 
                  type="button"
                  size="sm"
                  onClick={handleSaveNotes}
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ) : displayedNotes ? (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded max-h-24 overflow-y-auto">
              <p className="whitespace-pre-wrap line-clamp-3">{displayedNotes}</p>
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic p-2 bg-gray-50 rounded text-center">
              No notes added
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="mt-4 pt-3 border-t flex justify-between items-center">
          <div className="flex space-x-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleFavoriteToggle}
              className={isFavorite ? "text-red-500" : "text-gray-500"}
            >
              <Heart className={`h-4 w-4 mr-1 ${isFavorite ? "fill-current" : ""}`} />
              {isFavorite ? "Favorited" : "Favorite"}
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleArchiveToggle}
              className={isArchived ? "text-blue-500" : "text-gray-500"}
            >
              <Archive className="h-4 w-4 mr-1" />
              {isArchived ? "Archived" : "Archive"}
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            asChild
          >
            <a 
              href={source.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Visit
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
} 