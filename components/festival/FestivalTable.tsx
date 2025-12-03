import { useState, useMemo, useEffect } from "react";
import { 
  HeartIcon, 
  ArchiveIcon, 
  ExternalLinkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  Save,
  FileTextIcon,
  ChevronUp,
  ChevronDown,
  Heart,
  Archive,
  CalendarDays,
  MapPin,
  ExternalLink
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FestivalWithPreferences } from "@/types/festival";

export interface FestivalTableProps {
  festivals: FestivalWithPreferences[];
  onFavoriteToggle?: (festivalId: string, isFavorite: boolean) => void;
  onArchiveToggle?: (festivalId: string, isArchived: boolean) => void;
  onNoteChange?: (festivalId: string, note: string) => void;
  onUpdateFestival: (updatedFestival: FestivalWithPreferences) => void;
}

export default function FestivalTable({
  festivals,
  onFavoriteToggle,
  onArchiveToggle,
  onNoteChange,
  onUpdateFestival
}: FestivalTableProps) {
  const [sortField, setSortField] = useState<"name" | "date" | "location" | "source">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isFavoriteState, setIsFavorite] = useState<Record<string, boolean>>({});
  const [isArchivedState, setIsArchived] = useState<Record<string, boolean>>({});
  const [notesState, setNotes] = useState<Record<string, string>>({});
  
  // Initialize optimistic UI state from festivals
  useEffect(() => {
    const favoriteState: Record<string, boolean> = {};
    const archivedState: Record<string, boolean> = {};
    const notesStateObj: Record<string, string> = {};
    
    festivals.forEach((festival) => {
      favoriteState[festival.id] = festival.isFavorite || false;
      archivedState[festival.id] = festival.isArchived || false;
      notesStateObj[festival.id] = festival.notes || "";
    });
    
    setIsFavorite(favoriteState);
    setIsArchived(archivedState);
    setNotes(notesStateObj);
  }, [festivals]);
  
  // Sort festivals
  const sortedFestivals = [...festivals].sort((a, b) => {
    if (sortField === "name") {
      return sortDirection === "asc" 
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    
    if (sortField === "date") {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    }
    
    if (sortField === "location") {
      const locationA = `${a.location.city}, ${a.location.country}`;
      const locationB = `${b.location.city}, ${b.location.country}`;
      return sortDirection === "asc"
        ? locationA.localeCompare(locationB)
        : locationB.localeCompare(locationA);
    }
    
    if (sortField === "source") {
      return a.source.name.localeCompare(b.source.name);
    }
    
    return 0;
  });
  
  // Handle sort
  const handleSort = (field: "name" | "date" | "location" | "source") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };
  
  // Get sort icon
  const getSortIcon = (field: "name" | "date" | "location" | "source") => {
    if (sortField !== field) return null;
    
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="ml-1 h-4 w-4" />
    ) : (
      <ChevronDownIcon className="ml-1 h-4 w-4" />
    );
  };
  
  // Handle favorite toggle
  const handleFavoriteToggle = (festivalId: string) => {
    const newStatus = !isFavoriteState[festivalId];
    setIsFavorite({
      ...isFavoriteState,
      [festivalId]: newStatus,
    });
    
    if (onFavoriteToggle) {
      onFavoriteToggle(festivalId, newStatus);
    }
    
    if (newStatus) {
      toast.success("Added to favorites");
    }
  };
  
  // Handle archive toggle
  const handleArchiveToggle = (festivalId: string) => {
    const newStatus = !isArchivedState[festivalId];
    setIsArchived({
      ...isArchivedState,
      [festivalId]: newStatus,
    });
    
    if (onArchiveToggle) {
      onArchiveToggle(festivalId, newStatus);
    }
    
    if (newStatus) {
      toast.info("Festival archived");
    } else {
      toast.info("Festival unarchived");
    }
  };
  
  // Handle note change
  const handleNoteChange = (festivalId: string, value: string) => {
    setNotes({
      ...notesState,
      [festivalId]: value,
    });
  };

  // Handle note blur to save changes
  const handleNoteBlur = (festivalId: string) => {
    const currentNote = notesState[festivalId];
    const originalNote = festivals.find(f => f.id === festivalId)?.notes || "";
    
    if (onNoteChange && currentNote !== originalNote) {
      onNoteChange(festivalId, currentNote);
      toast.success("Note saved", {
        description: "Your note has been updated."
      });
    }
  };
  
  // Format date function
  const formatDateRange = (startDate: string, endDate: string) => {
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
  
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="w-1/5 cursor-pointer"
              onClick={() => handleSort("name")}
            >
              <div className="flex items-center">
                <span>Festival Name</span>
                {getSortIcon("name")}
              </div>
            </TableHead>
            <TableHead 
              className="w-1/5 cursor-pointer"
              onClick={() => handleSort("date")}
            >
              <div className="flex items-center">
                <span>Dates</span>
                {getSortIcon("date")}
              </div>
            </TableHead>
            <TableHead 
              className="w-1/5 cursor-pointer"
              onClick={() => handleSort("location")}
            >
              <div className="flex items-center">
                <span>Location</span>
                {getSortIcon("location")}
              </div>
            </TableHead>
            <TableHead className="w-1/5 cursor-pointer" onClick={() => handleSort("source")}>
              <div className="flex items-center">
                <span>Source</span>
                {getSortIcon("source")}
              </div>
            </TableHead>
            <TableHead className="w-1/5">Notes</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFestivals.map((festival) => (
            <TableRow 
              key={festival.id}
              className={festival.isArchived ? "bg-gray-50" : ""}
            >
              <TableCell className="font-medium">
                <div>{festival.name}</div>
                <div className="flex mt-1 space-x-1">
                  {isFavoriteState[festival.id] && (
                    <Badge variant="outline" className="text-red-500 border-red-200">
                      Favorite
                    </Badge>
                  )}
                  {isArchivedState[festival.id] && (
                    <Badge variant="outline" className="text-blue-500 border-blue-200">
                      Archived
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  <CalendarDays className="mr-2 h-4 w-4 text-gray-400" />
                  <span>{formatDateRange(festival.startDate, festival.endDate)}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center">
                  <MapPin className="mr-2 h-4 w-4 text-gray-400" />
                  <span>{festival.location.city}, {festival.location.country}</span>
                </div>
              </TableCell>
              <TableCell>
                <a 
                  href={festival.source.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-500 hover:text-blue-700 inline-flex items-center"
                >
                  {festival.source.name}
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </TableCell>
              <TableCell>
                <Textarea
                  value={notesState[festival.id] || ""}
                  onChange={(e) => handleNoteChange(festival.id, e.target.value)}
                  onBlur={() => handleNoteBlur(festival.id)}
                  placeholder="Add notes here..."
                  className="min-h-[80px] text-sm"
                />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleFavoriteToggle(festival.id)}
                  className={
                    isFavoriteState[festival.id]
                      ? "text-red-500"
                      : "text-gray-400 hover:text-red-400"
                  }
                >
                  <Heart
                    className="h-4 w-4"
                    fill={isFavoriteState[festival.id] ? "currentColor" : "none"}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleArchiveToggle(festival.id)}
                  className={
                    isArchivedState[festival.id]
                      ? "text-blue-500"
                      : "text-gray-400 hover:text-blue-400"
                  }
                >
                  <Archive className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 