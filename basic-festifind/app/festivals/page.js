"use client";

import { useState, useMemo, useEffect } from 'react';
import { fetchFestivals } from '../../lib/data';
import Link from 'next/link';

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

export default function FestivalsPage() {
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [archived, setArchived] = useState([]);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch festival data on component mount
  useEffect(() => {
    async function loadFestivals() {
      try {
        const data = await fetchFestivals();
        setFestivals(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load festivals');
        setLoading(false);
      }
    }
    
    loadFestivals();
  }, []);

  // Extract unique sources for filter dropdown
  const sources = useMemo(() => {
    const uniqueSources = [...new Set(festivals.map(f => f.source))];
    return uniqueSources.map(source => ({ value: source, label: source }));
  }, [festivals]);

  // Filter festivals based on search term and selected source
  const filteredFestivals = useMemo(() => {
    return festivals.filter(festival => {
      // Filter by search term
      const matchesSearch = searchTerm === '' || 
        festival.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        festival.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        festival.country.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by source
      const matchesSource = selectedSource === '' || festival.source === selectedSource;
      
      // Filter by archived status
      const matchesArchived = showArchived ? archived.includes(festival.id) : !archived.includes(festival.id);
      
      return matchesSearch && matchesSource && matchesArchived;
    });
  }, [festivals, searchTerm, selectedSource, archived, showArchived]);

  // Toggle favorite status for a festival
  const toggleFavorite = (festivalId) => {
    setFavorites(prev => 
      prev.includes(festivalId)
        ? prev.filter(id => id !== festivalId)
        : [...prev, festivalId]
    );
  };

  // Toggle archived status for a festival
  const toggleArchived = (festivalId) => {
    setArchived(prev => 
      prev.includes(festivalId)
        ? prev.filter(id => id !== festivalId)
        : [...prev, festivalId]
    );
  };

  if (loading) return <div className="text-center p-8">Loading festivals...</div>;
  if (error) return <div className="text-center p-8 text-red-500">{error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Festivals 2025</h1>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search input */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search festivals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        {/* Source filter */}
        <div className="w-full md:w-64">
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">All Sources</option>
            {sources.map(source => (
              <option key={source.value} value={source.value}>
                {source.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Toggle archived */}
        <div className="flex items-center">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-4 py-2 rounded ${
              showArchived ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}
          >
            {showArchived ? 'Show Current' : 'Show Archived'}
          </button>
        </div>
      </div>
      
      {/* Festivals table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="py-2 px-4 border-b">Name</th>
              <th className="py-2 px-4 border-b">Dates</th>
              <th className="py-2 px-4 border-b">Location</th>
              <th className="py-2 px-4 border-b">Source</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFestivals.length > 0 ? (
              filteredFestivals.map(festival => (
                <tr key={festival.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">
                    <div className="flex items-center space-x-2">
                      <Link 
                        href={`/festivals/${festival.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {festival.name}
                      </Link>
                      <a 
                        href={festival.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600"
                        title="Visit official website"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                  </td>
                  <td className="py-2 px-4 border-b">
                    {formatDateRange(festival.start_date, festival.end_date)}
                  </td>
                  <td className="py-2 px-4 border-b">
                    {festival.city}, {festival.country}
                  </td>
                  <td className="py-2 px-4 border-b">{festival.source}</td>
                  <td className="py-2 px-4 border-b">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => toggleFavorite(festival.id)}
                        className={`p-1 rounded ${
                          favorites.includes(festival.id) 
                            ? 'text-yellow-500' 
                            : 'text-gray-400'
                        }`}
                        title={favorites.includes(festival.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        ★
                      </button>
                      <button
                        onClick={() => toggleArchived(festival.id)}
                        className="p-1 rounded text-gray-400 hover:text-gray-600"
                        title={archived.includes(festival.id) ? 'Unarchive' : 'Archive'}
                      >
                        {archived.includes(festival.id) ? '↩️' : '🗄️'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="py-4 px-4 text-center text-gray-500">
                  No festivals found matching your criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 