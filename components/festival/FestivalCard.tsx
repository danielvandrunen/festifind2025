import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarDays, MapPin, Heart, Archive, ExternalLink, Save, X, FileTextIcon, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { FestivalWithPreferences } from "@/types/festival";
import { toast } from "sonner";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

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

  // State for optimistic UI updates
  const [isFavoriteState, setIsFavorite] = useState(isFavorite);
  const [isArchivedState, setIsArchived] = useState(isArchived);
  const [notesState, setNotes] = useState(notes || "");

  // Update local state when festival props change
  useEffect(() => {
    setIsFavorite(isFavorite);
    setIsArchived(isArchived);
    setNotes(notes || "");
  }, [isFavorite, isArchived, notes]);

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
      const newStatus = !isFavoriteState;
      setIsFavorite(newStatus);
      onFavoriteToggle(id, newStatus);
      
      if (newStatus) {
        toast.success("Added to favorites");
      }
    }
  };

  // Handle archive toggle
  const handleArchiveToggle = () => {
    if (onArchiveToggle) {
      const newStatus = !isArchivedState;
      setIsArchived(newStatus);
      onArchiveToggle(id, newStatus);
      
      if (newStatus) {
        toast.info("Festival archived");
      } else {
        toast.info("Festival unarchived");
      }
    }
  };

  // Handle notes change
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  };

  // Handle notes blur to save changes
  const handleNotesBlur = () => {
    if (onNoteChange && notesState !== notes) {
      onNoteChange(id, notesState);
      toast.success("Note saved", {
        description: "Your note has been updated."
      });
    }
  };

  // Calculate duration in days
  const getDurationDays = (start: Date, end: Date) => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  };

  return (
    <Card className={`h-full flex flex-col ${isArchivedState ? "opacity-60 bg-gray-50" : ""}`}>
      <CardContent className="pt-6 flex-1">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="font-medium text-lg">{name}</h3>
          <div className="flex space-x-1">
            {isFavoriteState && (
              <Badge variant="outline" className="text-red-500 border-red-200">
                Favorite
              </Badge>
            )}
            {isArchivedState && (
              <Badge variant="outline" className="text-blue-500 border-blue-200">
                Archived
              </Badge>
            )}
          </div>
        </div>
        
        <div className="mb-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <span className="font-medium">When:</span> 
            <span>{formatDateRange()}</span>
          </div>
          <div className="text-xs text-gray-500">{getDurationDays(new Date(startDate), new Date(endDate))} days</div>
        </div>
        
        <div className="mb-4 text-sm">
          <span className="font-medium text-gray-600">Where:</span> 
          <span className="ml-1">{location.city}, {location.country}</span>
        </div>
        
        <div className="mb-4 text-sm">
          <span className="font-medium text-gray-600">Source:</span> 
          <a 
            href={source.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="ml-1 text-blue-500 hover:text-blue-700 inline-flex items-center"
          >
            {source.name}
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
        
        <div className="text-sm">
          <span className="font-medium text-gray-600">Notes:</span>
          <Textarea
            value={notesState}
            onChange={handleNotesChange}
            onBlur={handleNotesBlur}
            placeholder="Add notes here..."
            className="mt-1 min-h-[80px] text-sm border-gray-200 focus:border-blue-300"
          />
        </div>
      </CardContent>
      
      <CardFooter className="border-t pt-4 flex justify-end space-x-2">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleFavoriteToggle}
          className={isFavoriteState ? "text-red-500" : "text-gray-400 hover:text-red-400"}
        >
          <Heart className="w-4 h-4 mr-1" fill={isFavoriteState ? "currentColor" : "none"} />
          {isFavoriteState ? "Favorited" : "Favorite"}
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleArchiveToggle}
          className={isArchivedState ? "text-blue-500" : "text-gray-400 hover:text-blue-400"}
        >
          <Archive className="w-4 h-4 mr-1" />
          {isArchivedState ? "Unarchive" : "Archive"}
        </Button>
      </CardFooter>
    </Card>
  );
} 