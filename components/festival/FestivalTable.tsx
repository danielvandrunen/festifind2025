'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, MapPin, Star, Archive, ExternalLink, ChevronLeft, ChevronRight, Edit3, Copy, Globe, Linkedin, Search, ChevronDown, Loader2 } from 'lucide-react';
import { safeParseDate, formatDateRange } from '../../utils/dateUtils';
import { format, addMonths, startOfMonth, endOfMonth, getDay, isSameMonth, isSameDay, isAfter, isBefore, parse, getDaysInMonth } from 'date-fns';
import { RateCardUpdatePayload } from '../../lib/types/rate-card';
import ResearchButton from './ResearchButton';
import ResearchModal from './ResearchModal';
import ApifyResearchPanel from './ApifyResearchPanel';

// CSS for pulsating animation
const pulseKeyframes = `
@keyframes research-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.7);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(147, 51, 234, 0);
    transform: scale(1.05);
  }
}
`;

// Define the festival type
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
  research_data?: any;
  organizing_company?: string;
  homepage_url?: string;
  last_verified?: string;
}

interface ResearchStatus {
  id: string;
  status: 'pending' | 'complete' | 'failed';
}

interface FestivalWithPreferences extends Festival {
  favorite: boolean;
  archived: boolean;
  notes?: string;
  sales_stage?: 'favorited' | 'outreach' | 'talking' | 'offer' | 'deal';
  rate_card_requested?: boolean;
  rate_card_received?: boolean;
  rate_card_date?: string | null;
  rate_card_notes?: string | null;
  research?: ResearchStatus | null;
}

interface FestivalTableProps {
  festivals: FestivalWithPreferences[];
  onFavoriteToggle?: (festivalId: string, isFavorite: boolean) => void;
  onArchiveToggle?: (festivalId: string, isArchived: boolean) => void;
  onNoteSave?: (festivalId: string, note: string) => void;
  onUpdateDates?: (festivalId: string, startDate: string, endDate: string) => void;
  onUpdateRateCard?: (festivalId: string, updates: RateCardUpdatePayload) => Promise<boolean>;
  onResearch?: (festivalId: string) => Promise<void>;
  onEmailUpdate?: (festivalId: string, email: string) => Promise<void>;
  onLinkedInUpdate?: (festivalId: string, linkedinUrl: string) => Promise<void>;
}

// Sales stage badge colors
const salesStageBadgeColors = {
  favorited: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  outreach: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  talking: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  offer: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  deal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
};

const FestivalTable: React.FC<FestivalTableProps> = ({
  festivals,
  onFavoriteToggle,
  onArchiveToggle,
  onNoteSave,
  onUpdateDates,
  onUpdateRateCard,
  onResearch,
  onEmailUpdate,
  onLinkedInUpdate,
}) => {
  const [sortField, setSortField] = useState<keyof Festival>('start_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const textareaRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  const saveTimersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const [activeDatePicker, setActiveDatePicker] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateSelectionState, setDateSelectionState] = useState<'start' | 'end'>('start');
  const [dateSelection, setDateSelection] = useState<{ start_date: Date | null, end_date: Date | null }>({
    start_date: null,
    end_date: null
  });
  const [researchModalOpen, setResearchModalOpen] = useState(false);
  const [selectedFestival, setSelectedFestival] = useState<FestivalWithPreferences | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [editingLinkedIn, setEditingLinkedIn] = useState<string | null>(null);
  const [newLinkedInUrl, setNewLinkedInUrl] = useState('');
  const [expandedResearchPanel, setExpandedResearchPanel] = useState<string | null>(null);
  
  // Track which festivals have active background research running
  const [activeResearch, setActiveResearch] = useState<Set<string>>(new Set());
  // Track festivals where research has completed
  const [completedResearch, setCompletedResearch] = useState<Set<string>>(new Set());
  // Store research abort controllers to allow cancellation
  const researchControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Initialize notes from festivals data when component mounts
  useEffect(() => {
    const initialNotes: { [key: string]: string } = {};
    festivals.forEach(festival => {
      initialNotes[festival.id] = festival.notes || '';
    });
    setNotes(initialNotes);
    
    // Set initial values for textareas after render
    setTimeout(() => {
      festivals.forEach(festival => {
        if (textareaRefs.current[festival.id]) {
          textareaRefs.current[festival.id]!.value = festival.notes || '';
        }
      });
    }, 0);
  }, [festivals]);

  // Set up native event handlers for textareas
  useEffect(() => {
    const setupNativeEventListeners = () => {
      festivals.forEach(festival => {
        const textarea = textareaRefs.current[festival.id];
        if (textarea) {
          // Remove existing listener if present
          textarea.removeEventListener('input', nativeInputHandler);
          
          // Add native input handler that bypasses React
          textarea.addEventListener('input', nativeInputHandler);
        }
      });
    };
    
    const nativeInputHandler = (e: Event) => {
      const textarea = e.target as HTMLTextAreaElement;
      const festivalId = Object.keys(textareaRefs.current).find(
        key => textareaRefs.current[key] === textarea
      );
      
      if (festivalId) {
        // Clear any existing timer
        if (saveTimersRef.current[festivalId]) {
          clearTimeout(saveTimersRef.current[festivalId]);
        }
        
        // Set new timer for background saving
        saveTimersRef.current[festivalId] = setTimeout(() => {
          const value = textarea.value;
          
          // Only update React state when saving
          setNotes(prev => ({
            ...prev,
            [festivalId]: value
          }));
          
          if (onNoteSave) {
            onNoteSave(festivalId, value);
          }
          
          // Clean up timer reference
          delete saveTimersRef.current[festivalId];
        }, 2000);
      }
    };
    
    // Set up the listeners
    setupNativeEventListeners();
    
    // Clean up listeners on unmount
    return () => {
      festivals.forEach(festival => {
        const textarea = textareaRefs.current[festival.id];
        if (textarea) {
          textarea.removeEventListener('input', nativeInputHandler);
        }
      });
    };
  }, [festivals, onNoteSave]);

  // Handle sorting
  const handleSort = (field: keyof Festival) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Handle date picker dialog
  const handleDatePickerClick = (festivalId: string) => {
    setActiveDatePicker(activeDatePicker === festivalId ? null : festivalId);
    setCurrentMonth(new Date()); // Reset to current month
    setDateSelectionState('start');
    setDateSelection({
      start_date: null,
      end_date: null
    });
  };
  
  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, -1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
  };
  
  // Handle date click in calendar
  const handleDateClick = (day: Date) => {
    if (dateSelectionState === 'start') {
      // If selecting start date, set it and move to end date selection
      setDateSelection({
        start_date: day,
        end_date: null
      });
      setDateSelectionState('end');
    } else {
      // If selecting end date
      const { start_date } = dateSelection;
      
      // If clicked date is before start date, swap them
      if (start_date && isBefore(day, start_date)) {
        setDateSelection({
          start_date: day,
          end_date: start_date
        });
      } else {
        // Otherwise set end date
        setDateSelection({
          ...dateSelection,
          end_date: day
        });
      }
    }
  };
  
  // Save date changes
  const handleDateSave = (festivalId: string) => {
    if (onUpdateDates && dateSelection.start_date && dateSelection.end_date) {
      // Format dates to ISO string and remove time portion
      const start = dateSelection.start_date.toISOString().split('T')[0];
      const end = dateSelection.end_date.toISOString().split('T')[0];
      
      onUpdateDates(festivalId, start, end);
    }
    setActiveDatePicker(null);
  };
  
  // Build calendar for given month
  const buildCalendar = (month: Date) => {
    const firstDayOfMonth = startOfMonth(month);
    const lastDayOfMonth = endOfMonth(month);
    const startingDayOfWeek = getDay(firstDayOfMonth); // 0 for Sunday, 1 for Monday, etc.
    const daysInMonth = getDaysInMonth(month);
    
    const calendarDays: (Date | null)[] = [];
    
    // Add empty days for the start of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      calendarDays.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      calendarDays.push(date);
    }
    
    // Add empty days for the end of the month to complete the grid
    while (calendarDays.length % 7 !== 0) {
      calendarDays.push(null);
    }
    
    // Split into weeks
    const calendarWeeks: (Date | null)[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      calendarWeeks.push(calendarDays.slice(i, i + 7));
    }
    
    return calendarWeeks;
  };
  
  // Check if a date is in the selected range
  const isInRange = (date: Date) => {
    const { start_date, end_date } = dateSelection;
    if (!start_date || !date) return false;
    if (!end_date) return isSameDay(date, start_date);
    
    return (
      (isSameDay(date, start_date) || isAfter(date, start_date)) && 
      (isSameDay(date, end_date) || isBefore(date, end_date))
    );
  };

  // Safe sort for dates
  const sortByDate = (a: Festival, b: Festival, field: 'start_date' | 'end_date'): number => {
    const dateA = safeParseDate(a[field]);
    const dateB = safeParseDate(b[field]);
    
    // Handle cases where dates might be invalid
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1; // Invalid dates go to the end
    if (!dateB) return -1;
    
    return dateA.getTime() - dateB.getTime();
  };

  // Sort festivals
  const sortedFestivals = [...festivals].sort((a, b) => {
    let comparison = 0;

    if (sortField === 'start_date' || sortField === 'end_date') {
      comparison = sortByDate(a, b, sortField);
    } else if (sortField === 'name' || sortField === 'location' || sortField === 'country' || sortField === 'source') {
      // Safely handle missing string fields
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      comparison = aValue.localeCompare(bValue);
    }

    // Reverse for descending
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  // Render calendar component
  const renderCalendar = (month: Date) => {
    const weeks = buildCalendar(month);
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    
    return (
      <div className="calendar">
        <div className="text-center font-medium mb-2">
          {format(month, 'MMMM yyyy')}
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdays.map((day, index) => (
            <div key={index} className="text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1 mb-1">
            {week.map((day, dayIndex) => {
              if (!day) {
                // Empty cell
                return (
                  <div key={dayIndex} className="p-2"></div>
                );
              }
              
              const isToday = isSameDay(day, new Date());
              const isSelected = dateSelection.start_date && isSameDay(day, dateSelection.start_date) || 
                                dateSelection.end_date && isSameDay(day, dateSelection.end_date);
              const isRangeDay = isInRange(day);
              
              return (
                <div 
                  key={dayIndex} 
                  className={`p-2 text-center rounded cursor-pointer 
                    ${isToday ? 'border border-blue-500' : ''}
                    ${isSelected ? 'bg-blue-600 text-white' : isRangeDay ? 'bg-blue-100' : 'hover:bg-gray-100'}
                  `}
                  onClick={() => handleDateClick(day)}
                >
                  {format(day, 'd')}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Create a stable save function that doesn't depend on state
  const saveNote = useCallback((festivalId: string, value: string) => {
    if (onNoteSave) {
      onNoteSave(festivalId, value);
    }
  }, [onNoteSave]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Handle opening research modal
  const handleOpenResearchModal = (festival: FestivalWithPreferences) => {
    setSelectedFestival(festival);
    setResearchModalOpen(true);
  };

  // Close research modal
  const handleCloseResearchModal = () => {
    setResearchModalOpen(false);
    setSelectedFestival(null);
  };

  // Initialize research for a festival
  const handleResearch = async (festivalId: string) => {
    try {
      console.log(`FestivalTable: Initiating research for festival ID: ${festivalId}`);
      
      // Find the festival in our list
      const festival = festivals.find(f => f.id === festivalId);
      if (!festival) {
        console.error(`Festival with ID ${festivalId} not found`);
        return;
      }
      
      // Call the onResearch function provided by parent
      if (onResearch) {
        await onResearch(festivalId);
        console.log(`FestivalTable: Research initiated for ${festival.name}`);
        
        // Force update the festival in our local state immediately to show pending status
        const updatedFestivals = [...festivals];
        const festivalIndex = updatedFestivals.findIndex(f => f.id === festivalId);
        
        if (festivalIndex !== -1) {
          // Update with pending status if not already set
          if (!updatedFestivals[festivalIndex].research || 
              updatedFestivals[festivalIndex].research?.status !== 'pending') {
            updatedFestivals[festivalIndex] = {
              ...updatedFestivals[festivalIndex],
              research: {
                id: updatedFestivals[festivalIndex].research?.id || 'pending',
                status: 'pending'
              }
            };
          }
        }
      }
    } catch (error) {
      console.error('Error handling research in FestivalTable:', error);
    }
  };

  // Function to truncate text with ellipsis
  const truncateText = (text: string, maxLength: number = 36) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Function specifically for festival names with higher character limit
  const truncateName = (text: string, maxLength: number = 50) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Open festival search in new tab/browser
  const openFestivalSearch = async (festivalName: string) => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(festivalName)}`;
    
    try {
      // Open in new tab - this will respect user's default browser settings
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
      console.log(`Opening Google search: ${searchUrl}`);
    } catch (error) {
      console.error('Failed to open search, copying to clipboard instead');
      // Fallback to clipboard if window.open fails
      await copyFestivalSearch(festivalName);
    }
  };

  // Copy festival name with Google search URL to clipboard
  const copyFestivalSearch = async (festivalName: string) => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(festivalName)}`;
    try {
      await navigator.clipboard.writeText(searchUrl);
      console.log(`Copied to clipboard: ${searchUrl}`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = searchUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  // Email editing handlers
  const handleEmailEditClick = (festivalId: string) => {
    setEditingEmail(festivalId);
    setNewEmail('');
  };

  const handleEmailCancel = () => {
    setEditingEmail(null);
    setNewEmail('');
  };

  const handleEmailSubmit = async (festivalId: string, e?: React.KeyboardEvent) => {
    if (e && e.key !== 'Enter') return;
    
    const email = newEmail.trim();
    if (!email) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      if (onEmailUpdate) {
        await onEmailUpdate(festivalId, email);
      }
      setEditingEmail(null);
      setNewEmail('');
    } catch (error) {
      console.error('Error updating email:', error);
      alert('Failed to save email. Please try again.');
    }
  };

  // Research state handlers
  const handleResearchStart = useCallback((festivalId: string, abortController: AbortController) => {
    setActiveResearch(prev => new Set(prev).add(festivalId));
    setCompletedResearch(prev => {
      const next = new Set(prev);
      next.delete(festivalId);
      return next;
    });
    researchControllersRef.current.set(festivalId, abortController);
  }, []);

  const handleResearchComplete = useCallback((festivalId: string, data: any) => {
    setActiveResearch(prev => {
      const next = new Set(prev);
      next.delete(festivalId);
      return next;
    });
    setCompletedResearch(prev => new Set(prev).add(festivalId));
    researchControllersRef.current.delete(festivalId);
    console.log(`Research complete for festival ${festivalId}:`, data);
  }, []);

  // Check if a festival has research data
  const hasResearchData = useCallback((festival: FestivalWithPreferences) => {
    return festival.research_data && Object.keys(festival.research_data).length > 0;
  }, []);

  // LinkedIn editing handlers
  const handleLinkedInEditClick = (festivalId: string, currentUrl?: string) => {
    setEditingLinkedIn(festivalId);
    setNewLinkedInUrl(currentUrl || '');
  };

  const handleLinkedInCancel = () => {
    setEditingLinkedIn(null);
    setNewLinkedInUrl('');
  };

  const handleLinkedInSubmit = async (festivalId: string, e?: React.KeyboardEvent) => {
    if (e && e.key !== 'Enter') return;
    
    const url = newLinkedInUrl.trim();
    
    // Allow empty URL to clear the field
    if (url && !url.includes('linkedin.com')) {
      alert('Please enter a valid LinkedIn URL');
      return;
    }

    try {
      if (onLinkedInUpdate) {
        await onLinkedInUpdate(festivalId, url);
      }
      setEditingLinkedIn(null);
      setNewLinkedInUrl('');
    } catch (error) {
      console.error('Error updating LinkedIn URL:', error);
      alert('Failed to save LinkedIn URL. Please try again.');
    }
  };

  return (
    <div className="w-full">
      {/* Inject pulse animation CSS */}
      <style dangerouslySetInnerHTML={{ __html: pulseKeyframes }} />
      <div className="relative w-full overflow-auto">
        <table className="w-full min-w-[1400px] caption-bottom text-sm table-fixed">
          <thead className="[&_tr]:border-b bg-muted/50">
            <tr className="border-b transition-colors">
              <th scope="col" className="h-10 px-3 text-left align-middle font-medium text-muted-foreground w-24">
                Actions
              </th>
              <th scope="col" className="h-10 px-3 text-left align-middle font-medium text-muted-foreground w-64">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center focus:outline-none hover:text-foreground transition-colors"
                >
                  Festival
                  {sortField === 'name' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th scope="col" className="h-10 px-3 text-left align-middle font-medium text-muted-foreground flex-1">
                Notes
              </th>
              <th scope="col" className="h-10 px-3 text-left align-middle font-medium text-muted-foreground w-64">
                <button
                  onClick={() => handleSort('start_date')}
                  className="flex items-center focus:outline-none hover:text-foreground transition-colors"
                >
                  Date
                  {sortField === 'start_date' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th scope="col" className="h-10 px-3 text-left align-middle font-medium text-muted-foreground w-48">
                <button
                  onClick={() => handleSort('location')}
                  className="flex items-center focus:outline-none hover:text-foreground transition-colors"
                >
                  Location
                  {sortField === 'location' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th scope="col" className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">
                Source
              </th>
              <th scope="col" className="h-10 px-3 text-left align-middle font-medium text-muted-foreground w-48">
                Email Addresses
              </th>
              <th scope="col" className="h-10 px-3 text-left align-middle font-medium text-muted-foreground w-40">
                LinkedIn
              </th>
              <th scope="col" className="h-10 px-3 text-left align-middle font-medium text-muted-foreground hidden">
                Research
              </th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {sortedFestivals.map((festival) => (
              <React.Fragment key={festival.id}>
              <tr 
                data-festival-id={festival.id}
                className={`border-b transition-colors hover:bg-muted/50 ${festival.archived ? 'bg-muted/30' : ''}`}
              >
                <td className="p-3 align-middle text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onFavoriteToggle && onFavoriteToggle(festival.id, !festival.favorite)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                        festival.favorite
                          ? 'text-yellow-500 bg-yellow-100 hover:bg-yellow-200'
                          : 'text-muted-foreground bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <Star size={16} fill={festival.favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => onArchiveToggle && onArchiveToggle(festival.id, !festival.archived)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                        festival.archived
                          ? 'text-red-500 bg-red-100 hover:bg-red-200'
                          : 'text-muted-foreground bg-muted hover:bg-muted/80'
                      }`}
                      title={festival.archived ? 'Unarchive' : 'Archive'}
                    >
                      <Archive size={16} />
                    </button>
                    <button
                      onClick={() => setExpandedResearchPanel(expandedResearchPanel === festival.id ? null : festival.id)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                        activeResearch.has(festival.id)
                          ? 'text-white bg-purple-500'
                          : expandedResearchPanel === festival.id
                            ? 'text-purple-600 bg-purple-200'
                            : hasResearchData(festival) || completedResearch.has(festival.id)
                              ? 'text-purple-600 bg-purple-200 ring-2 ring-purple-400'
                              : 'text-muted-foreground bg-muted hover:bg-purple-50'
                      }`}
                      style={activeResearch.has(festival.id) ? {
                        animation: 'research-pulse 1.5s ease-in-out infinite'
                      } : undefined}
                      title={
                        activeResearch.has(festival.id) 
                          ? "Research in progress..." 
                          : hasResearchData(festival) 
                            ? "View Research (has data)" 
                            : "Research with Apify"
                      }
                    >
                      {activeResearch.has(festival.id) ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Search size={16} />
                      )}
                    </button>
                  </div>
                </td>
                <td className="p-3 align-middle">
                  <div className="flex items-center">
                    <button
                      onClick={() => copyFestivalSearch(festival.name)}
                      className="mr-1 p-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title={`Copy Google search link for ${festival.name}`}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => openFestivalSearch(festival.name)}
                      className="mr-2 p-1 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                      title={`Open Google search for ${festival.name} in new tab`}
                    >
                      <Globe size={14} />
                    </button>
                    <div className="text-sm font-medium text-foreground">{truncateName(festival.name)}</div>
                  </div>
                </td>
                <td className="p-3 align-middle">
                  <div className="relative h-[60px]">
                    <textarea
                      ref={(el) => { textareaRefs.current[festival.id] = el }}
                      className="resize-none w-full h-full text-sm border border-input rounded-md p-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      defaultValue={festival.notes || ''}
                      placeholder="Add notes..."
                    />
                  </div>
                </td>
                <td className="p-3 align-middle">
                  <div className="flex items-center">
                    <Calendar size={16} className="mr-1 text-muted-foreground" />
                    <button 
                      onClick={() => handleDatePickerClick(festival.id)}
                      className="text-sm text-foreground hover:text-blue-600 hover:underline flex items-center transition-colors"
                      title="Click to edit dates"
                    >
                      {formatDateRange(festival.start_date, festival.end_date) || 'Set dates...'}
                    </button>
                    
                    {/* Date picker dialog */}
                    {activeDatePicker === festival.id && (
                      <div className="absolute z-50 mt-1 ml-20 bg-popover shadow-lg rounded-lg border border-border p-3">
                        <div className="flex justify-between items-center mb-2">
                          <button 
                            onClick={goToPreviousMonth}
                            className="p-1 hover:bg-muted rounded transition-colors"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <div className="text-sm font-medium text-foreground">
                            {format(currentMonth, 'MMMM yyyy')}
                          </div>
                          <button 
                            onClick={goToNextMonth}
                            className="p-1 hover:bg-muted rounded transition-colors"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                        
                        <div className="mb-2">
                          {renderCalendar(currentMonth)}
                        </div>
                        
                        <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                          <div>
                            {dateSelection.start_date && (
                              <span>Start: {format(dateSelection.start_date, 'yyyy-MM-dd')}</span>
                            )}
                          </div>
                          <div>
                            {dateSelection.end_date && (
                              <span>End: {format(dateSelection.end_date, 'yyyy-MM-dd')}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex justify-end mt-3 gap-2">
                          <button
                            onClick={() => handleDatePickerClick(festival.id)} // Close without saving
                            className="px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDateSave(festival.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                            disabled={!dateSelection.start_date || !dateSelection.end_date}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-3 align-middle">
                  <div className="flex items-center text-sm text-foreground">
                    <MapPin size={16} className="mr-1 text-muted-foreground" />
                    {truncateText(festival.location) || 'Unknown'}
                  </div>
                </td>
                <td className="p-3 align-middle">
                  <div className="text-sm text-foreground">
                    {festival.source_url ? (
                      <a 
                        href={festival.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                      >
                        {festival.source} <ExternalLink size={14} className="ml-1" />
                      </a>
                    ) : (
                      festival.source
                    )}
                  </div>
                </td>
                <td className="p-3 align-middle">
                  <div className="text-sm text-foreground">
                    {festival.emails && festival.emails.length > 0 ? (
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {festival.emails.slice(0, 3).map((email, index) => (
                              <div key={index} className="flex items-center">
                                <a 
                                  href={`mailto:${email}`}
                                  className="text-blue-600 hover:text-blue-700 hover:underline text-xs break-all transition-colors"
                                  title={`Send email to ${email}`}
                                >
                                  {email.length > 20 ? `${email.substring(0, 17)}...` : email}
                                </a>
                              </div>
                            ))}
                            {festival.emails.length > 3 && (
                              <div className="text-xs text-muted-foreground italic">
                                +{festival.emails.length - 3} more
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleEmailEditClick(festival.id)}
                            className="ml-2 p-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Add another email address"
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                        {editingEmail === festival.id && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              onKeyDown={(e) => handleEmailSubmit(festival.id, e)}
                              placeholder="Enter email address"
                              className="flex-1 px-2 py-1.5 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                              autoFocus
                            />
                            <button
                              onClick={() => handleEmailSubmit(festival.id)}
                              className="px-2.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                            >
                              Add
                            </button>
                            <button
                              onClick={handleEmailCancel}
                              className="px-2.5 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ) : editingEmail === festival.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          onKeyDown={(e) => handleEmailSubmit(festival.id, e)}
                          placeholder="Enter email address"
                          className="flex-1 px-2 py-1.5 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEmailSubmit(festival.id)}
                          className="px-2.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={handleEmailCancel}
                          className="px-2.5 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="text-muted-foreground italic text-xs">No emails</span>
                        <button
                          onClick={() => handleEmailEditClick(festival.id)}
                          className="ml-2 p-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Add email address"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-3 align-middle">
                  <div className="text-sm text-foreground">
                    {festival.linkedin_url ? (
                      <div className="flex items-center justify-between">
                        <a 
                          href={festival.linkedin_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center text-blue-600 hover:text-blue-700 hover:underline text-xs transition-colors"
                          title={festival.linkedin_url}
                        >
                          <Linkedin size={14} className="mr-1 text-[#0A66C2]" />
                          {festival.linkedin_url.length > 25 ? 'LinkedIn Profile' : festival.linkedin_url.replace('https://www.linkedin.com/', '').replace('https://linkedin.com/', '')}
                        </a>
                        <button
                          onClick={() => handleLinkedInEditClick(festival.id, festival.linkedin_url)}
                          className="ml-2 p-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit LinkedIn URL"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    ) : editingLinkedIn === festival.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="url"
                          value={newLinkedInUrl}
                          onChange={(e) => setNewLinkedInUrl(e.target.value)}
                          onKeyDown={(e) => handleLinkedInSubmit(festival.id, e)}
                          placeholder="linkedin.com/..."
                          className="flex-1 px-2 py-1.5 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring w-24"
                          autoFocus
                        />
                        <button
                          onClick={() => handleLinkedInSubmit(festival.id)}
                          className="px-2.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleLinkedInCancel}
                          className="px-2 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="text-muted-foreground italic text-xs">No LinkedIn</span>
                        <button
                          onClick={() => handleLinkedInEditClick(festival.id)}
                          className="ml-2 p-1 text-muted-foreground hover:text-[#0A66C2] hover:bg-blue-50 rounded transition-colors"
                          title="Add LinkedIn URL"
                        >
                          <Linkedin size={12} />
                        </button>
                      </div>
                    )}
                    {editingLinkedIn === festival.id && festival.linkedin_url && (
                      <div className="mt-2 flex items-center gap-1">
                        <input
                          type="url"
                          value={newLinkedInUrl}
                          onChange={(e) => setNewLinkedInUrl(e.target.value)}
                          onKeyDown={(e) => handleLinkedInSubmit(festival.id, e)}
                          placeholder="linkedin.com/..."
                          className="flex-1 px-2 py-1.5 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring w-24"
                          autoFocus
                        />
                        <button
                          onClick={() => handleLinkedInSubmit(festival.id)}
                          className="px-2.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleLinkedInCancel}
                          className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 hidden">
                  <ResearchButton
                    festivalId={festival.id}
                    status={festival.research?.status}
                    onResearch={handleResearch}
                    onShowResearch={() => handleOpenResearchModal(festival)}
                    disabled={false}
                  />
                </td>
              </tr>
              {/* Expandable Research Panel Row - Keep mounted while research is active */}
              {(expandedResearchPanel === festival.id || activeResearch.has(festival.id)) && (
                <tr className={`${expandedResearchPanel === festival.id ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-purple-50/30 dark:bg-purple-900/10'}`}>
                  <td colSpan={9} className={expandedResearchPanel === festival.id ? 'px-3 py-3' : 'px-3 py-1'}>
                    {/* Always keep ApifyResearchPanel mounted when research is active to continue background processing */}
                    <div className={expandedResearchPanel === festival.id ? '' : 'hidden'}>
                      <ApifyResearchPanel
                        festivalId={festival.id}
                        festivalName={festival.name}
                        festivalUrl={festival.url || festival.source_url || festival.homepage_url}
                        existingResearchData={festival.research_data}
                        onLinkedInFound={async (url) => {
                          if (onLinkedInUpdate) {
                            await onLinkedInUpdate(festival.id, url);
                          }
                        }}
                        onResearchComplete={(data) => {
                          console.log(`Research complete for ${festival.name}:`, data);
                        }}
                        onCompanyDiscovered={(companyName) => {
                          console.log(`Company discovered for ${festival.name}: ${companyName}`);
                        }}
                        onResearchStart={handleResearchStart}
                        onResearchEnd={handleResearchComplete}
                      />
                    </div>
                    {/* Show minimal indicator when collapsed but research is active */}
                    {expandedResearchPanel !== festival.id && activeResearch.has(festival.id) && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-xs text-purple-600">
                          <Loader2 size={12} className="animate-spin" />
                          <span>Research running in background...</span>
                        </div>
                        <button
                          onClick={() => setExpandedResearchPanel(festival.id)}
                          className="text-xs text-purple-500 hover:text-purple-700 underline"
                        >
                          Show details
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
            
            {sortedFestivals.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                  No festivals found with the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Research Modal */}
      {selectedFestival && (
        <ResearchModal
          festivalId={selectedFestival.id}
          festivalName={selectedFestival.name}
          isOpen={researchModalOpen}
          onClose={handleCloseResearchModal}
        />
      )}
    </div>
  );
};

export default FestivalTable; 