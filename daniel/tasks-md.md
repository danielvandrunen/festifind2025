# FestiFind Project Tasks

This document outlines the step-by-step tasks to implement the FestiFind application. Each task is designed to be a specific, actionable step that can be completed independently.

## Phase 1: Project Setup and Basic Structure

### Task 1.1: Initialize v0 Project
- Create a new v0 project
- Set up TypeScript
- Configure shadcn-ui
- Initialize Git repository and link to GitHub

```bash
# Example implementation commands
npm create v0@latest festifind
cd festifind
npm install
npx v0 add shadcn-ui
git init
git remote add origin https://github.com/danielvandrunen/festifind.git
```

### Task 1.2: Configure Supabase
- Create Supabase project
- Set up environment variables
- Initialize Supabase client in the app
- Test connection

```typescript
// Example lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Task 1.3: Create Database Schema
- Create SQL scripts for tables
- Run migration in Supabase SQL editor
- Verify table creation
- Insert mock festival data

### Task 1.4: Set up Basic UI Layout
- Create app layout with navigation
- Add tab structure for All/Archived/Favorites
- Implement basic responsive design
- Test layout on different screen sizes

## Phase 2: Frontend Components Development

### Task 2.1: Implement Festival Table Component
- Create table with columns (name, date, location, source)
- Add sorting functionality
- Implement basic filtering
- Style according to Stripe-like design

```tsx
// Example components/FestivalTable.tsx
import { Table, TableHeader, TableBody, TableRow, TableCell } from "./ui/table";

export const FestivalTable = ({ festivals }: { festivals: Festival[] }) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Date</TableCell>
          <TableCell>Location</TableCell>
          <TableCell>Source</TableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {festivals.map((festival) => (
          <TableRow key={festival.id}>
            <TableCell>{festival.name}</TableCell>
            <TableCell>{formatDate(festival.start_date, festival.end_date)}</TableCell>
            <TableCell>{festival.location}</TableCell>
            <TableCell>{festival.source_website}</TableCell>
            <TableCell>{/* Action buttons */}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
```

### Task 2.2: Create Month Pagination Component
- Design month navigation UI
- Implement prev/next month functionality
- Connect to festival filtering logic
- Test month transitions

```tsx
// Example components/MonthPaginator.tsx
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const MonthPaginator = ({
  currentMonth,
  onMonthChange
}: {
  currentMonth: Date;
  onMonthChange: (newMonth: Date) => void;
}) => {
  const goToPrevMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    onMonthChange(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    onMonthChange(newMonth);
  };

  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" onClick={goToPrevMonth}>
        <ChevronLeft className="h-4 w-4" />
        Previous Month
      </Button>
      
      <h2 className="text-xl font-semibold">
        {currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}
      </h2>
      
      <Button variant="outline" onClick={goToNextMonth}>
        Next Month
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
```

### Task 2.3: Implement Favorite and Archive Functions
- Create favorite/archive toggle buttons
- Implement visual indicators for status
- Connect to state management
- Set up persistence logic

```tsx
// Example components/FestivalActions.tsx
import { useState } from "react";
import { Heart, Archive, MoreHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/lib/supabase";

export const FestivalActions = ({
  festivalId,
  initialFavorite = false,
  initialArchived = false,
  onStatusChange
}: {
  festivalId: string;
  initialFavorite?: boolean;
  initialArchived?: boolean;
  onStatusChange?: () => void;
}) => {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isArchived, setIsArchived] = useState(initialArchived);
  
  const toggleFavorite = async () => {
    try {
      const newStatus = !isFavorite;
      await supabase
        .from('user_preferences')
        .upsert({
          festival_id: festivalId,
          is_favorite: newStatus,
          is_archived: isArchived
        }, { onConflict: ['user_id', 'festival_id'] });
      
      setIsFavorite(newStatus);
      if (onStatusChange) onStatusChange();
    } catch (error) {
      console.error('Error updating favorite status:', error);
    }
  };
  
  const toggleArchive = async () => {
    try {
      const newStatus = !isArchived;
      await supabase
        .from('user_preferences')
        .upsert({
          festival_id: festivalId,
          is_favorite: isFavorite,
          is_archived: newStatus
        }, { onConflict: ['user_id', 'festival_id'] });
      
      setIsArchived(newStatus);
      if (onStatusChange) onStatusChange();
    } catch (error) {
      console.error('Error updating archive status:', error);
    }
  };
  
  return (
    <div className="flex space-x-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleFavorite}
        className={isFavorite ? "text-red-500" : ""}
      >
        <Heart className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleArchive}
        className={isArchived ? "text-gray-500" : ""}
      >
        <Archive className="h-4 w-4" />
      </Button>
    </div>
  );
};
```

### Task 2.4: Create Notes Component
- Design notes input interface
- Implement save/update functionality
- Connect to database
- Add auto-saving feature

```tsx
// Example components/FestivalNotes.tsx
import { useState, useEffect } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { supabase } from "@/lib/supabase";

export const FestivalNotes = ({
  festivalId,
  initialContent = ""
}: {
  festivalId: string;
  initialContent?: string;
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Debounced save function
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content !== initialContent) {
        saveNote();
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [content]);
  
  const saveNote = async () => {
    setIsSaving(true);
    try {
      await supabase
        .from('notes')
        .upsert({
          festival_id: festivalId,
          content
        }, { onConflict: ['user_id', 'festival_id'] });
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Add notes about this festival..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[100px]"
      />
      
      <div className="flex justify-between items-center text-xs text-gray-500">
        {lastSaved && (
          <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
        )}
        {isSaving && <span>Saving...</span>}
      </div>
    </div>
  );
};
```

### Task 2.5: Implement Source Filter Component
- Create source filter dropdown
- Connect to festival filtering logic
- Add visual indicators for active filters
- Test filter combinations

```tsx
// Example components/SourceFilter.tsx
import { useState } from "react";
import { Check, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";

const SOURCES = [
  "partyflock",
  "festivalinfo",
  "festileaks",
  "eblive",
  "befesti",
  "mock"
];

export const SourceFilter = ({
  selectedSources,
  onSourcesChange
}: {
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
}) => {
  const toggleSource = (source: string) => {
    if (selectedSources.includes(source)) {
      onSourcesChange(selectedSources.filter(s => s !== source));
    } else {
      onSourcesChange([...selectedSources, source]);
    }
  };
  
  const selectAll = () => {
    onSourcesChange([...SOURCES]);
  };
  
  const clearAll = () => {
    onSourcesChange([]);
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Filter className="h-4 w-4" />
          Sources
          {selectedSources.length > 0 && selectedSources.length < SOURCES.length && (
            <span className="ml-1 rounded-full bg-primary w-5 h-5 text-xs flex items-center justify-center text-primary-foreground">
              {selectedSources.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex justify-between px-2 py-1.5 text-xs">
          <button
            onClick={selectAll}
            className="text-primary hover:underline"
          >
            Select All
          </button>
          <button
            onClick={clearAll}
            className="text-primary hover:underline"
          >
            Clear All
          </button>
        </div>
        {SOURCES.map(source => (
          <DropdownMenuCheckboxItem
            key={source}
            checked={selectedSources.includes(source)}
            onCheckedChange={() => toggleSource(source)}
          >
            {source.charAt(0).toUpperCase() + source.slice(1)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

## Phase 3: State Management and Data Flow

### Task 3.1: Set Up API Functions
- Create Supabase query functions
- Implement data fetching hooks
- Add error handling
- Set up caching strategy

```typescript
// Example lib/api.ts
import { supabase } from "./supabase";

export async function getFestivals({
  month,
  selectedSources = [],
  showArchived = false,
  showFavorites = false
}) {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  
  // Format dates for Supabase query
  const startDate = startOfMonth.toISOString().split('T')[0];
  const endDate = endOfMonth.toISOString().split('T')[0];
  
  let query = supabase
    .from('festivals')
    .select(`
      *,
      user_preferences!inner(is_favorite, is_archived)
    `)
    .gte('start_date', startDate)
    .lte('start_date', endDate);
  
  // Apply source filter if any sources selected
  if (selectedSources.length > 0) {
    query = query.in('source_website', selectedSources);
  }
  
  // Apply favorites filter
  if (showFavorites) {
    query = query.eq('user_preferences.is_favorite', true);
  }
  
  // Apply archive filter
  if (showArchived) {
    query = query.eq('user_preferences.is_archived', true);
  } else {
    query = query.eq('user_preferences.is_archived', false);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching festivals:', error);
    return [];
  }
  
  return data || [];
}

export async function getUserPreferences(festivalId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('festival_id', festivalId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is "row not found"
    console.error('Error fetching user preferences:', error);
    return null;
  }
  
  return data || { is_favorite: false, is_archived: false };
}

export async function getFestivalNotes(festivalId) {
  const { data, error } = await supabase
    .from('notes')
    .select('content')
    .eq('festival_id', festivalId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching notes:', error);
    return null;
  }
  
  return data?.content || '';
}
```

### Task 3.2: Implement Tab Navigation State
- Create state for tab selection
- Implement context/store for sharing state
- Connect UI components to tab state
- Add URL-based navigation

```tsx
// Example lib/TabContext.tsx
import { createContext, useContext, useState, ReactNode } from "react";

type TabType = "all" | "archived" | "favorites";

interface TabContextType {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  
  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTab() {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error("useTab must be used within a TabProvider");
  }
  return context;
}
```

### Task 3.3: Set Up Authentication
- Implement Supabase Auth
- Create login/register UI
- Add protected routes
- Implement user profile management

## Phase 4: Dev Tools Implementation

### Task 4.1: Create Scraper Status UI
- Design status dashboard
- Implement status indicators for each scraper
- Add last run information display
- Create log viewer component

### Task 4.2: Implement Raw Data Viewer
- Create data explorer interface
- Add table view for scraped data
- Implement source filtering
- Add detail page preview functionality

### Task 4.3: Design Upload Controls
- Create upload confirmation UI
- Implement validation visualization
- Add progress indicators
- Design success/failure feedback UI

## Phase 5: Scraper Development

### Task 5.1: Set Up Base Scraper Functionality
- Create common scraper utilities
- Implement rate limiting
- Add logging functions
- Create HTML download utilities

### Task 5.2: Implement Befesti Scraper
- Create scraper module
- Add parser for festival information
- Implement detail page fetching
- Add data validation

### Task 5.3: Implement Partyflock Scraper
- Create scraper module
- Add infinite scroll handling
- Implement parser for festival information
- Add data validation

### Task 5.4: Implement Festivalinfo Scraper
- Create scraper module
- Add week-by-week pagination
- Implement parser for festival information
- Add data validation

### Task 5.5: Implement Festileaks Scraper
- Create scraper module
- Add pagination handling
- Implement parser for festival information
- Add data validation

### Task 5.6: Implement EB Live Scraper
- Create scraper module
- Add pagination handling
- Implement parser for festival information
- Add data validation

## Phase 6: Testing and Optimization

### Task 6.1: Implement Unit Tests
- Set up testing framework
- Create tests for core components
- Add tests for data fetching
- Implement scraper tests

### Task 6.2: Perform Usability Testing
- Test main user flows
- Verify responsive design
- Check accessibility compliance
- Gather feedback

### Task 6.3: Optimize Performance
- Analyze and improve load times
- Implement pagination optimizations
- Add proper caching
- Reduce unnecessary renders

## Phase 7: Deployment

### Task 7.1: Prepare for Production
- Set up production environment
- Configure environment variables
- Optimize build settings
- Create deployment scripts

### Task 7.2: Deploy to Vercel
- Connect GitHub repository
- Configure build settings
- Set up environment variables
- Deploy application

### Task 7.3: Post-Deployment Testing
- Verify functionality in production
- Test with real data
- Check performance metrics
- Set up monitoring

## Change Log

### [Unreleased]
- Initial task list created

### [0.1.0] - 2025-04-23
- Created project documents
- Defined high-level architecture