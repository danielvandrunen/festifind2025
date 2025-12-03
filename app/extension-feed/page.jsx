'use client';

import { useState, useEffect, useMemo } from 'react';
import { NotificationProvider, useNotification } from '../contexts/NotificationContext.js';
import { useFestival } from '../contexts/FestivalContext';
import { Search, Calendar, ExternalLink, Star, Archive, Puzzle, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Extension Feed Component
function ExtensionFeedContent() {
  const { 
    festivals: allFestivals, 
    loading: isLoading,
    fetchFestivals,
    toggleFavorite,
    toggleArchived,
    updateNotes
  } = useFestival();
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc'); // Show newest first
  const { showSuccess, showError, showInfo } = useNotification();

  // Filter festivals to show only those added via Chrome extension
  const extensionFestivals = useMemo(() => {
    if (allFestivals.length === 0) return [];
    
    let filteredFestivals = allFestivals.filter(festival => 
      festival.source === 'chrome-extension'
    );
    
    // Apply search filter if active
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredFestivals = filteredFestivals.filter(festival => 
        (festival.name && festival.name.toLowerCase().includes(searchLower)) ||
        (festival.location && festival.location.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort festivals
    filteredFestivals.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Handle date sorting
      if (sortField === 'created_at' || sortField === 'start_date' || sortField === 'end_date') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }
      
      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortDirection === 'desc') {
        return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });
    
    return filteredFestivals;
  }, [allFestivals, searchTerm, sortField, sortDirection]);

  // Fetch festivals on component mount
  useEffect(() => {
    if (allFestivals.length === 0 && !isLoading) {
      fetchFestivals();
    } else if (allFestivals.length > 0) {
      setLoading(false);
    }
  }, [allFestivals.length, isLoading, fetchFestivals]);

  // Handle search
  const handleSearch = (e) => {
    e?.preventDefault();
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  // Handle sorting
  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to desc for new fields
    }
  };

  // Handle favorite toggle
  const handleFavoriteToggle = async (festivalId, isFavorite) => {
    await toggleFavorite(festivalId, isFavorite);
  };

  // Handle archive toggle
  const handleArchiveToggle = async (festivalId, isArchived) => {
    await toggleArchived(festivalId, isArchived);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Format date and time for created_at
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading extension feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Puzzle className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Extension Feed</h1>
            <p className="text-gray-600">
              Festivals added through the Chrome extension ({extensionFestivals.length} total)
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search festivals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
              />
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Festival Name {getSortIcon('name')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('start_date')}
                >
                  Event Dates {getSortIcon('start_date')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('location')}
                >
                  Location {getSortIcon('location')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('created_at')}
                >
                  Date Added {getSortIcon('created_at')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email Addresses
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {extensionFestivals.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <Puzzle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No festivals found</p>
                    <p>
                      {searchTerm 
                        ? 'No extension-added festivals match your search.'
                        : 'No festivals have been added through the Chrome extension yet.'
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                extensionFestivals.map((festival) => (
                  <tr key={festival.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {festival.name || 'Unnamed Festival'}
                          </div>
                          {festival.notes && (
                            <div className="text-sm text-gray-500 mt-1">
                              {festival.notes.length > 50 
                                ? `${festival.notes.substring(0, 50)}...`
                                : festival.notes
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        <div>
                          <div>{formatDate(festival.start_date)}</div>
                          {festival.end_date && festival.end_date !== festival.start_date && (
                            <div className="text-gray-500">to {formatDate(festival.end_date)}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                        {festival.location || 'Location not set'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(festival.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {festival.url ? (
                        <a
                          href={festival.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Visit
                        </a>
                      ) : (
                        <span className="text-gray-400">No URL</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {festival.emails && festival.emails.length > 0 ? (
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {festival.emails.slice(0, 3).map((email, index) => (
                              <div key={index} className="flex items-center">
                                <a 
                                  href={`mailto:${email}`}
                                  className="text-blue-600 hover:underline text-xs break-all"
                                  title={`Send email to ${email}`}
                                >
                                  {email.length > 20 ? `${email.substring(0, 17)}...` : email}
                                </a>
                              </div>
                            ))}
                            {festival.emails.length > 3 && (
                              <div className="text-xs text-gray-500 italic">
                                +{festival.emails.length - 3} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">No emails</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium hidden">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleFavoriteToggle(festival.id, !festival.favorite)}
                          className={`p-1 rounded-full transition-colors ${
                            festival.favorite
                              ? 'text-yellow-500 hover:text-yellow-600'
                              : 'text-gray-400 hover:text-yellow-500'
                          }`}
                          title={festival.favorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star className={`h-4 w-4 ${festival.favorite ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => handleArchiveToggle(festival.id, !festival.archived)}
                          className={`p-1 rounded-full transition-colors ${
                            festival.archived
                              ? 'text-red-500 hover:text-red-600'
                              : 'text-gray-400 hover:text-red-500'
                          }`}
                          title={festival.archived ? 'Unarchive' : 'Archive'}
                        >
                          <Archive className={`h-4 w-4 ${festival.archived ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Main export with providers
export default function ExtensionFeed() {
  return (
    <NotificationProvider>
      <ExtensionFeedContent />
    </NotificationProvider>
  );
} 