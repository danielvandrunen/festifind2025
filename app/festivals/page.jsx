'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { NotificationProvider, useNotification } from '../contexts/NotificationContext.js';
import { useStorage } from '../contexts/StorageContext';
import { useFestival } from '../contexts/FestivalContext';
import FestivalTable from '../../components/festival/FestivalTable';
import * as dateFns from 'date-fns';
import { Search, CreditCard, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

// Destructure date-fns functions to ensure they're properly accessible
const {
  format,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  getWeek,
  addWeeks,
  setWeek,
  parseISO,
  isBefore,
  isAfter,
  isSameDay
} = dateFns;

// LocalStorage keys
const FAVORITES_STORAGE_KEY = 'festifind-favorites';

// Main component content
function FestivalsContent() {
  const { 
    festivals: allFestivals, 
    loading: isLoading,
    fetchFestivals,
    toggleFavorite,
    toggleArchived,
    updateNotes,
    updateDates,
    updateSalesStage,
    updateRateCard,
    updateEmails,
    initiateResearch,
    refreshResearchStatus,
    fetchFestivalsWithResearch,
    getResearchStatus
  } = useFestival();
  
  // Remove displayedFestivals useState - we'll compute it instead
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showAllFestivals, setShowAllFestivals] = useState(false); // Start with date navigation instead of all festivals
  const [selectedAiService, setSelectedAiService] = useState('exa');
  const [filter, setFilter] = useState('all'); // 'all', 'favorites', 'archived'
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 0, 1)); // Start with January 2025
  const [showNullDates, setShowNullDates] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(null); // Selected week number
  const [weekFilterActive, setWeekFilterActive] = useState(false); // Whether week filter is active
  const [currentWeekData, setCurrentWeekData] = useState(null); // Store the current week's date range
  const [showRateCardRequested, setShowRateCardRequested] = useState(false);
  const [showRateCardReceived, setShowRateCardReceived] = useState(false);
  const [showRateCardPending, setShowRateCardPending] = useState(false);
  const { showSuccess, showError, showInfo } = useNotification();
  const storage = useStorage();
  const initialMessageShown = useRef(false);

  // Compute displayedFestivals instead of storing in state
  const displayedFestivals = useMemo(() => {
    if (allFestivals.length === 0) return [];
    
    let filteredFestivals = [...allFestivals];
    
    // Apply favorite/archived filter
    if (filter === 'favorites') {
      filteredFestivals = filteredFestivals.filter(festival => festival.favorite && !festival.archived);
    } else if (filter === 'archived') {
      filteredFestivals = filteredFestivals.filter(festival => festival.archived);
    } else {
      // In "all" filter, exclude archived items
      filteredFestivals = filteredFestivals.filter(festival => !festival.archived);
    }
    
    if (showAllFestivals) {
      return filteredFestivals;
    }
    
    // Apply rate card filters if active
    if (showRateCardRequested) {
      return filteredFestivals.filter(festival => festival.rate_card_requested === true);
    }
    else if (showRateCardReceived) {
      return filteredFestivals.filter(festival => festival.rate_card_received === true);
    }
    else if (showRateCardPending) {
      return filteredFestivals.filter(festival => 
        festival.rate_card_requested === true && festival.rate_card_received === false
      );
    }
    // Search filtering
    else if (isSearching && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      return filteredFestivals.filter(festival => 
        (festival.name && festival.name.toLowerCase().includes(searchLower)) ||
        (festival.location && festival.location.toLowerCase().includes(searchLower))
      );
    } 
    // Date filtering
    else if (showNullDates) {
      // Filter festivals with null dates
      return filteredFestivals.filter(
        festival => !festival.start_date && !festival.end_date
      );
    } 
    else {
      // Calculate date range based on current month or week
      let startDate, endDate;
      
      if (weekFilterActive && selectedWeek) {
        // Calculate start and end dates for the selected week
        const weekDate = setWeek(new Date(currentMonth.getFullYear(), 0, 1), selectedWeek);
        startDate = startOfWeek(weekDate, { weekStartsOn: 1 }); // Monday
        endDate = endOfWeek(weekDate, { weekStartsOn: 1 }); // Sunday
      } else {
        // Calculate start and end dates for current month
        startDate = startOfMonth(currentMonth);
        endDate = endOfMonth(currentMonth);
      }
      
      // Filter festivals that overlap with the date range
      return filteredFestivals.filter(festival => {
        if (!festival.start_date || !festival.end_date) return false;
        
        const festivalStartDate = parseISO(festival.start_date);
        const festivalEndDate = parseISO(festival.end_date);
        
        // Festival overlaps with range if:
        // (festival start <= range end) AND (festival end >= range start)
        return (festivalStartDate.getTime() <= endDate.getTime()) && 
               (festivalEndDate.getTime() >= startDate.getTime());
      });
    }
  }, [
    allFestivals, 
    filter, 
    showAllFestivals, 
    showRateCardRequested, 
    showRateCardReceived, 
    showRateCardPending,
    isSearching, 
    searchTerm, 
    showNullDates, 
    weekFilterActive, 
    selectedWeek, 
    currentMonth
  ]);

  // Ensure we have festivals data
  useEffect(() => {
    if (allFestivals.length === 0 && !isLoading) {
      fetchFestivals();
    } else if (allFestivals.length > 0 && initialLoadComplete && !showAllFestivals && !isSearching && !showNullDates && !initialMessageShown.current) {
      // Show initial message about January filter on first load - only once
      showInfo(`Showing festivals for ${format(currentMonth, 'MMMM yyyy')}`);
      initialMessageShown.current = true;
    }
  }, [allFestivals.length, isLoading, fetchFestivals, initialLoadComplete, showAllFestivals, isSearching, showNullDates, currentMonth, showInfo]);

  // DISABLED: Refresh research status when festivals load to prevent excessive API calls
  const researchRefreshRequestedRef = useRef(false);
  useEffect(() => {
    // DISABLED: No more automatic research data fetching to prevent excessive API calls
    // Research data will only be fetched on initial load from the home page
    // Users can manually refresh if needed
    if (allFestivals.length > 0 && !isLoading && !researchRefreshRequestedRef.current) {
      console.log("Festivals page: Automatic research data fetch disabled to prevent excessive API calls");
      researchRefreshRequestedRef.current = true;
    }
  }, [allFestivals.length, isLoading]);

  // Update loading state when festivals change
  useEffect(() => {
    if (allFestivals.length === 0) return;
    setInitialLoadComplete(true);
    setLoading(false);
  }, [allFestivals]);

  // Handle search submit
  const handleSearch = (e) => {
    e?.preventDefault();
    
    if (!searchTerm.trim()) {
      setIsSearching(false);
      return;
    }
    
    setShowAllFestivals(false); // Exit "show all" mode when searching
    setIsSearching(true);
    // The filtering will happen automatically in the useEffect
  };
  
  // Clear search and return to month view
  const clearSearch = () => {
    setSearchTerm('');
    setIsSearching(false);
  };

  // Check if a festival falls within the specified week
  const isInWeek = (festival, weekStart, weekEnd) => {
    if (!festival.start_date || !festival.end_date) return false;
    
    const festivalStartDate = parseISO(festival.start_date);
    const festivalEndDate = parseISO(festival.end_date);
    
    // Festival overlaps with week if:
    // (festival start <= week end) AND (festival end >= week start)
    return (festivalStartDate.getTime() <= weekEnd.getTime()) && 
           (festivalEndDate.getTime() >= weekStart.getTime());
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setShowAllFestivals(false); // Exit "show all" mode when navigating
    setCurrentMonth(prevMonth => addMonths(prevMonth, -1));
    setWeekFilterActive(false);
    setSelectedWeek(null);
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setShowAllFestivals(false); // Exit "show all" mode when navigating
    setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
    setWeekFilterActive(false);
    setSelectedWeek(null);
  };
  
  // Handle week selection
  const handleWeekSelect = (weekNumber) => {
    setShowAllFestivals(false); // Exit "show all" mode when selecting a week
    if (weekFilterActive && selectedWeek === weekNumber) {
      // If clicking the already selected week, reset the filter
      resetWeekFilter();
    } else {
      // Otherwise, set the week filter
      setSelectedWeek(weekNumber);
      setWeekFilterActive(true);
    }
  };
  
  // Reset week filter and show all festivals in the month
  const resetWeekFilter = () => {
    setWeekFilterActive(false);
    setSelectedWeek(null);
  };
  
  // Handle favorite toggle - delegate to context
  const handleFavoriteToggle = async (festivalId, isFavorite) => {
    toggleFavorite(festivalId, isFavorite);
    showSuccess(`${isFavorite ? 'Added to' : 'Removed from'} favorites`);
  };
  
  // Handle archive toggle - delegate to context
  const handleArchiveToggle = async (festivalId, isArchived) => {
    toggleArchived(festivalId, isArchived);
    showSuccess(`Festival ${isArchived ? 'archived' : 'unarchived'}`);
  };
  
  // Handle note save - delegate to context
  const handleNoteSave = async (festivalId, note) => {
    updateNotes(festivalId, note);
  };
  
  // Handle date update - delegate to context
  const handleUpdateDates = async (festivalId, startDate, endDate) => {
    updateDates(festivalId, startDate, endDate);
    showSuccess('Festival dates updated');
    
    // Re-apply filters if we're in the "Unknown" section or date filtering is active
    if (showNullDates || (!isSearching && !showNullDates)) {
      // The filtering will happen automatically in the useEffect
    }
  };

  // Get available months for quick navigation
  const availableMonths = [];
  const now = new Date();
  const startYear = 2025;
  const endYear = 2025;
  
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 0; month < 12; month++) {
      availableMonths.push(new Date(year, month, 1));
    }
  }
  
  // Get available weeks for the current month
  const getWeeksInMonth = () => {
    const weeksData = [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    // Get the Monday of the first week that contains days from this month
    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    
    // Keep adding weeks until we've covered the entire month
    while (weekStart.getTime() <= monthEnd.getTime()) {
      const weekNumber = getWeek(weekStart);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      // Format the week display with start and end dates
      const weekDisplay = `Week ${weekNumber}: ${format(weekStart, 'd/M')}-${format(weekEnd, 'd/M')}`;
      
      weeksData.push({
        weekNumber,
        display: weekDisplay,
        startDate: weekStart,
        endDate: weekEnd
      });
      
      // Move to next week
      weekStart = addWeeks(weekStart, 1);
    }
    
    return weeksData;
  };
  
  const weeksInCurrentMonth = getWeeksInMonth();
  
  // Clear all active filters
  const clearAllFilters = () => {
    setIsSearching(false);
    setSearchTerm('');
    setShowNullDates(false);
    setWeekFilterActive(false);
    setSelectedWeek(null);
    setCurrentWeekData(null);
    setShowRateCardRequested(false);
    setShowRateCardReceived(false);
    setShowRateCardPending(false);
    setCurrentMonth(new Date(2025, 0, 1)); // Reset to January 2025
  };

  // Toggle rate card filters
  const toggleRateCardRequestedFilter = () => {
    // If turning on this filter, turn off others
    if (!showRateCardRequested) {
      setShowRateCardReceived(false);
      setShowRateCardPending(false);
      setShowAllFestivals(true); // Show all to apply only this filter
      setIsSearching(false);
      setShowNullDates(false);
      setWeekFilterActive(false);
    }
    setShowRateCardRequested(!showRateCardRequested);
  };

  const toggleRateCardReceivedFilter = () => {
    // If turning on this filter, turn off others
    if (!showRateCardReceived) {
      setShowRateCardRequested(false);
      setShowRateCardPending(false);
      setShowAllFestivals(true); // Show all to apply only this filter
      setIsSearching(false);
      setShowNullDates(false);
      setWeekFilterActive(false);
    }
    setShowRateCardReceived(!showRateCardReceived);
  };

  const toggleRateCardPendingFilter = () => {
    // If turning on this filter, turn off others
    if (!showRateCardPending) {
      setShowRateCardRequested(false);
      setShowRateCardReceived(false);
      setShowAllFestivals(true); // Show all to apply only this filter
      setIsSearching(false);
      setShowNullDates(false);
      setWeekFilterActive(false);
    }
    setShowRateCardPending(!showRateCardPending);
  };

  // Handle rate card updates
  const handleUpdateRateCard = async (festivalId, updates) => {
    try {
      const success = await updateRateCard(festivalId, updates);
      
      if (success) {
        showSuccess('Rate card information updated successfully');
        return true;
      } else {
        showError('Failed to update rate card information');
        return false;
      }
    } catch (error) {
      console.error('Error updating rate card:', error);
      showError('An error occurred while updating rate card information');
      return false;
    }
  };
  
  // Handle email update
  const handleEmailUpdate = async (festivalId, email) => {
    try {
      await updateEmails(festivalId, email);
    } catch (error) {
      console.error('Error updating email:', error);
      // Error handling is done in the context function
    }
  };

  // Handle initiating research
  const handleResearch = async (festivalId) => {
    try {
      const festival = allFestivals.find(f => f.id === festivalId);
      if (!festival) return;
      
      showInfo(`Initiating research for ${festival.name} using ${selectedAiService.toUpperCase()}...`);
      
      // No more optimistic UI updates - trust the context to handle state
      // Call the API to initiate research - this will update the context's festivals array automatically
      await initiateResearch(festivalId, selectedAiService);
      
      // No more manual polling - let the context handle research status updates
      console.log(`Research initiated for ${festival.name} using ${selectedAiService}, context will handle status updates`);
    } catch (error) {
      console.error('Error handling research:', error);
      showError(`Failed to initiate research: ${error.message || 'Unknown error'}`);
    }
  };
  
  // Loading state
  if (isLoading && allFestivals.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-2">Loading festivals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto py-4 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Festivals
        </h1>
        
        <div className="flex flex-col w-full md:w-auto space-y-2">
          {/* AI Service Toggle */}
          <div className="flex items-center justify-end space-x-2 mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">AI Research:</span>
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setSelectedAiService('openai')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedAiService === 'openai'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                }`}
              >
                OpenAI
              </button>
              <button
                type="button"
                onClick={() => setSelectedAiService('perplexity')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedAiService === 'perplexity'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                }`}
              >
                Perplexity
              </button>
              <button
                type="button"
                onClick={() => setSelectedAiService('exa')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedAiService === 'exa'
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                }`}
              >
                EXA
              </button>
            </div>
          </div>
          
          {/* Search form */}
          <form onSubmit={handleSearch} className="w-full md:w-auto flex">
            <div className="relative flex-grow w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-10 py-2 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search festivals..."
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-12 flex items-center">
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="text-gray-400 hover:text-gray-500 px-2"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-r-md hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Search
            </button>
          </form>
        </div>
      </div>
      
      {/* Month Navigation */}
      <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center justify-center mb-4">
          {/* Removed previous month button, month/year heading, and next month button */}
        </div>
        
        {/* Month Shortcuts */}
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          <button
            onClick={() => setShowAllFestivals(true)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              showAllFestivals
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Show All
          </button>
          
          {availableMonths.map((month, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentMonth(month);
                setShowAllFestivals(false);
                setWeekFilterActive(false);
                setSelectedWeek(null);
              }}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                !showAllFestivals && !showNullDates && !weekFilterActive && 
                month.getMonth() === currentMonth.getMonth() && 
                month.getFullYear() === currentMonth.getFullYear()
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {format(month, 'MMM')}
            </button>
          ))}
          
          <button
            onClick={() => {
              setShowNullDates(true);
              setShowAllFestivals(false);
              setWeekFilterActive(false);
              setSelectedWeek(null);
            }}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              showNullDates
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Unknown Dates
          </button>
        </div>
        
        {/* Week Number Shortcuts - Only show when not in "Unknown" section */}
        {!showNullDates && !showAllFestivals && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-grow"></div>
              {weekFilterActive && selectedWeek && (
                <button 
                  onClick={resetWeekFilter}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  Show all in {format(currentMonth, 'MMMM')}
                </button>
              )}
            </div>
            
            {/* Force display of all week buttons, regardless of filter status */}
            <div className="flex flex-wrap gap-2 justify-center">
              {weeksInCurrentMonth.map((week, index) => (
                <button
                  key={index}
                  onClick={() => handleWeekSelect(week.weekNumber)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    weekFilterActive && selectedWeek === week.weekNumber
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {week.display}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
        {/* Filter buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex items-center px-3 py-1 text-sm rounded-md ${
              filter === 'all'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('favorites')}
            className={`flex items-center px-3 py-1 text-sm rounded-md ${
              filter === 'favorites'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            Favorites
          </button>
          <button
            type="button"
            onClick={() => setFilter('archived')}
            className={`flex items-center px-3 py-1 text-sm rounded-md ${
              filter === 'archived'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            Archived
          </button>
        </div>
      </div>
      
      {/* Loading spinner or table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="spinner"></div>
          </div>
        ) : (
          <FestivalTable
            festivals={displayedFestivals}
            onFavoriteToggle={handleFavoriteToggle}
            onArchiveToggle={handleArchiveToggle}
            onNoteSave={handleNoteSave}
            onUpdateDates={handleUpdateDates}
            onUpdateRateCard={handleUpdateRateCard}
            onEmailUpdate={handleEmailUpdate}
            onResearch={handleResearch}
          />
        )}
      </div>
      
      {/* Pagination or stats */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing <span className="font-medium">{displayedFestivals.length}</span> festivals
          {!showAllFestivals && (
            <span> from <span className="font-medium">{format(currentMonth, 'MMMM yyyy')}</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrapper component
export default function Festivals() {
  return (
    <FestivalsContent />
  );
} 