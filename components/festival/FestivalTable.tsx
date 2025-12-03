'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, MapPin, Star, Archive, ExternalLink, ChevronLeft, ChevronRight, Edit3, Copy, Globe } from 'lucide-react';
import { safeParseDate, formatDateRange } from '../../utils/dateUtils';
import { format, addMonths, startOfMonth, endOfMonth, getDay, isSameMonth, isSameDay, isAfter, isBefore, parse, getDaysInMonth } from 'date-fns';
import { RateCardUpdatePayload } from '../../lib/types/rate-card';
import ResearchButton from './ResearchButton';
import ResearchModal from './ResearchModal';

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
  emails?: string[];
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

  return (
    <div className="w-full">
      <div className="overflow-x-auto shadow-sm rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                Actions
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-64">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center focus:outline-none"
                >
                  Festival
                  {sortField === 'name' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex-1">
                Notes
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-64">
                <button
                  onClick={() => handleSort('start_date')}
                  className="flex items-center focus:outline-none"
                >
                  Date
                  {sortField === 'start_date' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                <button
                  onClick={() => handleSort('location')}
                  className="flex items-center focus:outline-none"
                >
                  Location
                  {sortField === 'location' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Source
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                Email Addresses
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden">
                Research
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {sortedFestivals.map((festival) => (
              <tr 
                key={festival.id} 
                data-festival-id={festival.id}
                className={`${festival.archived ? 'bg-gray-100 dark:bg-gray-800' : ''} hover:bg-gray-50 dark:hover:bg-gray-800`}
              >
                <td className="px-3 py-2 text-right text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onFavoriteToggle && onFavoriteToggle(festival.id, !festival.favorite)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        festival.favorite
                          ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900'
                          : 'text-gray-400 bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <Star size={16} fill={festival.favorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => onArchiveToggle && onArchiveToggle(festival.id, !festival.archived)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        festival.archived
                          ? 'text-red-500 bg-red-100 dark:bg-red-900'
                          : 'text-gray-400 bg-gray-100 dark:bg-gray-700'
                      }`}
                      title={festival.archived ? 'Unarchive' : 'Archive'}
                    >
                      <Archive size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center">
                    <button
                      onClick={() => copyFestivalSearch(festival.name)}
                      className="mr-1 p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title={`Copy Google search link for ${festival.name}`}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => openFestivalSearch(festival.name)}
                      className="mr-2 p-1 text-gray-400 hover:text-green-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title={`Open Google search for ${festival.name} in new tab`}
                    >
                      <Globe size={14} />
                    </button>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{truncateName(festival.name)}</div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="relative h-[60px]">
                    <textarea
                      ref={(el) => { textareaRefs.current[festival.id] = el }}
                      className="resize-none w-full h-full text-sm border rounded p-1 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                      defaultValue={festival.notes || ''}
                      placeholder="Add notes..."
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center">
                    <Calendar size={16} className="mr-1 text-gray-500" />
                    <button 
                      onClick={() => handleDatePickerClick(festival.id)}
                      className="text-sm text-gray-700 dark:text-gray-300 hover:underline flex items-center"
                      title="Click to edit dates"
                    >
                      {formatDateRange(festival.start_date, festival.end_date) || 'Set dates...'}
                    </button>
                    
                    {/* Date picker dialog */}
                    {activeDatePicker === festival.id && (
                      <div className="absolute z-50 mt-1 ml-20 bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                        <div className="flex justify-between items-center mb-2">
                          <button 
                            onClick={goToPreviousMonth}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <div className="text-sm font-medium">
                            {format(currentMonth, 'MMMM yyyy')}
                          </div>
                          <button 
                            onClick={goToNextMonth}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                        
                        <div className="mb-2">
                          {renderCalendar(currentMonth)}
                        </div>
                        
                        <div className="flex justify-between text-xs mt-2">
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
                        
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => handleDatePickerClick(festival.id)} // Close without saving
                            className="mr-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDateSave(festival.id)}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded"
                            disabled={!dateSelection.start_date || !dateSelection.end_date}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                    <MapPin size={16} className="mr-1 text-gray-500" />
                    {truncateText(festival.location) || 'Unknown'}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {festival.source_url ? (
                      <a 
                        href={festival.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center hover:text-blue-500"
                      >
                        {festival.source} <ExternalLink size={14} className="ml-1" />
                      </a>
                    ) : (
                      festival.source
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    {festival.emails && festival.emails.length > 0 ? (
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {festival.emails.slice(0, 3).map((email, index) => (
                              <div key={index} className="flex items-center">
                                <a 
                                  href={`mailto:${email}`}
                                  className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all"
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
                          <button
                            onClick={() => handleEmailEditClick(festival.id)}
                            className="ml-2 p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Add another email address"
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                        {editingEmail === festival.id && (
                          <div className="mt-2 flex items-center space-x-2">
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              onKeyDown={(e) => handleEmailSubmit(festival.id, e)}
                              placeholder="Enter email address"
                              className="flex-1 px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                              autoFocus
                            />
                            <button
                              onClick={() => handleEmailSubmit(festival.id)}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Add
                            </button>
                            <button
                              onClick={handleEmailCancel}
                              className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ) : editingEmail === festival.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          onKeyDown={(e) => handleEmailSubmit(festival.id, e)}
                          placeholder="Enter email address"
                          className="flex-1 px-2 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEmailSubmit(festival.id)}
                          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Add
                        </button>
                        <button
                          onClick={handleEmailCancel}
                          className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <span className="text-gray-400 italic text-xs">No emails</span>
                        <button
                          onClick={() => handleEmailEditClick(festival.id)}
                          className="ml-2 p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Add email address"
                        >
                          <Edit3 size={12} />
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
            ))}
            
            {sortedFestivals.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
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