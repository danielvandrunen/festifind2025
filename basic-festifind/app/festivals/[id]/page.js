"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchFestival } from '../../../lib/data';

// Helper function to format date ranges
function formatDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startMonth = start.toLocaleString('default', { month: 'short' });
  const endMonth = end.toLocaleString('default', { month: 'short' });
  
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }
  
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
}

export default function FestivalDetail({ params }) {
  const [festival, setFestival] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [notes, setNotes] = useState('');
  
  useEffect(() => {
    async function loadFestival() {
      try {
        const data = await fetchFestival(params.id);
        if (data) {
          setFestival(data);
        } else {
          setError('Festival not found');
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Failed to load festival details');
        setLoading(false);
      }
    }
    
    loadFestival();
  }, [params.id]);

  const toggleFavorite = () => {
    setIsFavorite(prev => !prev);
    // In a real app, this would make an API call
  };

  const toggleArchive = () => {
    setIsArchived(prev => !prev);
    // In a real app, this would make an API call
  };

  const updateNotes = (value) => {
    setNotes(value);
    // In a real app, this would make an API call
  };

  if (loading) {
    return <div className="text-center p-8">Loading festival details...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">{error}</div>;
  }

  if (!festival) {
    return <div className="text-center p-8">Festival not found</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="mb-6">
        <Link 
          href="/festivals" 
          className="text-blue-600 hover:underline flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
          Back to Festivals
        </Link>
      </div>
      
      <div className={`bg-white rounded-lg shadow-md p-6 ${isArchived ? 'bg-gray-50' : ''}`}>
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className={`text-3xl ${isFavorite ? 'font-bold' : ''}`}>{festival.name}</h1>
          <div className="flex gap-2">
            <button 
              onClick={toggleFavorite}
              className={`px-4 py-2 rounded border ${
                isFavorite ? 'bg-yellow-50 border-yellow-300 text-yellow-600' : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              {isFavorite ? '★ Favorited' : '☆ Favorite'}
            </button>
            <button 
              onClick={toggleArchive}
              className={`px-4 py-2 rounded border ${
                isArchived ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              {isArchived ? 'Unarchive' : 'Archive'}
            </button>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-4 border-b pb-6 mb-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Dates</div>
            <div>{formatDateRange(festival.start_date, festival.end_date)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Location</div>
            <div>{festival.city}, {festival.country}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Source</div>
            <div>{festival.source}</div>
          </div>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-3">About this Festival</h2>
          <p className="text-gray-700">
            {festival.name} is a popular music festival located in {festival.city}, {festival.country}. 
            This festival takes place from {formatDateRange(festival.start_date, festival.end_date)}.
          </p>
          
          <div className="mt-4">
            <a 
              href={festival.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              Visit Official Website
            </a>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-3">My Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => updateNotes(e.target.value)}
            className="w-full min-h-32 p-3 border rounded-md"
            placeholder="Add your personal notes about this festival..."
          />
        </div>
      </div>
    </div>
  );
} 