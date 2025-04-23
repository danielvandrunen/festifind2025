# Month Paginator Component Specification

## Overview

The Month Paginator component provides an intuitive interface for navigating between months when viewing festival data. It displays the current month and year, with buttons to move forward and backward through months.

## Component Purpose

This component allows users to:
1. See which month's festivals they are currently viewing
2. Navigate to the previous month
3. Navigate to the next month
4. Jump to a specific month (optional enhancement)

## Visual Design

The Month Paginator follows a clean, modern Stripe-like design with:
- Prominent display of the current month and year
- Clear left/right navigation buttons
- Consistent spacing and alignment
- Visual feedback for interactions (hover states, etc.)
- Optional dropdown for quick month selection

## Component Structure

```tsx
<MonthPaginator
  currentMonth={currentMonth}
  onMonthChange={handleMonthChange}
/>
```

## Props Interface

```typescript
interface MonthPaginatorProps {
  // Current month to display
  currentMonth: Date;
  
  // Callback for when the month changes
  onMonthChange: (newMonth: Date) => void;
  
  // Optional: Disable months before this date
  minDate?: Date;
  
  // Optional: Disable months after this date
  maxDate?: Date;
}
```

## Implementation Details

### Navigation Controls

The paginator has:
- Left arrow button for previous month
- Right arrow button for next month
- Current month/year display in the center

### Month Selection Logic

When navigating:
- Previous month: decrement month by 1 (handling year change when current month is January)
- Next month: increment month by 1 (handling year change when current month is December)
- The date is always set to the 1st of the month for consistency

### Date Boundaries

If `minDate` or `maxDate` are provided:
- Disable previous button when at or before `minDate`
- Disable next button when at or after `maxDate`

## Code Implementation

```tsx
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      
      <h2 className="text-xl font-semibold">
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
```

## Usage Example

```tsx
import { useState } from "react";
import MonthPaginator from "@/components/festival/MonthPaginator";
import FestivalTable from "@/components/festival/FestivalTable";
import { startOfMonth } from "date-fns";

export default function FestivalsPage() {
  // Initialize with the current month
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  
  // Handler for month changes
  const handleMonthChange = (newMonth: Date) => {
    setCurrentMonth(newMonth);
    // Additional logic, e.g., fetching festivals for the new month
  };
  
  return (
    <div className="space-y-4">
      <h1>Festivals</h1>
      
      <MonthPaginator
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
        // Optional: Set boundaries for navigation
        minDate={new Date(2025, 0, 1)} // January 2025
        maxDate={new Date(2025, 11, 31)} // December 2025
      />
      
      <FestivalTable
        festivals={[]}
        // Other props for the festival table
      />
    </div>
  );
}
```

## Enhanced Version (with Month Dropdown)

An enhanced version can include a dropdown for quick navigation to any month:

```tsx
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, addMonths, isAfter, isBefore, startOfMonth, setMonth, setYear } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Same props interface as before
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
  
  // Generate months for dropdown
  const generateMonths = () => {
    const months = [];
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
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center space-x-1">
            <Calendar className="h-4 w-4 mr-1" />
            <span className="text-xl font-semibold">
              {format(current, "MMMM yyyy")}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          {generateMonths().map((month) => (
            <DropdownMenuItem
              key={month.getTime()}
              onClick={() => onMonthChange(month)}
              className={month.getMonth() === current.getMonth() ? "font-bold" : ""}
            >
              {format(month, "MMMM yyyy")}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      
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
```

## Accessibility Considerations

- Buttons have appropriate ARIA labels
- Keyboard navigation support
- Disabled states are properly indicated
- Focus states for interactive elements
- Screen reader announcements for month changes

## Responsiveness

For smaller screens:
- Button text can be hidden, showing only arrows
- Month name remains visible but in a more compact format
- Dropdown remains accessible

## Testing Strategy

Unit tests should cover:
1. Rendering with different months
2. Navigation to previous/next month
3. Boundary conditions (minDate, maxDate)
4. Month dropdown functionality (if implemented)
5. Handling year changes (December to January, January to December)

## Related Components

- FestivalTable - Displays festivals for the selected month
- SourceFilter - Often used alongside the MonthPaginator

## Future Enhancements

1. Add year selection dropdown
2. Add visual calendar picker
3. Highlight months with festivals
4. Add quick navigation to notable festival months
5. Add animations for month transitions