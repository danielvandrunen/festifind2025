import { format, parseISO, isValid } from 'date-fns';

/**
 * Safely parse an ISO date string and return a valid Date or null
 * Handles various date formats and gracefully fails for invalid dates
 */
export const safeParseDate = (dateString?: string): Date | null => {
  if (!dateString) return null;
  
  try {
    // Handle both formats that might come from different sources
    // Some sources might use yyyy-MM-dd, others might use ISO format
    const normalizedDate = dateString.includes('T') 
      ? dateString 
      : `${dateString}T00:00:00.000Z`;
    
    const date = parseISO(normalizedDate);
    return isValid(date) ? date : null;
  } catch (e) {
    console.error(`Error parsing date: ${dateString}`, e);
    return null;
  }
};

/**
 * Format a date with fallback for invalid dates
 */
export const formatDate = (
  date: Date | string | null | undefined, 
  formatStr: string = 'd MMM yyyy',
  fallback: string = 'Unknown date'
): string => {
  if (!date) return fallback;
  
  try {
    const dateObj = typeof date === 'string' ? safeParseDate(date) : date;
    return dateObj ? format(dateObj, formatStr) : fallback;
  } catch (e) {
    console.error(`Error formatting date: ${date}`, e);
    return fallback;
  }
};

/**
 * Calculate the duration between two dates in days
 */
export const getDurationDays = (
  startDate: string | Date | null,
  endDate: string | Date | null
): string => {
  try {
    // Convert to Date objects if they're strings
    const start = typeof startDate === 'string' ? safeParseDate(startDate) : startDate;
    const end = typeof endDate === 'string' ? safeParseDate(endDate) : endDate;
    
    if (!start || !end) return 'Unknown duration';
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  } catch (e) {
    console.error('Error calculating duration', e);
    return 'Unknown duration';
  }
};

/**
 * Format a date range as "1 Apr - 3 Apr 2023 (3 days)"
 */
export const formatDateRange = (
  startDate: string | Date | null,
  endDate: string | Date | null
): string => {
  try {
    // Convert to Date objects if they're strings
    const start = typeof startDate === 'string' ? safeParseDate(startDate) : startDate;
    const end = typeof endDate === 'string' ? safeParseDate(endDate) : (startDate ? start : null);
    
    if (!start) return 'Date unknown';
    
    if (!end || (start.getTime() === end.getTime())) {
      // Single day event
      return format(start, 'd MMM yyyy');
    }
    
    // Multi-day event in same year
    if (start.getFullYear() === end.getFullYear()) {
      return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')} (${getDurationDays(start, end)})`;
    }
    
    // Multi-day event crossing years
    return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')} (${getDurationDays(start, end)})`;
  } catch (e) {
    console.error('Error formatting date range', e);
    return 'Date format error';
  }
}; 