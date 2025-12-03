"use client";

import { useState, useMemo } from "react";
import { FestivalWithPreferences } from "@/types/festival";
import { formatDateRange } from "@/lib/date";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { HeartIcon, ArchiveIcon, ExternalLinkIcon } from "lucide-react";

interface FestivalTableProps {
  festivals: FestivalWithPreferences[];
  onFavoriteToggle?: (festivalId: string, isFavorite: boolean) => void;
  onArchiveToggle?: (festivalId: string, isArchived: boolean) => void;
  onNoteChange?: (festivalId: string, note: string) => void;
}

type SortField = 'name' | 'date' | 'location' | 'source';
type SortDirection = 'asc' | 'desc';

export function FestivalTable({
  festivals,
  onFavoriteToggle,
  onArchiveToggle,
  onNoteChange
}: FestivalTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [noteContent, setNoteContent] = useState<string>("");
  const [activeFestivalId, setActiveFestivalId] = useState<string | null>(null);

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
  const handleNoteOpen = (festival: FestivalWithPreferences) => {
    setNoteContent(festival.notes);
    setActiveFestivalId(festival.id);
  };

  // Handle saving a note
  const handleNoteSave = () => {
    if (activeFestivalId && onNoteChange) {
      onNoteChange(activeFestivalId, noteContent);
      setActiveFestivalId(null);
    }
  };

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-gray-50" 
              onClick={() => handleSort('name')}
            >
              Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-50" 
              onClick={() => handleSort('date')}
            >
              Date {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-50" 
              onClick={() => handleSort('location')}
            >
              Location {sortField === 'location' && (sortDirection === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-gray-50" 
              onClick={() => handleSort('source')}
            >
              Source {sortField === 'source' && (sortDirection === 'asc' ? '↑' : '↓')}
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFestivals.map(festival => (
            <TableRow 
              key={festival.id}
              className={festival.isArchived ? "opacity-60" : ""}
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
                    onClick={() => onFavoriteToggle?.(festival.id, !festival.isFavorite)}
                    className={festival.isFavorite ? "text-red-500" : "text-gray-400"}
                  >
                    <HeartIcon className="w-5 h-5" fill={festival.isFavorite ? "currentColor" : "none"} />
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onArchiveToggle?.(festival.id, !festival.isArchived)}
                    className={festival.isArchived ? "text-blue-500" : "text-gray-400"}
                  >
                    <ArchiveIcon className="w-5 h-5" />
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleNoteOpen(festival)}
                        className={festival.notes ? "text-amber-500" : "text-gray-400"}
                      >
                        Notes
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Notes for {festival.name}</DialogTitle>
                      </DialogHeader>
                      <Textarea 
                        value={noteContent}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteContent(e.target.value)}
                        placeholder="Add your notes here..."
                        className="min-h-[120px]"
                      />
                      <Button onClick={handleNoteSave}>Save</Button>
                    </DialogContent>
                  </Dialog>
                  
                  <a 
                    href={festival.source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-500 hover:text-blue-700"
                  >
                    <ExternalLinkIcon className="w-4 h-4" />
                  </a>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 