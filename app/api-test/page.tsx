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

export default function ApiTestPage() {
  const [festivals, setFestivals] = useState<FestivalWithPreferences[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load festivals from API on component mount
  useEffect(() => {
    async function loadFestivals() {
      try {
        const response = await fetch('/api/festivals');
        const data = await response.json();
        
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
        setError(err.message || 'Failed to load festivals');
        console.error('Error loading festivals:', err);
      } finally {
        setLoading(false);
      }
    }

    loadFestivals();
  }, []);

  // Handler for updating a festival's favorite status
  const handleFavoriteToggle = (festivalId: string, isFavorite: boolean) => {
    setFestivals(prevFestivals => 
      prevFestivals.map(festival => 
        festival.id === festivalId 
          ? { ...festival, isFavorite } 
          : festival
      )
    );
  };

  // Handler for updating a festival's archived status
  const handleArchiveToggle = (festivalId: string, isArchived: boolean) => {
    setFestivals(prevFestivals => 
      prevFestivals.map(festival => 
        festival.id === festivalId 
          ? { ...festival, isArchived } 
          : festival
      )
    );
  };

  // Handler for updating a festival's notes
  const handleNoteChange = (festivalId: string, notes: string) => {
    setFestivals(prevFestivals => 
      prevFestivals.map(festival => 
        festival.id === festivalId 
          ? { ...festival, notes } 
          : festival
      )
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">API Test Page</h1>
      <p className="mb-8">Testing with direct API call to /api/festivals</p>
      
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p>Error: {error}</p>
          <p className="text-sm mt-2">Try refreshing the page or check your database connection.</p>
        </div>
      ) : festivals.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No festivals found in the database.</p>
          <p className="text-sm mt-2">Run the script to insert mock data to see festivals here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-6">
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