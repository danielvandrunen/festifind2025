import { ListFilter, Star, Archive, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export type StatusFilter = 'all' | 'favorites' | 'archived';

interface FestivalStatusFilterProps {
  currentFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
}

export default function FestivalStatusFilter({
  currentFilter,
  onFilterChange
}: FestivalStatusFilterProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-md p-1">
      <Button
        variant={currentFilter === 'all' ? "default" : "ghost"}
        size="sm"
        onClick={() => onFilterChange('all')}
        className={`px-3 ${currentFilter === 'all' ? "" : "hover:bg-gray-200"}`}
      >
        <ListFilter className="h-4 w-4 mr-1" />
        All
      </Button>
      
      <Button
        variant={currentFilter === 'favorites' ? "default" : "ghost"}
        size="sm"
        onClick={() => onFilterChange('favorites')}
        className={`px-3 ${currentFilter === 'favorites' ? "" : "hover:bg-gray-200"}`}
      >
        <Star className="h-4 w-4 mr-1" fill={currentFilter === 'favorites' ? "currentColor" : "none"} />
        Favorites
      </Button>
      
      <Button
        variant={currentFilter === 'archived' ? "default" : "ghost"}
        size="sm"
        onClick={() => onFilterChange('archived')}
        className={`px-3 ${currentFilter === 'archived' ? "" : "hover:bg-gray-200"}`}
      >
        <Archive className="h-4 w-4 mr-1" />
        Archived
      </Button>
    </div>
  );
} 