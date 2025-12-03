'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, addMonths, isAfter, isBefore, startOfMonth, setMonth, setYear } from 'date-fns';

interface MonthPaginatorProps {
  currentMonth: Date;
  onMonthChange: (newMonth: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

const MonthPaginator: React.FC<MonthPaginatorProps> = ({
  currentMonth,
  onMonthChange,
  minDate,
  maxDate
}) => {
  // Ensure we're working with the first day of the month
  const current = startOfMonth(currentMonth);
  
  // Calculate previous and next months
  const previousMonth = addMonths(current, -1);
  const nextMonth = addMonths(current, 1);
  
  // Check if buttons should be disabled
  const isPreviousDisabled = minDate ? isBefore(previousMonth, startOfMonth(minDate)) : false;
  const isNextDisabled = maxDate ? isAfter(nextMonth, startOfMonth(maxDate)) : false;
  
  // Generate months for dropdown
  const generateMonths = () => {
    const months: Date[] = [];
    const currentYear = current.getFullYear();
    
    // Generate months for the current year
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(currentYear, i, 1);
      
      // Skip if outside boundaries
      if (minDate && isBefore(monthDate, startOfMonth(minDate))) continue;
      if (maxDate && isAfter(monthDate, startOfMonth(maxDate))) continue;
      
      months.push(monthDate);
    }
    
    return months;
  };
  
  // Handle previous month click
  const handlePrevious = () => {
    if (!isPreviousDisabled) {
      onMonthChange(previousMonth);
    }
  };
  
  // Handle next month click
  const handleNext = () => {
    if (!isNextDisabled) {
      onMonthChange(nextMonth);
    }
  };
  
  // Handle month selection from dropdown
  const handleMonthSelect = (monthIndex: number) => {
    const newDate = setMonth(current, monthIndex);
    onMonthChange(newDate);
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <button
        className={`px-4 py-2 rounded-md border text-sm flex items-center ${
          isPreviousDisabled 
            ? 'opacity-50 cursor-not-allowed border-gray-300 text-gray-400' 
            : 'border-gray-300 hover:bg-gray-100 text-gray-600 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
        onClick={handlePrevious}
        disabled={isPreviousDisabled}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        <span className="hidden md:inline">Previous</span>
      </button>
      
      <div className="relative">
        <div className="dropdown inline-block relative">
          <button 
            className="text-xl font-semibold flex items-center space-x-1 px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => document.getElementById('month-dropdown')?.classList.toggle('hidden')}
            aria-haspopup="true"
            aria-expanded="false"
          >
            <Calendar className="h-5 w-5 mr-2 text-blue-500" />
            <span>{format(current, "MMMM yyyy")}</span>
          </button>
          <div 
            id="month-dropdown"
            className="dropdown-menu hidden absolute mt-1 z-10 bg-white rounded-md shadow-lg py-1 w-52 dark:bg-gray-800 border dark:border-gray-700"
          >
            {generateMonths().map((month) => (
              <button
                key={month.getTime()}
                className={`block w-full text-left px-4 py-2 text-sm ${
                  month.getMonth() === current.getMonth() 
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900 dark:text-blue-300' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => {
                  handleMonthSelect(month.getMonth());
                  document.getElementById('month-dropdown')?.classList.add('hidden');
                }}
              >
                {format(month, "MMMM yyyy")}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <button
        className={`px-4 py-2 rounded-md border text-sm flex items-center ${
          isNextDisabled 
            ? 'opacity-50 cursor-not-allowed border-gray-300 text-gray-400' 
            : 'border-gray-300 hover:bg-gray-100 text-gray-600 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
        onClick={handleNext}
        disabled={isNextDisabled}
        aria-label="Next month"
      >
        <span className="hidden md:inline">Next</span>
        <ChevronRight className="h-4 w-4 ml-1" />
      </button>
    </div>
  );
};

export default MonthPaginator; 