import React from 'react';

interface MonthPaginatorProps {
  currentDate: Date;
  onMonthChange: (date: Date) => void;
}

export function MonthPaginator({ currentDate, onMonthChange }: MonthPaginatorProps) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const handlePreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentMonth - 1);
    onMonthChange(newDate);
  };
  
  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentMonth + 1);
    onMonthChange(newDate);
  };
  
  return (
    <div className="flex items-center justify-between mb-6">
      <button
        onClick={handlePreviousMonth}
        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center"
      >
        <span className="mr-1">←</span> Previous
      </button>
      
      <div className="font-semibold text-lg">
        {months[currentMonth]} {currentYear}
      </div>
      
      <button
        onClick={handleNextMonth}
        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md flex items-center"
      >
        Next <span className="ml-1">→</span>
      </button>
    </div>
  );
} 