'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useStorage } from './StorageContext';
import { useNotification } from './NotificationContext';
import { FestivalWithRateCard, RateCardUpdatePayload } from '../../lib/types/rate-card';

// Define types
interface Festival {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  country: string;
  source: string;
  source_url?: string;
  url?: string;
  emails?: string[];
  linkedin_url?: string;
  rate_card_requested?: boolean;
  rate_card_received?: boolean;
  rate_card_date?: string | null;
  rate_card_notes?: string | null;
  // Research and company discovery fields
  research_data?: any;
  organizing_company?: string;
  homepage_url?: string;
  last_verified?: string;
  // Add user preference fields that now come from database
  favorite?: boolean;
  archived?: boolean;
  notes?: string;
  sales_stage?: string;
}

interface ResearchStatus {
  id: string;
  status: 'pending' | 'complete' | 'failed';
}

interface FestivalWithPreferences extends Festival {
  favorite: boolean;
  archived: boolean;
  notes?: string;
  sales_stage?: string;
  rate_card_requested?: boolean;
  rate_card_received?: boolean;
  rate_card_date?: string | null;
  rate_card_notes?: string | null;
  research?: ResearchStatus | null;
}

interface FestivalContextType {
  festivals: FestivalWithPreferences[];
  loading: boolean;
  loadingProgress: {
    loaded: number;
    total: number;
    percentage: number;
    isChunkedLoading: boolean;
  } | null;
  fetchFestivals: (forceRefresh?: boolean) => Promise<void>;
  updateFestival: (festivalId: string, updates: Partial<FestivalWithPreferences>) => void;
  toggleFavorite: (festivalId: string, isFavorite: boolean) => void;
  toggleArchived: (festivalId: string, isArchived: boolean) => void;
  updateNotes: (festivalId: string, notes: string) => void;
  updateDates: (festivalId: string, startDate: string, endDate: string) => void;
  updateSalesStage: (festivalId: string, salesStage: string) => void;
  updateRateCard: (festivalId: string, updates: RateCardUpdatePayload) => Promise<boolean>;
  updateEmails: (festivalId: string, email: string) => Promise<void>;
  updateLinkedIn: (festivalId: string, linkedinUrl: string) => Promise<void>;
  initiateResearch: (festivalId: string, aiService?: string) => Promise<ResearchStatus>;
  getResearchStatus: (festivalId: string) => ResearchStatus | null;
  refreshResearchStatus: (festivalId: string, showNotifications?: boolean) => Promise<ResearchStatus | null>;
  forceRefreshResearchStatus: (festivalId: string) => Promise<ResearchStatus | null>;
  clearAllResearchData: () => Promise<void>;
  fetchFestivalsWithResearch: () => Promise<void>;
  researchStatus: { [festivalId: string]: ResearchStatus };
}

// LocalStorage keys
const FAVORITES_STORAGE_KEY = 'festifind-favorites';
const ARCHIVED_STORAGE_KEY = 'festifind-archived';
const NOTES_STORAGE_KEY = 'festifind-notes';
const SALES_STAGE_STORAGE_KEY = 'festifind-sales-stages';
const RATE_CARD_STORAGE_KEY = 'festifind-rate-cards';
const RESEARCH_STATUS_KEY = 'festifind-research-status';

// Create context
const FestivalContext = createContext<FestivalContextType | undefined>(undefined);

export const FestivalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [festivals, setFestivals] = useState<FestivalWithPreferences[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [researchStatus, setResearchStatus] = useState<{[key: string]: ResearchStatus}>({});
  const [loadingProgress, setLoadingProgress] = useState<{
    loaded: number;
    total: number;
    percentage: number;
    isChunkedLoading: boolean;
  } | null>(null);
  
  // Use useRef for simple polling state management
  const pollingState = useRef({
    pollingInterval: null as NodeJS.Timeout | null,
    isPolling: false
  });
  
  const storage = useStorage();
  const { showSuccess, showError, showInfo } = useNotification();

  // Load research status from localStorage
  const loadResearchStatus = () => {
    try {
      const savedResearch = storage.getItem(RESEARCH_STATUS_KEY);
      if (savedResearch) {
        const parsedResearch = JSON.parse(savedResearch);
        setResearchStatus(parsedResearch);
        return parsedResearch;
      }
    } catch (error) {
      console.error('Error loading research status:', error);
    }
    return {};
  };

  // Save research status to localStorage
  const saveResearchStatus = (newStatus: {[key: string]: ResearchStatus}) => {
    try {
      storage.setItem(RESEARCH_STATUS_KEY, JSON.stringify(newStatus));
    } catch (error) {
      console.error('Error saving research status:', error);
    }
  };

  // Fetch festivals data from API
  const fetchFestivals = async (forceRefresh: boolean = false) => {
    // Skip if we already have data (unless force refresh is requested)
    if (festivals.length > 0 && !forceRefresh) {
      console.log(`Skipping festival fetch - already have ${festivals.length} festivals`);
      return;
    }
    
    if (forceRefresh) {
      console.log(`🔄 Force refreshing festival data (including emails) for ${festivals.length} festivals`);
    }

    try {
      setLoading(true);
      setLoadingProgress({
        loaded: 0,
        total: 0,
        percentage: 0,
        isChunkedLoading: true
      });
      
      console.log('🚀 Starting festival fetch...');
      
      // First, get the first chunk to determine total count
      const firstResponse = await fetch('/api/festivals?chunked=true&page=1&limit=1000');
      
      if (!firstResponse.ok) {
        throw new Error(`Failed to fetch festivals: ${firstResponse.statusText}`);
      }
      
      const firstData = await firstResponse.json();
      
      if (!firstData.pagination) {
        // Fallback to non-chunked loading if pagination not supported
        console.log('Chunked loading not supported, falling back to single request');
        const response = await fetch('/api/festivals');
        if (!response.ok) {
          throw new Error(`Failed to fetch festivals: ${response.statusText}`);
        }
        let data = await response.json();
        console.log(`API returned ${data.length} total festivals`);
        
        // Process data as before
        const processedData = await processAndMergeFestivalData(data);
        setFestivals(processedData);
        setInitialized(true);
        showSuccess(`Loaded ${processedData.length} festivals`);
        setLoadingProgress(null);
        return;
      }
      
      const { total, totalPages } = firstData.pagination;
      let allFestivals = [...firstData.data];
      
      // Update progress with first chunk
      setLoadingProgress({
        loaded: firstData.data.length,
        total,
        percentage: Math.round((firstData.data.length / total) * 100),
        isChunkedLoading: true
      });
      
      console.log(`📊 Starting chunked loading: ${totalPages} pages, ${total} total festivals`);
      console.log(`✅ First chunk loaded: ${firstData.data.length} festivals`);
      
      // Fetch remaining chunks sequentially to avoid overwhelming the server
      for (let page = 2; page <= totalPages; page++) {
        try {
          console.log(`📥 Fetching page ${page}/${totalPages}...`);
          const response = await fetch(`/api/festivals?chunked=true&page=${page}&limit=1000`);
          
          if (!response.ok) {
            console.error(`❌ Failed to fetch page ${page}: ${response.statusText}`);
            throw new Error(`Failed to fetch page ${page}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data.data && Array.isArray(data.data)) {
            // Add the new chunk to our collection
            allFestivals.push(...data.data);
            
            // Update progress with accurate count
            const currentLoaded = allFestivals.length;
            setLoadingProgress(prev => prev ? {
              ...prev,
              loaded: currentLoaded,
              percentage: Math.round((currentLoaded / total) * 100)
            } : null);
            
            console.log(`✅ Loaded page ${page}/${totalPages}: ${data.data.length} festivals (total so far: ${currentLoaded}/${total})`);
          } else {
            console.warn(`⚠️ Page ${page} returned invalid data:`, data);
          }
          
          // Small delay between requests to be nice to the server
          if (page < totalPages) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`❌ Error fetching page ${page}:`, error);
          // Continue with other pages even if one fails
          showError(`Failed to load page ${page} of festivals`);
        }
      }
      
      console.log(`🎉 Chunked loading complete: ${allFestivals.length} festivals loaded (expected: ${total})`);
      
      // Verify we got all the data we expected
      if (allFestivals.length !== total) {
        console.warn(`⚠️ Warning: Expected ${total} festivals but got ${allFestivals.length}`);
        showError(`Warning: Expected ${total} festivals but only loaded ${allFestivals.length}`);
      } else {
        console.log(`✅ Successfully loaded all ${allFestivals.length} festivals`);
      }
      
      // Process and merge with localStorage data
      console.log('🔄 Processing and merging festival data...');
      const processedData = await processAndMergeFestivalData(allFestivals);
      
      // Store all festivals
      setFestivals(processedData);
      setInitialized(true);
      showSuccess(`Loaded ${processedData.length} festivals`);
      
      // Clear loading progress
      setLoadingProgress(null);
      
      // Note: Research data will be fetched by the home page after festivals are loaded
      // to avoid redundant API calls during initial loading
    } catch (error) {
      console.error('❌ Error fetching festivals:', error);
      if (error instanceof Error) {
        showError(`Error loading festivals: ${error.message}`);
      }
      setLoadingProgress(null);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to process and merge festival data with localStorage
  const processAndMergeFestivalData = async (data: Festival[]) => {
    // CHANGED: Now prioritize database data over localStorage
    // Only use localStorage as fallback for festivals that don't have database values
    
    // Get saved preferences from localStorage (for fallback only)
    const savedFavorites = storage.getItem(FAVORITES_STORAGE_KEY);
    const favorites = savedFavorites ? JSON.parse(savedFavorites) : {};
    
    const savedArchived = storage.getItem(ARCHIVED_STORAGE_KEY);
    const archived = savedArchived ? JSON.parse(savedArchived) : {};
    
    const savedNotes = storage.getItem(NOTES_STORAGE_KEY);
    const notes = savedNotes ? JSON.parse(savedNotes) : {};
    
    const savedSalesStages = storage.getItem(SALES_STAGE_STORAGE_KEY);
    const salesStages = savedSalesStages ? JSON.parse(savedSalesStages) : {};
    
    // Get saved rate card information from localStorage
    const savedRateCards = storage.getItem(RATE_CARD_STORAGE_KEY);
    const rateCards = savedRateCards ? JSON.parse(savedRateCards) : {};
    
    // Get saved research status
    const research = loadResearchStatus();
    
    // Merge with API data - DATABASE TAKES PRIORITY
    return data.map((festival: Festival) => ({
      ...festival,
      // Use database values if they exist, fallback to localStorage
      favorite: festival.favorite !== undefined ? festival.favorite : (!!favorites[festival.id]),
      archived: festival.archived !== undefined ? festival.archived : (!!archived[festival.id]),
      notes: festival.notes !== undefined ? festival.notes : (notes[festival.id] || ''),
      sales_stage: festival.sales_stage !== undefined ? festival.sales_stage : (salesStages[festival.id] || 'favorited'),
      rate_card_requested: festival.rate_card_requested || rateCards[festival.id]?.requested || false,
      rate_card_received: festival.rate_card_received || rateCards[festival.id]?.received || false,
      rate_card_date: festival.rate_card_date || rateCards[festival.id]?.date || null,
      rate_card_notes: festival.rate_card_notes || rateCards[festival.id]?.notes || null,
      research: research[festival.id] || null
    }));
  };

  // Refresh research status for a festival
  const refreshResearchStatus = async (festivalId: string, showNotifications: boolean = true): Promise<ResearchStatus | null> => {
    try {
      console.log(`🔍 REFRESH: Starting research status refresh for festival: ${festivalId}`);
      const festival = festivals.find(f => f.id === festivalId);
      if (!festival) {
        console.log(`🔍 REFRESH: Festival not found: ${festivalId}`);
        return null;
      }
      
      const response = await fetch(`/api/festivals/${festivalId}/research`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`🔍 REFRESH: Research status check failed for ${festival.name}: ${response.status} ${errorText}`);
        return null;
      }
      
      const data = await response.json();
      console.log(`🔍 REFRESH: Research status for ${festival.name}:`, data);
      
      if (!data || !data.status) {
        console.log(`🔍 REFRESH: No research data found for ${festival.name}`);
        return null;
      }
      
      const newStatus: ResearchStatus = {
        id: data.id || festivalId,
        status: data.status
      };
      
      // Check if status has changed
      const currentStatus = researchStatus[festivalId];
      const statusChanged = !currentStatus || currentStatus.status !== newStatus.status;
      
      if (statusChanged) {
        console.log(`🔍 REFRESH: Status changed for ${festival.name}: ${currentStatus?.status || 'none'} → ${newStatus.status}`);
        
        // Update research status
        const updatedResearchStatus = {
          ...researchStatus,
          [festivalId]: newStatus
        };
        setResearchStatus(updatedResearchStatus);
        saveResearchStatus(updatedResearchStatus);
        
        // Update festivals array
        setFestivals(prevFestivals => 
          prevFestivals.map(f => 
            f.id === festivalId 
              ? { ...f, research: newStatus }
              : f
          )
        );
        
        // Show notification for status changes (if requested)
        if (showNotifications) {
          if (newStatus.status === 'complete') {
            showSuccess(`Research for ${festival.name} is ready!`);
          } else if (newStatus.status === 'failed') {
            showError(`Research for ${festival.name} failed.`);
          }
        }
      }
      
      return newStatus;
    } catch (error) {
      console.error(`🔍 REFRESH: Error refreshing research status for festival ${festivalId}:`, error);
      return null;
    }
  };

  // Fetch all festivals with research data in one API call
  const fetchFestivalsWithResearch = async (showNotifications: boolean = true): Promise<void> => {
    try {
      console.log('[RESEARCH] Making API call to /api/festivals/research');
      
      // Make one API call to get all research data
      const response = await fetch('/api/festivals/research');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch research data: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Safely handle empty array or undefined response
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('[RESEARCH] No research data available yet');
        return;
      }
      
      console.log(`[RESEARCH] Received research data for ${data.length} festivals`);
      
      // Update local state with all research statuses in one go
      const newResearchStatus = { ...researchStatus };
      let updatedCount = 0;
      const newlyCompletedResearch: string[] = []; // Explicitly type as string array
      
      data.forEach(item => {
        // Check if this is a newly completed research
        const wasCompleteAlready = researchStatus[item.festival_id]?.status === 'complete';
        const isNowComplete = item.status === 'complete';
        
        // Only count as updated if it's newly complete (wasn't complete before)
        if (isNowComplete) {
          if (!wasCompleteAlready) {
            updatedCount++;
            
            // Find festival name for notification
            const festival = festivals.find(f => f.id === item.festival_id);
            if (festival) {
              newlyCompletedResearch.push(festival.name);
            }
          }
        }
        
        newResearchStatus[item.festival_id] = {
          id: item.id,
          status: item.status
        };
      });
      
      // Update state and localStorage
      setResearchStatus(newResearchStatus);
      saveResearchStatus(newResearchStatus);
      
      // Update the festivals array with research data
      setFestivals(prevFestivals => 
        prevFestivals.map(f => {
          const research = newResearchStatus[f.id];
          return research ? { ...f, research } : f;
        })
      );
      
      // Show notification about available research - but be more specific about what's new
      if (updatedCount > 0 && showNotifications) {
        if (newlyCompletedResearch.length === 1) {
          showSuccess(`Research for ${newlyCompletedResearch[0]} is now available!`);
        } else if (newlyCompletedResearch.length <= 3) {
          showSuccess(`Research is now available for: ${newlyCompletedResearch.join(', ')}`);
        } else {
          showSuccess(`${updatedCount} new festivals have research available`);
        }
        
        // Also dispatch events for individual completed researches to update UI
        if (typeof window !== 'undefined') {
          newlyCompletedResearch.forEach(festivalName => {
            const festival = festivals.find(f => f.name === festivalName);
            if (festival) {
              const event = new CustomEvent('festival-research-completed', {
                detail: {
                  festivalId: festival.id,
                  status: newResearchStatus[festival.id]
                }
              });
              document.dispatchEvent(event);
            }
          });
        }
      }
      
      console.log(`[RESEARCH] Research fetch completed successfully`);
    } catch (error) {
      console.error('[RESEARCH] Error fetching festivals with research:', error);
      if (error instanceof Error) {
        showError(`Failed to fetch research data: ${error.message}`);
      }
    }
  };

  // Clear all research data from localStorage and state
  const clearAllResearchData = async (): Promise<void> => {
    try {
      console.log('🗑️ DEV TOOLS: Clearing all research data...');
      
      // Clear localStorage
      if (typeof window !== 'undefined') {
        storage.removeItem(RESEARCH_STATUS_KEY);
        console.log('🗑️ DEV TOOLS: Cleared localStorage research data');
      }
      
      // Clear in-memory state
      setResearchStatus({});
      
      // Update festivals to remove research data
      setFestivals(prevFestivals => 
        prevFestivals.map(f => ({ ...f, research: null }))
      );
      
      // Clear database research data
      const response = await fetch('/api/festivals/research', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to clear database research data: ${response.statusText}`);
      }
      
      console.log('✅ DEV TOOLS: Successfully cleared all research data');
      showSuccess('All research data cleared successfully!');
      
      // Dispatch event to update all UI components
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('research-data-cleared', {
          detail: { timestamp: Date.now() }
        });
        document.dispatchEvent(event);
      }
      
    } catch (error) {
      console.error('❌ DEV TOOLS: Error clearing research data:', error);
      showError(`Failed to clear research data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // Initial setup and sync
  useEffect(() => {
    const initializeContext = async () => {
      // Sync localStorage preferences to database (one-time migration)
      await syncLocalStorageToDatabase();
      
      // Then fetch festivals
      if (!initialized) {
        await fetchFestivals();
      }
    };
    
    initializeContext();
  }, [initialized]); // Run once when context initializes

  // Load research data after festivals are loaded
  useEffect(() => {
    if (festivals.length > 0 && !loading) {
      console.log('[RESEARCH] Festivals loaded, fetching research data...');
      fetchFestivalsWithResearch(false); // Don't show notifications on initial load
    }
  }, [festivals.length, loading]);

  // Clean up localStorage by removing invalid UUIDs
  const cleanupLocalStorage = () => {
    try {
      // Clean up favorites
      const savedFavorites = storage.getItem(FAVORITES_STORAGE_KEY);
      if (savedFavorites) {
        const favoritesObj = JSON.parse(savedFavorites);
        const cleanedFavorites = Object.keys(favoritesObj)
          .filter(isValidUUID)
          .reduce((obj, key) => {
            obj[key] = favoritesObj[key];
            return obj;
          }, {});
        storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(cleanedFavorites));
      }
      
      // Clean up archived
      const savedArchived = storage.getItem(ARCHIVED_STORAGE_KEY);
      if (savedArchived) {
        const archivedObj = JSON.parse(savedArchived);
        const cleanedArchived = Object.keys(archivedObj)
          .filter(isValidUUID)
          .reduce((obj, key) => {
            obj[key] = archivedObj[key];
            return obj;
          }, {});
        storage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(cleanedArchived));
      }
      
      // Clean up notes
      const savedNotes = storage.getItem(NOTES_STORAGE_KEY);
      if (savedNotes) {
        const notesObj = JSON.parse(savedNotes);
        const cleanedNotes = Object.keys(notesObj)
          .filter(isValidUUID)
          .reduce((obj, key) => {
            obj[key] = notesObj[key];
            return obj;
          }, {});
        storage.setItem(NOTES_STORAGE_KEY, JSON.stringify(cleanedNotes));
      }
      
      // Clean up sales stages
      const savedSalesStages = storage.getItem(SALES_STAGE_STORAGE_KEY);
      if (savedSalesStages) {
        const salesStagesObj = JSON.parse(savedSalesStages);
        const cleanedSalesStages = Object.keys(salesStagesObj)
          .filter(isValidUUID)
          .reduce((obj, key) => {
            obj[key] = salesStagesObj[key];
            return obj;
          }, {});
        storage.setItem(SALES_STAGE_STORAGE_KEY, JSON.stringify(cleanedSalesStages));
      }
      
      // Clean up rate cards
      const savedRateCards = storage.getItem(RATE_CARD_STORAGE_KEY);
      if (savedRateCards) {
        const rateCardsObj = JSON.parse(savedRateCards);
        const cleanedRateCards = Object.keys(rateCardsObj)
          .filter(isValidUUID)
          .reduce((obj, key) => {
            obj[key] = rateCardsObj[key];
            return obj;
          }, {});
        storage.setItem(RATE_CARD_STORAGE_KEY, JSON.stringify(cleanedRateCards));
      }
      
      // Clean up research status
      const savedResearch = storage.getItem(RESEARCH_STATUS_KEY);
      if (savedResearch) {
        const researchObj = JSON.parse(savedResearch);
        const cleanedResearch = Object.keys(researchObj)
          .filter(isValidUUID)
          .reduce((obj, key) => {
            obj[key] = researchObj[key];
            return obj;
          }, {});
        storage.setItem(RESEARCH_STATUS_KEY, JSON.stringify(cleanedResearch));
      }
      
      console.log('Local storage cleanup completed');
    } catch (error) {
      console.error('Error cleaning up localStorage:', error);
    }
  };

  // Helper function to validate UUID
  const isValidUUID = (id: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  // Sync all notes from localStorage to the database once
  const syncNotesToDatabase = async () => {
    try {
      const savedNotes = storage.getItem(NOTES_STORAGE_KEY);
      if (!savedNotes) return;
      
      const notesObj = JSON.parse(savedNotes);
      const festivalIds = Object.keys(notesObj).filter(isValidUUID);
      
      if (festivalIds.length === 0) return;
      
      console.log(`Syncing ${festivalIds.length} notes to database...`);
      
      // Process in batches to avoid too many simultaneous requests
      const batchSize = 5;
      for (let i = 0; i < festivalIds.length; i += batchSize) {
        const batch = festivalIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (festivalId) => {
            const notes = notesObj[festivalId];
            if (!notes) return;
            
            try {
              const response = await fetch(`/api/festivals/${festivalId}/notes`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ notes }),
              });
              
              if (!response.ok) {
                // Handle different response statuses
                if (response.status === 404) {
                  console.warn(`Festival ${festivalId} not found. Skipping notes sync.`);
                  // Remove the invalid ID from localStorage to prevent future attempts
                  delete notesObj[festivalId];
                } else {
                  throw new Error(`Error syncing notes for festival ${festivalId}. Status: ${response.status}`);
                }
              }
            } catch (error) {
              console.error(`Failed to sync notes for festival ${festivalId}:`, error);
            }
          })
        );
      }
      
      // Update localStorage with cleaned data
      storage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesObj));
      
      console.log('Notes sync completed');
    } catch (error) {
      console.error('Error syncing notes to database:', error);
    }
  };
  
  // Sync all favorites from localStorage to the database once
  const syncFavoritesToDatabase = async () => {
    try {
      const savedFavorites = storage.getItem(FAVORITES_STORAGE_KEY);
      if (!savedFavorites) return;
      
      const favoritesObj = JSON.parse(savedFavorites);
      const festivalIds = Object.keys(favoritesObj).filter(isValidUUID);
      
      if (festivalIds.length === 0) return;
      
      console.log(`Syncing ${festivalIds.length} favorites to database...`);
      
      // Process in batches to avoid too many simultaneous requests
      const batchSize = 5;
      for (let i = 0; i < festivalIds.length; i += batchSize) {
        const batch = festivalIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (festivalId) => {
            if (!favoritesObj[festivalId]) return;
            
            try {
              const response = await fetch(`/api/festivals/${festivalId}/favorite`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ favorite: true }),
              });
              
              if (!response.ok) {
                // Handle different response statuses
                if (response.status === 404) {
                  console.warn(`Festival ${festivalId} not found. Skipping favorite sync.`);
                  // Remove the invalid ID from localStorage to prevent future attempts
                  delete favoritesObj[festivalId];
                } else {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(`Error syncing favorite status for festival ${festivalId}. Status: ${response.status}. Message: ${errorData.message || 'Unknown error'}`);
                }
              }
            } catch (error) {
              console.error(`Failed to sync favorite status for festival ${festivalId}:`, error);
            }
          })
        );
      }
      
      // Update localStorage with cleaned data
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoritesObj));
      
      console.log('Favorites sync completed');
    } catch (error) {
      console.error('Error syncing favorites to database:', error);
    }
  };
  
  // Sync all archived festivals from localStorage to the database once
  const syncArchivedToDatabase = async () => {
    try {
      const savedArchived = storage.getItem(ARCHIVED_STORAGE_KEY);
      if (!savedArchived) return;
      
      const archivedObj = JSON.parse(savedArchived);
      const festivalIds = Object.keys(archivedObj).filter(isValidUUID);
      
      if (festivalIds.length === 0) return;
      
      console.log(`Syncing ${festivalIds.length} archived festivals to database...`);
      
      // Process in batches to avoid too many simultaneous requests
      const batchSize = 5;
      for (let i = 0; i < festivalIds.length; i += batchSize) {
        const batch = festivalIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (festivalId) => {
            if (!archivedObj[festivalId]) return;
            
            try {
              const response = await fetch(`/api/festivals/${festivalId}/archive`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ archived: true }),
              });
              
              if (!response.ok) {
                // Handle different response statuses
                if (response.status === 404) {
                  console.warn(`Festival ${festivalId} not found. Skipping archive sync.`);
                  // Remove the invalid ID from localStorage to prevent future attempts
                  delete archivedObj[festivalId];
                } else {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(`Error syncing archive status for festival ${festivalId}. Status: ${response.status}. Message: ${errorData.message || 'Unknown error'}`);
                }
              }
            } catch (error) {
              console.error(`Failed to sync archive status for festival ${festivalId}:`, error);
            }
          })
        );
      }
      
      // Update localStorage with cleaned data
      storage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(archivedObj));
      
      console.log('Archived festivals sync completed');
    } catch (error) {
      console.error('Error syncing archived festivals to database:', error);
    }
  };
  
  // Sync all sales stages from localStorage to the database once
  const syncSalesStagesToDatabase = async () => {
    try {
      const savedSalesStages = storage.getItem(SALES_STAGE_STORAGE_KEY);
      if (!savedSalesStages) return;
      
      const salesStagesObj = JSON.parse(savedSalesStages);
      const festivalIds = Object.keys(salesStagesObj).filter(isValidUUID);
      
      if (festivalIds.length === 0) return;
      
      console.log(`Syncing ${festivalIds.length} sales stages to database...`);
      
      // Process in batches to avoid too many simultaneous requests
      const batchSize = 5;
      for (let i = 0; i < festivalIds.length; i += batchSize) {
        const batch = festivalIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (festivalId) => {
            const salesStage = salesStagesObj[festivalId];
            if (!salesStage) return;
            
            try {
              const response = await fetch(`/api/festivals/${festivalId}/sales-stage`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sales_stage: salesStage }),
              });
              
              if (!response.ok) {
                // Handle different response statuses
                if (response.status === 404) {
                  console.warn(`Festival ${festivalId} not found. Skipping sales stage sync.`);
                  // Remove the invalid ID from localStorage to prevent future attempts
                  delete salesStagesObj[festivalId];
                } else {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(`Error syncing sales stage for festival ${festivalId}. Status: ${response.status}. Message: ${errorData.message || 'Unknown error'}`);
                }
              }
            } catch (error) {
              console.error(`Failed to sync sales stage for festival ${festivalId}:`, error);
            }
          })
        );
      }
      
      // Update localStorage with cleaned data
      storage.setItem(SALES_STAGE_STORAGE_KEY, JSON.stringify(salesStagesObj));
      
      console.log('Sales stages sync completed');
    } catch (error) {
      console.error('Error syncing sales stages to database:', error);
    }
  };
  
  // New function to sync rate card information to database
  const syncRateCardsToDatabase = async () => {
    try {
      const savedRateCards = storage.getItem(RATE_CARD_STORAGE_KEY);
      if (!savedRateCards) return;
      
      const rateCardsObj = JSON.parse(savedRateCards);
      const festivalIds = Object.keys(rateCardsObj).filter(isValidUUID);
      
      if (festivalIds.length === 0) return;
      
      console.log(`Syncing ${festivalIds.length} rate cards to database...`);
      
      // Process in batches to avoid too many simultaneous requests
      const batchSize = 5;
      for (let i = 0; i < festivalIds.length; i += batchSize) {
        const batch = festivalIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (festivalId) => {
            const rateCardInfo = rateCardsObj[festivalId];
            if (!rateCardInfo) return;
            
            try {
              const response = await fetch(`/api/festivals/${festivalId}/rate-card`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(rateCardInfo),
              });
              
              if (!response.ok) {
                // Handle different response statuses
                if (response.status === 404) {
                  console.warn(`Festival ${festivalId} not found. Skipping rate card sync.`);
                  // Remove the invalid ID from localStorage to prevent future attempts
                  delete rateCardsObj[festivalId];
                } else {
                  const errorData = await response.json().catch(() => ({}));
                  throw new Error(`Error syncing rate card for festival ${festivalId}. Status: ${response.status}. Message: ${errorData.message || 'Unknown error'}`);
                }
              }
            } catch (error) {
              console.error(`Failed to sync rate card for festival ${festivalId}:`, error);
            }
          })
        );
      }
      
      // Update localStorage with cleaned data
      storage.setItem(RATE_CARD_STORAGE_KEY, JSON.stringify(rateCardsObj));
      
      console.log('Rate cards sync completed');
    } catch (error) {
      console.error('Error syncing rate cards to database:', error);
    }
  };
  
  // Run sync once after initialization
  useEffect(() => {
    if (initialized && !loading) {
      syncNotesToDatabase();
      syncFavoritesToDatabase();
      syncArchivedToDatabase();
      syncSalesStagesToDatabase();
      syncRateCardsToDatabase();
    }
  }, [initialized, loading]);

  // Update a festival
  const updateFestival = (festivalId: string, updates: Partial<FestivalWithPreferences>) => {
    setFestivals(prev => 
      prev.map(festival => 
        festival.id === festivalId 
          ? { ...festival, ...updates } 
          : festival
      )
    );
  };

  // Toggle favorite status
  const toggleFavorite = (festivalId: string, isFavorite: boolean) => {
    // Validate festival ID
    if (!isValidUUID(festivalId)) {
      console.error(`Invalid festival ID format: ${festivalId}`);
      showError(`Error updating favorite status: Invalid festival ID format`);
      return;
    }
    
    // SMART FAVORITING LOGIC:
    // If unfavoriting a festival that's in any sales monitor lane (not 'favorited'),
    // reset it to 'favorited' stage (removes from sales monitor)
    const currentFestival = festivals.find(f => f.id === festivalId);
    const updatesObject: Partial<FestivalWithPreferences> = { favorite: isFavorite };
    
    if (!isFavorite && currentFestival?.sales_stage && currentFestival.sales_stage !== 'favorited') {
      // Unfavoriting a festival in a sales stage - remove from sales monitor
      updatesObject.sales_stage = 'favorited';
      showInfo(`Festival removed from sales monitor`);
    }
    
    // Update state
    updateFestival(festivalId, updatesObject);
    
    // Update localStorage (keeping for backward compatibility)
    const savedFavorites = storage.getItem(FAVORITES_STORAGE_KEY);
    const favoritesObj = savedFavorites ? JSON.parse(savedFavorites) : {};
    
    if (isFavorite) {
      favoritesObj[festivalId] = true;
    } else {
      delete favoritesObj[festivalId];
    }
    
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoritesObj));
    
    // Update sales stage localStorage if needed
    if (updatesObject.sales_stage) {
      const savedSalesStages = storage.getItem(SALES_STAGE_STORAGE_KEY);
      const salesStagesObj = savedSalesStages ? JSON.parse(savedSalesStages) : {};
      salesStagesObj[festivalId] = updatesObject.sales_stage;
      storage.setItem(SALES_STAGE_STORAGE_KEY, JSON.stringify(salesStagesObj));
    }
    
    // Save both favorite status and sales stage to database
    Promise.all([
      // Update favorite status
      fetch(`/api/festivals/${festivalId}/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ favorite: isFavorite }),
      }),
      // Update sales stage if needed
      updatesObject.sales_stage ? fetch(`/api/festivals/${festivalId}/sales-stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sales_stage: updatesObject.sales_stage }),
      }) : null
    ])
    .then(async ([favoriteResponse, salesStageResponse]) => {
      if (!favoriteResponse.ok) {
        throw new Error('Failed to save favorite status to database');
      }
      if (salesStageResponse && !salesStageResponse.ok) {
        throw new Error('Failed to save sales stage to database');
      }
      // Parse responses
      await favoriteResponse.json();
      if (salesStageResponse) {
        await salesStageResponse.json();
      }
    })
    .catch(error => {
      console.error('Error saving to database:', error);
      showError(`Error updating festival: ${error.message}`);
    });
  };

  // Toggle archived status
  const toggleArchived = (festivalId: string, isArchived: boolean) => {
    // Validate festival ID
    if (!isValidUUID(festivalId)) {
      console.error(`Invalid festival ID format: ${festivalId}`);
      showError(`Error updating archive status: Invalid festival ID format`);
      return;
    }
    
    // Update state
    updateFestival(festivalId, { archived: isArchived });
    
    // Update localStorage
    const savedArchived = storage.getItem(ARCHIVED_STORAGE_KEY);
    const archived = savedArchived ? JSON.parse(savedArchived) : {};
    
    if (isArchived) {
      archived[festivalId] = true;
    } else {
      delete archived[festivalId];
    }
    
    storage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(archived));
    
    // Also save to the database via API
    fetch(`/api/festivals/${festivalId}/archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ archived: isArchived }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to save archive status to database');
      }
      return response.json();
    })
    .catch(error => {
      console.error('Error saving archive status to database:', error);
      showError(`Error updating archive status: ${error.message}`);
    });
  };

  // Update notes
  const updateNotes = (festivalId: string, notes: string) => {
    // Validate festival ID
    if (!isValidUUID(festivalId)) {
      console.error(`Invalid festival ID format: ${festivalId}`);
      showError(`Error updating notes: Invalid festival ID format`);
      return;
    }
    
    // Update state
    updateFestival(festivalId, { notes });
    
    // Update localStorage
    const savedNotes = storage.getItem(NOTES_STORAGE_KEY);
    const notesObj = savedNotes ? JSON.parse(savedNotes) : {};
    
    notesObj[festivalId] = notes;
    
    storage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesObj));
    
    // Also save to the database via API
    fetch(`/api/festivals/${festivalId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to save notes to database');
      }
      return response.json();
    })
    .catch(error => {
      console.error('Error saving notes to database:', error);
      showError(`Error saving notes: ${error.message}`);
    });
  };

  // Update dates
  const updateDates = (festivalId: string, startDate: string, endDate: string) => {
    // Validate festival ID
    if (!isValidUUID(festivalId)) {
      console.error(`Invalid festival ID format: ${festivalId}`);
      showError(`Error updating dates: Invalid festival ID format`);
      return;
    }
    
    // Update state
    updateFestival(festivalId, { start_date: startDate, end_date: endDate });
    
    // For date updates, we would typically want to save to the backend
    // This could be implemented with an API call
  };

  // Update sales stage
  const updateSalesStage = (festivalId: string, salesStage: string) => {
    // Validate festival ID
    if (!isValidUUID(festivalId)) {
      console.error(`Invalid festival ID format: ${festivalId}`);
      showError(`Error updating sales stage: Invalid festival ID format`);
      return;
    }
    
    // SMART FAVORITING LOGIC:
    // When moving a festival to any active sales stage (not 'favorited'), 
    // it should automatically be favorited
    const updatesObject: Partial<FestivalWithPreferences> = { sales_stage: salesStage };
    
    if (salesStage !== 'favorited') {
      // Moving to an active sales stage - auto-favorite
      updatesObject.favorite = true;
    }
    
    // Update state
    updateFestival(festivalId, updatesObject);
    
    // Update localStorage
    const savedSalesStages = storage.getItem(SALES_STAGE_STORAGE_KEY);
    const salesStagesObj = savedSalesStages ? JSON.parse(savedSalesStages) : {};
    salesStagesObj[festivalId] = salesStage;
    storage.setItem(SALES_STAGE_STORAGE_KEY, JSON.stringify(salesStagesObj));
    
    // Update favorites localStorage if auto-favoriting
    if (updatesObject.favorite) {
      const savedFavorites = storage.getItem(FAVORITES_STORAGE_KEY);
      const favoritesObj = savedFavorites ? JSON.parse(savedFavorites) : {};
      favoritesObj[festivalId] = true;
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoritesObj));
    }
    
    // Save both sales stage and favorite status to database
    Promise.all([
      // Update sales stage
      fetch(`/api/festivals/${festivalId}/sales-stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sales_stage: salesStage }),
      }),
      // Update favorite status if needed
      updatesObject.favorite ? fetch(`/api/festivals/${festivalId}/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ favorite: updatesObject.favorite }),
      }) : null
    ])
    .then(async ([salesStageResponse, favoriteResponse]) => {
      if (!salesStageResponse.ok) {
        throw new Error('Failed to save sales stage to database');
      }
      if (favoriteResponse && !favoriteResponse.ok) {
        throw new Error('Failed to save favorite status to database');
      }
      // Parse responses
      await salesStageResponse.json();
      if (favoriteResponse) {
        await favoriteResponse.json();
      }
    })
    .catch(error => {
      console.error('Error saving sales stage to database:', error);
      showError(`Error updating sales stage: ${error.message}`);
    });
  };

  // Update festival rate card information
  const updateRateCard = async (festivalId: string, updates: RateCardUpdatePayload): Promise<boolean> => {
    try {
      // Validate festival ID
      if (!isValidUUID(festivalId)) {
        console.error(`Invalid festival ID format: ${festivalId}`);
        showError(`Error updating rate card: Invalid festival ID format`);
        return false;
      }

      // Optimistic update in state
      updateFestival(festivalId, {
        rate_card_requested: updates.requested !== undefined ? updates.requested : undefined,
        rate_card_received: updates.received !== undefined ? updates.received : undefined,
        rate_card_date: updates.date !== undefined ? updates.date : undefined,
        rate_card_notes: updates.notes !== undefined ? updates.notes : undefined,
      });

      // Also update in localStorage for persistence
      const savedRateCards = storage.getItem(RATE_CARD_STORAGE_KEY);
      const rateCardsObj = savedRateCards ? JSON.parse(savedRateCards) : {};
      
      // Merge new values with existing ones
      rateCardsObj[festivalId] = {
        ...rateCardsObj[festivalId],
        requested: updates.requested !== undefined ? updates.requested : rateCardsObj[festivalId]?.requested || false,
        received: updates.received !== undefined ? updates.received : rateCardsObj[festivalId]?.received || false,
        date: updates.date !== undefined ? updates.date : rateCardsObj[festivalId]?.date || null,
        notes: updates.notes !== undefined ? updates.notes : rateCardsObj[festivalId]?.notes || null,
      };
      
      // Ensure consistency with constraints
      if (rateCardsObj[festivalId].received) {
        rateCardsObj[festivalId].requested = true;
      }
      
      if (rateCardsObj[festivalId].date) {
        rateCardsObj[festivalId].received = true;
        rateCardsObj[festivalId].requested = true;
      }
      
      storage.setItem(RATE_CARD_STORAGE_KEY, JSON.stringify(rateCardsObj));
      
      // Send update to API
      const response = await fetch(`/api/festivals/${festivalId}/rate-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update rate card information on server');
      }
      
      const result = await response.json();
      
      if (result.success) {
        showSuccess('Rate card information updated');
        return true;
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error updating rate card:', error);
      if (error instanceof Error) {
        showError(`Error updating rate card: ${error.message}`);
      }
      return false;
    }
  };

  // Update festival emails
  const updateEmails = async (festivalId: string, email: string): Promise<void> => {
    try {
      // Validate festival ID
      if (!isValidUUID(festivalId)) {
        console.error(`Invalid festival ID format: ${festivalId}`);
        showError(`Error updating emails: Invalid festival ID format`);
        return;
      }

      // Call API to add email
      const response = await fetch(`/api/festivals/${festivalId}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add email');
      }

      const result = await response.json();
      
      // Update the festival in local state with new emails
      setFestivals(prevFestivals => 
        prevFestivals.map(f => 
          f.id === festivalId 
            ? { ...f, emails: result.data.emails }
            : f
        )
      );

      showSuccess('Email address added successfully');
    } catch (error) {
      console.error('Error updating emails:', error);
      showError(`Error adding email: ${error.message}`);
      throw error;
    }
  };

  // Update festival LinkedIn URL
  const updateLinkedIn = async (festivalId: string, linkedinUrl: string): Promise<void> => {
    try {
      // Validate festival ID
      if (!isValidUUID(festivalId)) {
        console.error(`Invalid festival ID format: ${festivalId}`);
        showError(`Error updating LinkedIn: Invalid festival ID format`);
        return;
      }

      // Call API to update LinkedIn URL
      const response = await fetch(`/api/festivals/${festivalId}/linkedin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ linkedin_url: linkedinUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update LinkedIn URL');
      }

      const result = await response.json();
      
      // Update the festival in local state with new LinkedIn URL
      setFestivals(prevFestivals => 
        prevFestivals.map(f => 
          f.id === festivalId 
            ? { ...f, linkedin_url: result.data.linkedin_url }
            : f
        )
      );

      if (linkedinUrl) {
        showSuccess('LinkedIn URL updated successfully');
      } else {
        showSuccess('LinkedIn URL removed');
      }
    } catch (error) {
      console.error('Error updating LinkedIn URL:', error);
      showError(`Error updating LinkedIn: ${error.message}`);
      throw error;
    }
  };

  // Get research status for a festival
  const getResearchStatus = (festivalId: string): ResearchStatus | null => {
    return researchStatus[festivalId] || null;
  };

  // Initiate research for a festival
  const initiateResearch = async (festivalId: string, aiService: string = 'openai'): Promise<ResearchStatus> => {
    try {
      // Find the festival in our state
      const festival = festivals.find(f => f.id === festivalId);
      if (!festival) {
        throw new Error('Festival not found');
      }
      
      // Call the research API with AI service selection
      const response = await fetch(`/api/festivals/${festivalId}/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ aiService })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate research');
      }
      
      const data = await response.json();
      
      // Check if the feature is deprecated
      if (data.status === 'deprecated') {
        // Clear any existing research data for this festival
        const updatedResearchStatus = { ...researchStatus };
        delete updatedResearchStatus[festivalId];
        setResearchStatus(updatedResearchStatus);
        saveResearchStatus(updatedResearchStatus);
        
        // Update the festivals array to remove research data for this festival
        setFestivals(prevFestivals => 
          prevFestivals.map(f => 
            f.id === festivalId 
              ? { ...f, research: null }
              : f
          )
        );
        
        showInfo(`Research feature has been deprecated.`);
        
        // Return a standard format for the UI to handle
        return {
          id: 'deprecated',
          status: 'failed'
        };
      }
      
      // Update local state with research status
      const newStatus: ResearchStatus = {
        id: data.researchId,
        status: data.status
      };
      
      const updatedResearchStatus = {
        ...researchStatus,
        [festivalId]: newStatus
      };
      
      console.log('🔧 [DEBUG] Setting research status:', {
        festivalId,
        newStatus,
        previousResearchStatus: researchStatus,
        updatedResearchStatus,
        festivalName: festival.name
      });
      
      setResearchStatus(updatedResearchStatus);
      saveResearchStatus(updatedResearchStatus);
      
      // Update the festivals state
      setFestivals(prevFestivals => 
        prevFestivals.map(f => 
          f.id === festivalId 
            ? { ...f, research: newStatus }
            : f
        )
      );
      
      // If research is pending, start polling to check for completion
      if (data.status === 'pending') {
        console.log(`🔄 Research initiated for ${festival.name}, starting smart polling`);
        console.log('🔧 [DEBUG] About to call startSmartPolling with research status:', updatedResearchStatus);
        
        // Force start polling immediately (don't rely on useEffect)
        setTimeout(() => {
          console.log('🚀 [DEBUG] Force starting smart polling after state update');
          startSmartPolling();
        }, 100);
        
        showInfo(`Research for ${festival.name} has been initiated.`);
      } else if (data.status === 'complete') {
        showSuccess(`Research for ${festival.name} is ready!`);
      }
      
      return newStatus;
    } catch (error) {
      console.error('Error initiating research:', error);
      if (error instanceof Error) {
        showError(`Research failed: ${error.message}`);
      }
      throw error;
    }
  };

  // Force refresh research status (bypasses throttling)
  const forceRefreshResearchStatus = async (festivalId: string): Promise<ResearchStatus | null> => {
    console.log(`🚀 FORCE REFRESH: Starting force refresh for festival: ${festivalId}`);
    
    try {
      const result = await refreshResearchStatus(festivalId, true);
      console.log(`✅ FORCE REFRESH: Completed for festival: ${festivalId}`, result);
      return result;
    } catch (error) {
      console.error(`❌ FORCE REFRESH: Error for festival: ${festivalId}`, error);
      return null;
    }
  };

  // Smart polling that only runs when there's pending research
  const startSmartPolling = () => {
    if (pollingState.current.isPolling) {
      console.log('🔄 [POLLING] Already polling, skipping start request');
      return; // Already polling
    }
    
    console.log('🚀 [POLLING] Starting enhanced research polling (2-second intervals, 60-second timeout)');
    console.log('🔄 [POLLING] Current research status when starting:', {
      researchStatusCount: Object.keys(researchStatus).length,
      pendingCount: Object.values(researchStatus).filter(r => r.status === 'pending').length,
      researchStatus
    });
    pollingState.current.isPolling = true;
    const startTime = Date.now();
    const POLLING_TIMEOUT = 60000; // 60 seconds
    
    const pollForUpdates = async () => {
      try {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.ceil((POLLING_TIMEOUT - elapsedTime) / 1000);
        
        // Stop if we've been polling for more than 60 seconds
        if (elapsedTime > POLLING_TIMEOUT) {
          console.log('🛑 Polling timeout reached (60 seconds), stopping polling');
          stopSmartPolling();
          return;
        }
        
        // Get festivals with pending research (from our local state)
        const pendingFestivals = Object.entries(researchStatus)
          .filter(([_, status]) => status.status === 'pending')
          .map(([festivalId, _]) => festivalId);
        
        console.log(`🔄 [POLLING] Current research status:`, {
          totalResearchEntries: Object.keys(researchStatus).length,
          pendingCount: pendingFestivals.length,
          pendingFestivals: pendingFestivals.map(id => ({
            id,
            name: festivals.find(f => f.id === id)?.name || 'Unknown'
          })),
          allStatuses: Object.entries(researchStatus).map(([id, status]) => ({
            id,
            name: festivals.find(f => f.id === id)?.name || 'Unknown',
            status: status.status
          }))
        });
        
        // If we have pending festivals, check their status
        if (pendingFestivals.length > 0) {
          console.log(`🔄 [POLLING] Checking research status for ${pendingFestivals.length} festivals (${remainingTime}s remaining):`, 
            pendingFestivals.map(id => festivals.find(f => f.id === id)?.name || id)
          );
          
          // Check each pending festival individually for efficiency
          for (const festivalId of pendingFestivals) {
            const result = await refreshResearchStatus(festivalId, true); // Show notifications when complete
            
            // If research completed, dispatch custom event for UI components
            if (result && result.status === 'complete') {
              console.log(`🎉 Research completed for ${festivals.find(f => f.id === festivalId)?.name || festivalId}, dispatching UI event`);
              const event = new CustomEvent('festival-research-completed', {
                detail: { 
                  festivalId, 
                  status: result,
                  timestamp: Date.now()
                }
              });
              document.dispatchEvent(event);
              
              // Single refresh to capture emails - no need for multiple calls
              const festivalName = festivals.find(f => f.id === festivalId)?.name || festivalId;
              console.log(`📧 Refreshing festival data for ${festivalName} to capture emails`);
              
              // Single refresh after a short delay to ensure emails are captured
              setTimeout(() => {
                console.log(`📧 Email refresh for ${festivalName}`);
                fetchFestivals(true);
              }, 1000);
            }
            
            // Force UI update by triggering a state change
            if (result) {
              setFestivals(prevFestivals => 
                prevFestivals.map(f => 
                  f.id === festivalId 
                    ? { ...f, research: result }
                    : f
                )
              );
            }
          }
        } else {
          // No pending research found - stop polling immediately
          console.log(`✅ [POLLING] No pending research found, stopping polling early`);
          stopSmartPolling();
          return;
        }
      } catch (error) {
        console.error('🔄 Error in targeted polling:', error);
      }
    };
    
    // Poll every 2 seconds for faster UI updates
    pollingState.current.pollingInterval = setInterval(pollForUpdates, 2000);
  };
  
  const stopSmartPolling = () => {
    if (pollingState.current.pollingInterval) {
      console.log('🛑 Stopping smart research polling');
      clearInterval(pollingState.current.pollingInterval);
      pollingState.current.pollingInterval = null;
      pollingState.current.isPolling = false;
    }
  };

  // Monitor research status changes to start polling (but let polling handle its own timeout)
  useEffect(() => {
    const hasPendingResearch = Object.values(researchStatus).some(r => r.status === 'pending');
    
    console.log('🔍 [SMART POLLING] Research status check:', {
      researchStatusCount: Object.keys(researchStatus).length,
      hasPendingResearch,
      statuses: Object.values(researchStatus).map(r => r.status),
      isCurrentlyPolling: pollingState.current.isPolling,
      researchStatusKeys: Object.keys(researchStatus),
      fullResearchStatus: researchStatus
    });
    
    // Only start polling if we have pending research and aren't already polling
    if (hasPendingResearch && !pollingState.current.isPolling) {
      console.log('🚀 [SMART POLLING] Starting targeted polling - pending research detected');
      startSmartPolling();
    } else if (hasPendingResearch && pollingState.current.isPolling) {
      console.log('🔄 [SMART POLLING] Pending research detected but polling already active');
    } else if (!hasPendingResearch && pollingState.current.isPolling) {
      console.log('✅ [SMART POLLING] No pending research found, stopping polling immediately');
      stopSmartPolling();
    } else {
      console.log('😴 [SMART POLLING] No pending research and no polling active');
    }
  }, [researchStatus]);

  // Start polling for pending research
  const startResearchPolling = () => {
    // Legacy function - now redirects to smart polling
    startSmartPolling();
  };
  
  // Stop polling for pending research  
  const stopResearchPolling = () => {
    // Legacy function - now redirects to smart polling
    stopSmartPolling();
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopSmartPolling();
    };
  }, []);

  // One-time sync from localStorage to database
  const syncLocalStorageToDatabase = async () => {
    const SYNC_COMPLETED_KEY = 'festifind-preferences-synced';
    
    // Check if sync has already been completed
    const syncCompleted = storage.getItem(SYNC_COMPLETED_KEY);
    if (syncCompleted === 'true') {
      console.log('Preferences already synced to database, skipping...');
      return;
    }
    
    console.log('Starting one-time sync of localStorage preferences to database...');
    
    try {
      // Get all localStorage data
      const savedFavorites = storage.getItem(FAVORITES_STORAGE_KEY);
      const favorites = savedFavorites ? JSON.parse(savedFavorites) : {};
      
      const savedArchived = storage.getItem(ARCHIVED_STORAGE_KEY);
      const archived = savedArchived ? JSON.parse(savedArchived) : {};
      
      const savedNotes = storage.getItem(NOTES_STORAGE_KEY);
      const notes = savedNotes ? JSON.parse(savedNotes) : {};
      
      const savedSalesStages = storage.getItem(SALES_STAGE_STORAGE_KEY);
      const salesStages = savedSalesStages ? JSON.parse(savedSalesStages) : {};
      
      // Check if there's any data to sync
      const totalItems = Object.keys(favorites).length + Object.keys(archived).length + 
                        Object.keys(notes).length + Object.keys(salesStages).length;
      
      if (totalItems === 0) {
        console.log('No localStorage preferences to sync');
        storage.setItem(SYNC_COMPLETED_KEY, 'true');
        return;
      }
      
      console.log(`Syncing ${totalItems} preference items to database...`);
      
      // Send data to sync API
      const response = await fetch('/api/festivals/sync-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          favorites,
          archived,
          notes,
          salesStages
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Preferences sync completed:', result);
      
      // Mark sync as completed
      storage.setItem(SYNC_COMPLETED_KEY, 'true');
      
      // Show success notification
      showSuccess(`Synced ${result.synced} festival preferences to database`);
      
    } catch (error) {
      console.error('Error syncing preferences to database:', error);
      showError(`Error syncing preferences: ${error.message}`);
    }
  };

  return (
    <FestivalContext.Provider
      value={{
        festivals,
        loading,
        loadingProgress,
        fetchFestivals,
        updateFestival,
        toggleFavorite,
        toggleArchived,
        updateNotes,
        updateDates,
        updateSalesStage,
        updateRateCard,
        updateEmails,
        updateLinkedIn,
        initiateResearch,
        getResearchStatus,
        refreshResearchStatus,
        forceRefreshResearchStatus,
        clearAllResearchData,
        fetchFestivalsWithResearch,
        researchStatus
      }}
    >
      {children}
    </FestivalContext.Provider>
  );
};

export const useFestival = (): FestivalContextType => {
  const context = useContext(FestivalContext);
  if (context === undefined) {
    throw new Error('useFestival must be used within a FestivalProvider');
  }
  return context;
};

export default FestivalContext; 