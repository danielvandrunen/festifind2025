/**
 * Format a date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate days difference
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  const startFormatted = start.toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  });
  
  const endFormatted = end.toLocaleDateString('en-US', { 
    day: 'numeric', 
    month: 'long',
    year: 'numeric'
  });
  
  return `${startFormatted} - ${endFormatted} (${diffDays} days)`;
} 