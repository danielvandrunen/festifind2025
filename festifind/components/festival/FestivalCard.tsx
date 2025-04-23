import { format } from "date-fns";
import { CalendarDays, MapPin, Heart, Archive, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FestivalWithPreferences } from "@/types/festival";
import FestivalNotes from "./FestivalNotes";

interface FestivalCardProps {
  festival: FestivalWithPreferences;
  onFavoriteToggle?: (festivalId: string, isFavorite: boolean) => void;
  onArchiveToggle?: (festivalId: string, isArchived: boolean) => void;
}

export default function FestivalCard({
  festival,
  onFavoriteToggle,
  onArchiveToggle
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
        
        {/* Notes (if any) */}
        <FestivalNotes notes={notes} />
        
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