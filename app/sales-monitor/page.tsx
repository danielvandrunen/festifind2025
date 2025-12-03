'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, MapPin, Globe, Star, MoveHorizontal, ChevronLeft, ChevronRight, Search, RefreshCw, FileText } from 'lucide-react';
import { formatDateRange } from '../../utils/dateUtils';
import { SalesStage, ResearchStatus } from '../../lib/types';
import { useFestival } from '../contexts/FestivalContext';
import * as dateFns from 'date-fns';
import ResearchModal from '../../components/festival/ResearchModal';

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

// Get the FestivalWithPreferences type from the context
type FestivalWithPreferences = ReturnType<typeof useFestival>['festivals'][0];

// Sales stage badge colors
const salesStageBadgeColors = {
  favorited: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  outreach: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  talking: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  offer: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  deal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
};

// Function to render a festival card (extract for reusability)
const FestivalCard = ({ festival, onMoveStage, currentStage, nextStage, previousStage }) => {
  const [showResearchModal, setShowResearchModal] = useState(false);

  // Check if festival has completed research
  const hasCompletedResearch = festival.research?.status === 'complete';

  // Handle opening the research modal
  const handleOpenResearch = (e) => {
    e.stopPropagation();
    setShowResearchModal(true);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow-md p-3 mb-2 hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{festival.name}</h3>
        <div className="flex space-x-2">
          {/* Research button - only shows when research is complete */}
          {hasCompletedResearch && (
            <button
              onClick={handleOpenResearch}
              className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300"
              title="View Research Notes"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}
          {previousStage && (
            <button
              onClick={() => onMoveStage(festival.id, currentStage, previousStage)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              title={`Move back to ${previousStage}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {nextStage !== currentStage && (
            <button
              onClick={() => onMoveStage(festival.id, currentStage, nextStage)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              title={`Move to ${nextStage}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center">
          <MapPin className="h-3 w-3 mr-1" />
          <span>{festival.location || 'Unknown location'}</span>
        </div>
        
        <div className="flex items-center mt-1">
          <Calendar className="h-3 w-3 mr-1" />
          <span>
            {festival.start_date && festival.end_date
              ? formatDateRange(festival.start_date, festival.end_date)
              : 'Unknown dates'}
          </span>
        </div>
        
        {/* Notes Preview */}
        {festival.notes && (
          <div className="mt-1 text-xs bg-green-50 text-green-800 p-2 rounded border border-green-600 dark:bg-green-900 dark:text-green-200 dark:border-green-700 line-clamp-2">
            {festival.notes}
          </div>
        )}
      </div>

      {/* Research Modal */}
      {showResearchModal && (
        <ResearchModal
          festivalId={festival.id}
          festivalName={festival.name}
          isOpen={showResearchModal}
          onClose={() => setShowResearchModal(false)}
        />
      )}
    </div>
  );
};

const SalesMonitor = () => {
  // Use FestivalContext instead of fetching data directly
  const { 
    festivals: allFestivals, 
    loading: contextLoading, 
    fetchFestivals,
    updateSalesStage,
    fetchFestivalsWithResearch
  } = useFestival();

  // Define the sales stages
  const stages = [
    { id: 'favorited' as SalesStage, title: 'Favorited' },
    { id: 'outreach' as SalesStage, title: 'Outreach' },
    { id: 'talking' as SalesStage, title: 'Talking' },
    { id: 'offer' as SalesStage, title: 'Offer' },
    { id: 'deal' as SalesStage, title: 'Deal' },
  ];

  // State to store festivals by stage
  const [festivalsByStage, setFestivalsByStage] = useState<{
    [key in SalesStage]: FestivalWithPreferences[];
  }>({
    favorited: [],
    outreach: [],
    talking: [],
    offer: [],
    deal: [],
  });

  // Local state for UI
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'favorited' | 'archived'>('all');
  
  // Date filtering state
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2025, 0, 1)); // Start with January 2025
  const [showAllFestivals, setShowAllFestivals] = useState(true); // Default to showing all
  const [showNullDates, setShowNullDates] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [weekFilterActive, setWeekFilterActive] = useState(false);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh research data
      await fetchFestivalsWithResearch();
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while refreshing data');
      console.error('Error refreshing festivals:', err);
    } finally {
      setRefreshing(false);
    }
  }, []); // Removed fetchFestivalsWithResearch to prevent infinite loops

  // Ensure festivals are loaded
  useEffect(() => {
    if (allFestivals.length === 0 && !contextLoading) {
      fetchFestivals();
    }
  }, [allFestivals.length, contextLoading, fetchFestivals]);

  // Apply filters to festivals
  const applyFilters = useCallback((festivals = allFestivals) => {
    console.log(`🔍 SALES MONITOR DEBUG: Processing ${festivals.length} festivals`);
    
    // Debug: Check the first 5 festivals and their favorite/sales_stage status
    const firstFive = festivals.slice(0, 5);
    console.log('🔍 First 5 festivals favorite/sales_stage status:', firstFive.map(f => ({
      name: f.name,
      favorite: f.favorite,
      sales_stage: f.sales_stage,
      archived: f.archived
    })));
    
    // DEBUG: Check for IJsbeelden in the initial dataset
    const ijsbeeldenFestival = festivals.find(f => f.name && f.name.toLowerCase().includes('ijsbeelden'));
    if (ijsbeeldenFestival) {
      console.log("FOUND IJSBEELDEN:", { 
        id: ijsbeeldenFestival.id,
        name: ijsbeeldenFestival.name,
        favorite: ijsbeeldenFestival.favorite,
        sales_stage: ijsbeeldenFestival.sales_stage,
        archived: ijsbeeldenFestival.archived
      });
    } else {
      console.log("IJSBEELDEN FESTIVAL NOT FOUND IN INITIAL DATASET");
    }

    // Create a new object to store festivals by stage
    const stageMapByName = {
      favorited: new Map<string, FestivalWithPreferences>(),
      outreach: new Map<string, FestivalWithPreferences>(),
      talking: new Map<string, FestivalWithPreferences>(),
      offer: new Map<string, FestivalWithPreferences>(),
      deal: new Map<string, FestivalWithPreferences>(),
    };

    // Filter festivals based on search term and filter mode
    let filteredFestivals = [...festivals];
    
    // Apply search filter
    if (isSearching && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredFestivals = filteredFestivals.filter(festival => 
        (festival.name && festival.name.toLowerCase().includes(searchLower)) ||
        (festival.location && festival.location.toLowerCase().includes(searchLower)) ||
        (festival.notes && festival.notes.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply filter mode
    if (filterMode === 'favorited') {
      filteredFestivals = filteredFestivals.filter(festival => festival.favorite === true);
    } else if (filterMode === 'archived') {
      filteredFestivals = filteredFestivals.filter(festival => festival.archived === true);
    }
    
    // Apply date filtering
    if (!showAllFestivals) {
      // Date filtering
      if (showNullDates) {
        // Filter festivals with null dates
        filteredFestivals = filteredFestivals.filter(
          festival => !festival.start_date && !festival.end_date
        );
      } else {
        // Calculate date range based on current month or week
        let startDate, endDate;
        
        if (weekFilterActive && selectedWeek !== null) {
          console.log(`Filtering by Week ${selectedWeek}`);
          // Calculate start and end dates for the selected week
          const weekDate = setWeek(new Date(currentMonth.getFullYear(), 0, 1), selectedWeek);
          startDate = startOfWeek(weekDate, { weekStartsOn: 1 }); // Monday
          endDate = endOfWeek(weekDate, { weekStartsOn: 1 }); // Sunday
          
          console.log(`Week range: ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
        } else {
          console.log(`Filtering by Month: ${format(currentMonth, 'MMM yyyy')}`);
          // Calculate start and end dates for current month
          startDate = startOfMonth(currentMonth);
          endDate = endOfMonth(currentMonth);
          
          console.log(`Month range: ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
        }
        
        // Filter festivals that overlap with the date range
        filteredFestivals = filteredFestivals.filter(festival => {
          if (!festival.start_date || !festival.end_date) return false;
          
          const festivalStartDate = parseISO(festival.start_date);
          const festivalEndDate = parseISO(festival.end_date);
          
          // Festival overlaps with range if:
          // (festival start <= range end) AND (festival end >= range start)
          return (festivalStartDate.getTime() <= endDate.getTime()) && 
                 (festivalEndDate.getTime() >= startDate.getTime());
        });
      }
    }

    // DEBUG: Check for IJsbeelden after all filters
    const ijsbeeldenAfterAllFilters = filteredFestivals.find(f => f.name && f.name.toLowerCase().includes('ijsbeelden'));
    if (ijsbeeldenAfterAllFilters) {
      console.log("IJSBEELDEN PASSED ALL FILTERS");
    } else {
      console.log("IJSBEELDEN FILTERED OUT BY ALL FILTERS", {
        showAllFestivals,
        showNullDates,
        weekFilterActive,
        selectedWeek
      });
    }

    // Group filtered festivals by stage
    filteredFestivals.forEach(festival => {
      const stage = festival.sales_stage || 'favorited';
      
      // Special debug for IJsbeelden
      if (festival.name && festival.name.toLowerCase().includes('ijsbeelden')) {
        console.log("PROCESSING IJSBEELDEN FOR LANES:", {
          name: festival.name,
          favorite: festival.favorite,
          sales_stage: stage,
          willAddToStage: stage
        });
      }
      
      // FIXED SMART FAVORITING LOGIC:
      // Only add festivals to lanes if they meet the criteria
      
      if (stage === 'favorited') {
        // For favorited lane, only show festivals that are actually marked as favorites
        if (festival.favorite === true) {
          stageMapByName[stage].set(festival.name, festival);
          
          // Debug specifically for IJsbeelden
          if (festival.name && festival.name.toLowerCase().includes('ijsbeelden')) {
            console.log(`ADDED IJSBEELDEN TO ${stage.toUpperCase()} LANE - IS FAVORITE`);
          }
        } else {
          // Don't add non-favorited festivals to the favorited lane
          if (festival.name && festival.name.toLowerCase().includes('ijsbeelden')) {
            console.log(`SKIPPED IJSBEELDEN - NOT FAVORITED (favorite: ${festival.favorite})`);
          }
        }
      } else {
        // For active sales stages, festivals should automatically be considered favorited
        // But only add them if they're truly in an active sales stage
        stageMapByName[stage].set(festival.name, festival);
        
        // Debug specifically for IJsbeelden
        if (festival.name && festival.name.toLowerCase().includes('ijsbeelden')) {
          console.log(`ADDED IJSBEELDEN TO ${stage.toUpperCase()} LANE - ACTIVE SALES STAGE`);
        }
      }
    });

    // Convert maps to arrays for each stage
    const stageMap: { [key in SalesStage]: FestivalWithPreferences[] } = {
      favorited: Array.from(stageMapByName.favorited.values()),
      outreach: Array.from(stageMapByName.outreach.values()),
      talking: Array.from(stageMapByName.talking.values()),
      offer: Array.from(stageMapByName.offer.values()),
      deal: Array.from(stageMapByName.deal.values()),
    };

    // DEBUG: Check final state for IJsbeelden
    const favoritedIJsbeelden = stageMap.favorited.find(f => f.name && f.name.toLowerCase().includes('ijsbeelden'));
    if (favoritedIJsbeelden) {
      console.log("IJSBEELDEN IN FINAL FAVORITED ARRAY");
    } else {
      console.log("IJSBEELDEN NOT IN FINAL FAVORITED ARRAY");
    }

    // Sort festivals by name in each stage
    Object.keys(stageMap).forEach(stageKey => {
      const stage = stageKey as SalesStage;
      stageMap[stage].sort((a, b) => a.name.localeCompare(b.name));
    });

    // DEBUG: Log final counts for each stage
    console.log('🔍 FINAL STAGE COUNTS:', {
      favorited: stageMap.favorited.length,
      outreach: stageMap.outreach.length,
      talking: stageMap.talking.length,
      offer: stageMap.offer.length,
      deal: stageMap.deal.length,
      total: Object.values(stageMap).reduce((acc, arr) => acc + arr.length, 0)
    });

    setFestivalsByStage(stageMap);
  }, [allFestivals, isSearching, searchTerm, filterMode, currentMonth, showAllFestivals, showNullDates, weekFilterActive, selectedWeek]);

  // DISABLED: Set up periodic refresh for research data to prevent excessive API calls
  useEffect(() => {
    if (allFestivals.length === 0) return;
    
    // DISABLED: No more periodic refresh to prevent excessive API calls
    // Research data will only be fetched on initial load
    // Users can manually refresh if needed
    console.log('Sales monitor: Periodic research refresh disabled to prevent excessive API calls');
    
  }, [allFestivals.length]); // Removed fetchFestivalsWithResearch from dependencies

  // Apply filters when festivals or filter criteria change
  useEffect(() => {
    if (allFestivals.length === 0) return;
    
    applyFilters(allFestivals);
    setLastUpdated(new Date());
  }, [allFestivals, isSearching, searchTerm, filterMode, currentMonth, showAllFestivals, showNullDates, weekFilterActive, selectedWeek, applyFilters]);

  // Function to move a festival to a different stage
  const moveFestival = async (festivalId: string, fromStage: SalesStage, toStage: SalesStage) => {
    try {
      // Find the festival in the current stage
      const festival = festivalsByStage[fromStage].find(f => f.id === festivalId);
      
      if (!festival) return;
      
      // Update using FestivalContext
      updateSalesStage(festivalId, toStage);
      
      // The UI will update automatically when the context updates
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update festival stage');
      console.error('Error moving festival:', err);
    }
  };
  
  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setIsSearching(false);
  };

  // Handle week selection
  const handleWeekSelect = (weekNumber: number) => {
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
  
  // Get available months for quick navigation
  const availableMonths = useMemo(() => {
    const months: Date[] = [];
    const startYear = 2025;
    const endYear = 2025;
    
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 0; month < 12; month++) {
        months.push(new Date(year, month, 1));
      }
    }
    return months;
  }, []);
  
  // Get available weeks for the current month
  const weeksInCurrentMonth = useMemo(() => {
    interface WeekData {
      weekNumber: number;
      display: string;
      startDate: Date;
      endDate: Date;
    }
    
    const weeksData: WeekData[] = [];
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
        startDate: new Date(weekStart.getTime()),
        endDate: new Date(weekEnd.getTime())
      });
      
      // Move to next week
      weekStart = addWeeks(weekStart, 1);
    }
    
    console.log(`Generated ${weeksData.length} weeks for ${format(currentMonth, 'MMMM yyyy')}`);
    return weeksData;
  }, [currentMonth]);

  return (
    <div className="p-4 max-w-full mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sales Monitor</h1>
        
        {/* Refresh button and last updated time */}
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Last updated: {format(lastUpdated, 'HH:mm:ss')}
            </span>
          )}
          <button 
            onClick={handleRefresh} 
            className="flex items-center gap-1 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>
      
      {/* Integrated search and filter bar */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search input */}
          <div className="flex-grow">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search festivals by name, location, or notes..."
                className="w-full p-2 pl-10 border rounded"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsSearching(e.target.value.trim().length > 0);
                }}
              />
              {searchTerm && (
                <button 
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <span className="text-gray-400 hover:text-gray-600">×</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Filter buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-4 py-2 rounded transition-colors ${
                filterMode === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('favorited')}
              className={`px-4 py-2 rounded transition-colors ${
                filterMode === 'favorited'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              Favorited
            </button>
            <button
              onClick={() => setFilterMode('archived')}
              className={`px-4 py-2 rounded transition-colors ${
                filterMode === 'archived'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
            >
              Archived
            </button>
          </div>
        </div>
      </div>
      
      {/* Month Navigation - Added from Festivals page */}
      <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex items-center justify-center mb-4">
          {/* Empty div to maintain consistent layout with festivals page */}
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
        
        {/* Week Number Shortcuts - Only show when not in "Unknown" section or "Show All" */}
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
            
            {/* Display all week buttons */}
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
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {contextLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2 mt-4">
          {stages.map((stage, index) => (
            <div 
              key={stage.id} 
              className="flex-1 min-w-[250px] bg-gray-50 dark:bg-gray-850 rounded-md p-2 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-center mb-2 sticky top-0 bg-gray-50 dark:bg-gray-850 p-2">
                <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                  {stage.title}
                  <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                    ({festivalsByStage[stage.id]?.length || 0})
                  </span>
                </h2>
              </div>
              
              <div className="space-y-2">
                {festivalsByStage[stage.id]?.map(festival => (
                  <FestivalCard
                    key={festival.id}
                    festival={festival}
                    onMoveStage={moveFestival}
                    currentStage={stage.id}
                    nextStage={stages[Math.min(index + 1, stages.length - 1)].id}
                    previousStage={stages[Math.max(index - 1, 0)].id}
                  />
                ))}
                
                {festivalsByStage[stage.id]?.length === 0 && (
                  <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                    No festivals in this stage
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SalesMonitor; 