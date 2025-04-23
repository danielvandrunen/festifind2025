"use client";

import { useState, useEffect } from "react";
import { startOfMonth } from "date-fns";
import FestivalTable from "@/components/festival/FestivalTable";
import FestivalGrid from "@/components/festival/FestivalGrid";
import MonthPaginator from "@/components/festival/MonthPaginator";
import SourceFilter, { SourceOption } from "@/components/festival/SourceFilter";
import FestivalToggleView, { ViewMode } from "@/components/festival/FestivalToggleView";
import { Toaster } from "sonner";
import { FestivalWithPreferences } from "@/types/festival";

// Define the type for the API response item
interface FestivalApiResponse {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  country: string;
  url: string;
  source: string;
  favorite: boolean;
  archived: boolean;
  notes: string | null;
}

// Fallback data to use when API fails
const fallbackFestivals: FestivalWithPreferences[] = [
  {
    id: "fallback-1",
    name: "Tomorrowland (Offline Data)",
    startDate: "2025-07-18",
    endDate: "2025-07-27",
    location: { city: "Boom", country: "Belgium" },
    source: { name: "Tomorrowland Official", url: "https://www.tomorrowland.com" },
    isFavorite: true,
    isArchived: false,
    notes: "Fallback data - API connection issue"
  },
  {
    id: "fallback-2",
    name: "Glastonbury Festival (Offline Data)",
    startDate: "2025-06-25",
    endDate: "2025-06-29",
    location: { city: "Pilton", country: "United Kingdom" },
    source: { name: "Glastonbury Official", url: "https://www.glastonburyfestivals.co.uk" },
    isFavorite: false,
    isArchived: false,
    notes: "Fallback data - API connection issue"
  }
];

export default function FestivalsPage() {
  const [festivals, setFestivals] = useState<FestivalWithPreferences[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  
  // New state for filter components
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  
  // New state for view mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Load festivals from API on component mount
  useEffect(() => {
    async function loadFestivals() {
      try {
        // Get festivals from API endpoint
        console.log('Attempting to fetch festivals from API...');
        const response = await fetch('/api/festivals', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // Add cache control to avoid issues with cached error responses
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          // Add this to avoid redirect issues
          cache: 'no-store',
          next: { revalidate: 0 }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API response not OK:', response.status, errorText);
          throw new Error(`API error: ${response.status} ${errorText || response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Successfully fetched festivals data:', data);
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        // Convert API format to our FestivalWithPreferences format
        const formattedFestivals = data.festivals.map((item: FestivalApiResponse) => ({
          id: item.id,
          name: item.name,
          startDate: item.start_date,
          endDate: item.end_date,
          location: {
            city: item.location,
            country: item.country
          },
          source: {
            name: item.source,
            url: item.url
          },
          isFavorite: item.favorite,
          isArchived: item.archived,
          notes: item.notes || ''
        }));
        
        setFestivals(formattedFestivals);
        
        // Extract unique sources for the filter
        const uniqueSources = Array.from(new Set(formattedFestivals.map((f: FestivalWithPreferences) => f.source.name)))
          .map(name => {
            const count = formattedFestivals.filter((f: FestivalWithPreferences) => f.source.name === name).length;
            return {
              id: name as string,
              name: name as string,
              count
            } as SourceOption;
          });
        
        setSources(uniqueSources);
        setSelectedSources(uniqueSources.map(s => s.id)); // Select all sources by default
        
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load festivals';
        console.error('Error loading festivals:', err);
        setError(errorMessage);
        
        // Use fallback data when API fails
        console.log('Using fallback festival data');
        setFestivals(fallbackFestivals);
        setUsingFallbackData(true);
        
        // Set up fallback sources
        const fallbackSources = [
          { id: 'Tomorrowland Official', name: 'Tomorrowland Official', count: 1 },
          { id: 'Glastonbury Official', name: 'Glastonbury Official', count: 1 }
        ];
        setSources(fallbackSources);
        setSelectedSources(fallbackSources.map(s => s.id));
      } finally {
        setLoading(false);
      }
    }

    loadFestivals();
  }, []);

  // Handler for updating a festival's favorite status
  const handleFavoriteToggle = async (festivalId: string, isFavorite: boolean) => {
    try {
      // Optimistically update UI
      setFestivals(prevFestivals => 
        prevFestivals.map(festival => 
          festival.id === festivalId 
            ? { ...festival, isFavorite } 
            : festival
        )
      );
      
      // Skip API call if using fallback data
      if (usingFallbackData) {
        console.log('Using fallback data - skipping API call for favorite toggle');
        return;
      }
      
      // Send update to database
      const response = await fetch(`/api/festivals/${festivalId}/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isFavorite }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update favorite status');
      }
    } catch (err) {
      console.error('Error updating favorite status:', err);
      // Revert on error
      setFestivals(prevFestivals => [...prevFestivals]);
    }
  };

  // Handler for updating a festival's archived status
  const handleArchiveToggle = async (festivalId: string, isArchived: boolean) => {
    try {
      // Optimistically update UI
      setFestivals(prevFestivals => 
        prevFestivals.map(festival => 
          festival.id === festivalId 
            ? { ...festival, isArchived } 
            : festival
        )
      );
      
      // Skip API call if using fallback data
      if (usingFallbackData) {
        console.log('Using fallback data - skipping API call for archive toggle');
        return;
      }
      
      // Send update to database
      const response = await fetch(`/api/festivals/${festivalId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isArchived }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update archived status');
      }
    } catch (err) {
      console.error('Error updating archived status:', err);
      // Revert on error
      setFestivals(prevFestivals => [...prevFestivals]);
    }
  };

  // Handler for updating a festival's notes
  const handleNoteChange = async (festivalId: string, notes: string) => {
    try {
      // Optimistically update UI
      setFestivals(prevFestivals => 
        prevFestivals.map(festival => 
          festival.id === festivalId 
            ? { ...festival, notes } 
            : festival
        )
      );
      
      // Skip API call if using fallback data
      if (usingFallbackData) {
        console.log('Using fallback data - skipping API call for note update');
        return;
      }
      
      // Send update to database
      const response = await fetch(`/api/festivals/${festivalId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update notes');
      }
    } catch (err) {
      console.error('Error updating notes:', err);
      // Revert on error
      setFestivals(prevFestivals => [...prevFestivals]);
    }
  };

  // Handle month change
  const handleMonthChange = (newMonth: Date) => {
    setCurrentMonth(newMonth);
  };

  // Handle source filter change
  const handleSourceChange = (newSources: string[]) => {
    setSelectedSources(newSources);
  };

  // Handle view mode change
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  // Filter festivals by month and selected sources
  const filteredFestivals = festivals.filter(festival => {
    const festivalStartDate = new Date(festival.startDate);
    const festivalEndDate = new Date(festival.endDate);
    const startOfMonthDate = currentMonth;
    const endOfMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    // Check if festival overlaps with the selected month
    const festivalStartsBeforeMonthEnds = festivalStartDate <= endOfMonthDate;
    const festivalEndsAfterMonthStarts = festivalEndDate >= startOfMonthDate;
    const isInMonth = festivalStartsBeforeMonthEnds && festivalEndsAfterMonthStarts;
    
    // Check if source is selected
    const isSourceSelected = selectedSources.includes(festival.source.name);
    
    return isInMonth && isSourceSelected;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" />
      <h1 className="text-3xl font-bold mb-6">Festivals</h1>
      <p className="mb-8">Discover and manage your festival schedule with FestiFind.</p>
      
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error && !usingFallbackData ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p>Error: {error}</p>
          <p className="text-sm mt-2">Try refreshing the page or check your database connection.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {usingFallbackData && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded mb-4">
              <p>Using offline fallback data due to API connection issues.</p>
            </div>
          )}
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <MonthPaginator
                currentMonth={currentMonth}
                onMonthChange={handleMonthChange}
                minDate={new Date(2024, 0, 1)} // January 2024
                maxDate={new Date(2026, 11, 31)} // December 2026
              />
            </div>
            
            <div className="flex items-center gap-3">
              <SourceFilter
                sources={sources}
                selectedSources={selectedSources}
                onSourcesChange={handleSourceChange}
              />
              
              <FestivalToggleView 
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
              />
            </div>
          </div>
          
          {filteredFestivals.length === 0 ? (
            <div className="text-center py-10 bg-gray-50 rounded-lg">
              <p className="text-gray-600">No festivals found for the selected month and filters.</p>
              <p className="text-sm mt-2">Try changing your filter settings or month selection.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              {viewMode === 'table' ? (
                <FestivalTable 
                  festivals={filteredFestivals}
                  onFavoriteToggle={handleFavoriteToggle}
                  onArchiveToggle={handleArchiveToggle}
                  onNoteChange={handleNoteChange}
                />
              ) : (
                <FestivalGrid
                  festivals={filteredFestivals}
                  onFavoriteToggle={handleFavoriteToggle}
                  onArchiveToggle={handleArchiveToggle}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 