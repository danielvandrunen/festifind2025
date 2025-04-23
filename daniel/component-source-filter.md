# Source Filter Component Specification

## Overview

The Source Filter component allows users to filter the displayed festivals based on their source websites. It provides an intuitive interface for selecting one or multiple sources through a dropdown menu.

## Component Purpose

This component enables users to:
1. See which sources are currently being filtered
2. Select one or multiple sources to filter by
3. Clear all filters with a single action
4. Select all sources with a single action
5. Visually understand how many filters are currently applied

## Visual Design

The Source Filter follows a clean, modern Stripe-like design with:
- Dropdown menu triggered by a button
- Checkboxes for each source website
- Clear visual indicators for selected sources
- Badge showing count of active filters
- Select All/Clear All buttons
- Consistent spacing and alignment

## Component Structure

```tsx
<SourceFilter
  sources={availableSources}
  selectedSources={selectedSources}
  onSourcesChange={handleSourcesChange}
/>
```

## Props Interface

```typescript
interface SourceFilterProps {
  // Available source websites
  sources: string[];
  
  // Currently selected sources
  selectedSources: string[];
  
  // Callback for when selection changes
  onSourcesChange: (sources: string[]) => void;
}
```

## Implementation Details

### Filter Controls

The component consists of:
- A button that displays "Sources" and a filter icon
- A badge indicating how many filters are active
- A dropdown menu with checkboxes for each source
- "Select All" and "Clear All" buttons at the top of the dropdown

### Selection Logic

- Clicking a checkbox toggles that source's selection
- "Select All" selects all available sources
- "Clear All" deselects all sources
- When no sources are selected, all festivals are shown (no filtering)

## Code Implementation

```tsx
import { useState } from "react";
import { Check, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface SourceFilterProps {
  sources: string[];
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
}

export default function SourceFilter({
  sources,
  selectedSources,
  onSourcesChange,
}: SourceFilterProps) {
  // Toggle a single source
  const toggleSource = (source: string) => {
    if (selectedSources.includes(source)) {
      // Remove the source if it's already selected
      onSourcesChange(selectedSources.filter((s) => s !== source));
    } else {
      // Add the source if it's not selected
      onSourcesChange([...selectedSources, source]);
    }
  };

  // Select all sources
  const selectAll = () => {
    onSourcesChange([...sources]);
  };

  // Clear all selections
  const clearAll = () => {
    onSourcesChange([]);
  };

  // Capitalize first letter of source
  const formatSourceName = (source: string) => {
    return source.charAt(0).toUpperCase() + source.slice(1);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2 lg:px-3">
          <Filter className="h-4 w-4 lg:mr-2" />
          <span className="hidden lg:inline">Sources</span>
          {selectedSources.length > 0 && (
            <span className="ml-1 rounded-full bg-primary w-5 h-5 text-xs flex items-center justify-center text-primary-foreground">
              {selectedSources.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex justify-between items-center px-2 py-1.5">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-primary hover:underline"
          >
            Clear All
          </button>
        </div>
        <DropdownMenuSeparator />
        {sources.map((source) => (
          <DropdownMenuCheckboxItem
            key={source}
            checked={selectedSources.includes(source)}
            onCheckedChange={() => toggleSource(source)}
          >
            {formatSourceName(source)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Usage Example

```tsx
import { useState, useEffect } from "react";
import SourceFilter from "@/components/festival/SourceFilter";
import FestivalTable from "@/components/festival/FestivalTable";
import MonthPaginator from "@/components/festival/MonthPaginator";
import { getFestivals } from "@/lib/api";
import { FestivalWithPreferences } from "@/lib/types";

export default function FestivalsPage() {
  // Available sources
  const availableSources = ["partyflock", "festivalinfo", "festileaks", "eblive", "befesti", "mock"];
  
  // State for selected sources
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  
  // State for current month
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // State for festivals
  const [festivals, setFestivals] = useState<FestivalWithPreferences[]>([]);
  
  // State