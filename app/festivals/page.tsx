"use client";

import { useState, useEffect } from "react";
import { FestivalTable } from "@/components/festival-table";
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
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load festivals';
        console.error('Error loading festivals:', err);
        setError(errorMessage);
        
        // Use fallback data when API fails
        console.log('Using fallback festival data');
        setFestivals(fallbackFestivals);
        setUsingFallbackData(true);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Festivals</h1>
      <p className="mb-8">Discover and manage your festival schedule with FestiFind.</p>
      
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p>Error: {error}</p>
          <p className="text-sm mt-2">Using fallback data to show sample festivals.</p>
          {usingFallbackData && (
            <div className="mt-4 p-4 bg-white rounded-lg shadow-sm border">
              <FestivalTable 
                festivals={festivals}
                onFavoriteToggle={handleFavoriteToggle}
                onArchiveToggle={handleArchiveToggle}
                onNoteChange={handleNoteChange}
              />
            </div>
          )}
        </div>
      ) : festivals.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No festivals found in the database.</p>
          <p className="text-sm mt-2">Run the script to insert mock data to see festivals here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {usingFallbackData && (
            <div className="mb-4 p-2 bg-yellow-50 text-yellow-700 rounded text-sm">
              Note: Displaying offline data due to API connection issues.
            </div>
          )}
          <FestivalTable 
            festivals={festivals}
            onFavoriteToggle={handleFavoriteToggle}
            onArchiveToggle={handleArchiveToggle}
            onNoteChange={handleNoteChange}
          />
        </div>
      )}
    </div>
  );
}

// Simple card component for displaying festival information
function FestivalCard({ name, date, location }: { name: string; date: string; location: string }) {
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="h-48 bg-gray-200"></div>
      <div className="p-4">
        <h3 className="font-bold text-xl mb-2">{name}</h3>
        <p className="text-gray-600 mb-1">{date}</p>
        <p className="text-gray-500">{location}</p>
      </div>
    </div>
  );
} 