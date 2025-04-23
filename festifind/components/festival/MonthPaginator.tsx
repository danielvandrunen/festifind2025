import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, addMonths, isAfter, isBefore, startOfMonth } from "date-fns";

interface MonthPaginatorProps {
  currentMonth: Date;
  onMonthChange: (newMonth: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export default function MonthPaginator({
  currentMonth,
  onMonthChange,
  minDate,
  maxDate
}: MonthPaginatorProps) {
  // Ensure we're working with the first day of the month
  const current = startOfMonth(currentMonth);
  
  // Calculate previous and next months
  const previousMonth = addMonths(current, -1);
  const nextMonth = addMonths(current, 1);
  
  // Check if buttons should be disabled
  const isPreviousDisabled = minDate ? isBefore(previousMonth, startOfMonth(minDate)) : false;
  const isNextDisabled = maxDate ? isAfter(nextMonth, startOfMonth(maxDate)) : false;
  
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
  
  return (
    <div className="flex items-center justify-between mb-6">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrevious}
        disabled={isPreviousDisabled}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous Month
      </Button>
      
      <h2 className="text-xl font-semibold flex items-center">
        <Calendar className="h-5 w-5 mr-2 text-blue-500" />
        {format(current, "MMMM yyyy")}
      </h2>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleNext}
        disabled={isNextDisabled}
      >
        Next Month
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
} 