import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../../components/ui/table';
import { Festival } from '../../../lib/types';

interface FestivalTableProps {
  festivals: Festival[];
  onFavoriteToggle: (id: string) => void;
  onArchiveToggle: (id: string) => void;
  onOpenNotes: (id: string) => void;
}

export function FestivalTable({ 
  festivals, 
  onFavoriteToggle, 
  onArchiveToggle, 
  onOpenNotes 
}: FestivalTableProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Table>
      <TableCaption>List of upcoming festivals</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Festival</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="w-[120px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {festivals.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center">
              No festivals found
            </TableCell>
          </TableRow>
        ) : (
          festivals.map((festival) => (
            <TableRow key={festival.id}>
              <TableCell className="font-medium">
                <a href={festival.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {festival.name}
                </a>
              </TableCell>
              <TableCell>
                {formatDate(festival.start_date)}
                {festival.end_date && ` - ${formatDate(festival.end_date)}`}
              </TableCell>
              <TableCell>
                {festival.location}, {festival.country}
              </TableCell>
              <TableCell>{festival.source}</TableCell>
              <TableCell className="flex space-x-2">
                <button
                  onClick={() => onFavoriteToggle(festival.id)}
                  className={`p-1 rounded ${festival.favorite ? 'bg-yellow-200' : 'bg-gray-200'}`}
                  aria-label={festival.favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  ★
                </button>
                <button
                  onClick={() => onArchiveToggle(festival.id)}
                  className={`p-1 rounded ${festival.archived ? 'bg-red-200' : 'bg-gray-200'}`}
                  aria-label={festival.archived ? "Unarchive" : "Archive"}
                >
                  🗑
                </button>
                <button
                  onClick={() => onOpenNotes(festival.id)}
                  className={`p-1 rounded ${festival.notes ? 'bg-blue-200' : 'bg-gray-200'}`}
                  aria-label="Notes"
                >
                  📝
                </button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
} 