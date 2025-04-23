# FestiFind v0 Project Setup Guide

This document provides step-by-step instructions for setting up the FestiFind project using v0, Supabase, and shadcn-ui.

## Prerequisites

Before starting, ensure you have:
- Node.js 18.0.0 or later
- npm 9.0.0 or later
- Git installed
- A Supabase account (credentials provided in the basicrules.md document)
- GitHub account linked to repository: https://github.com/danielvandrunen/festifind

## Step 1: Initialize v0 Project

First, create a new v0 project:

```bash
# Create a new v0 project
npm create v0@latest

# Follow the prompts:
# - Project name: festifind
# - Select features: TypeScript, ESLint
# - Would you like to use App Router? Yes
# - Would you like to customize the default import alias? No
```

After the project is created, navigate to the project directory:

```bash
cd festifind
```

## Step 2: Add shadcn-ui

Next, add shadcn-ui components:

```bash
# Initialize shadcn-ui
npx shadcn-ui@latest init

# Follow the prompts:
# - Would you like to use TypeScript? Yes
# - Which style would you like to use? Default
# - Which color would you like to use as base color? Slate
# - Where is your global CSS file? app/globals.css
# - Would you like to use CSS variables? Yes
# - Where is your tailwind.config.js located? tailwind.config.js
# - Configure the import alias? @/components
# - Are you using React Server Components? Yes
```

## Step 3: Set up Supabase

Install the Supabase client and create environment variables:

```bash
# Install Supabase client
npm install @supabase/supabase-js
```

Create a `.env.local` file in the root of your project:

```
NEXT_PUBLIC_SUPABASE_URL=https://lfqwwjrvxiqbizirwxgf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcXd3anJ2eGlxYml6aXJ3eGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNjg0OTgsImV4cCI6MjA1OTk0NDQ5OH0.u15Z1OSFy-RS-2Jv-diKVl_k8-uoCcFyTtsfCXbuGAw
```

## Step 4: Create Supabase Client

Create a utility file to initialize the Supabase client:

```bash
# Create lib directory if it doesn't exist
mkdir -p lib
```

Create `lib/supabase.ts` with the following content:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Step 5: Set Up Database Schema

The database schema should be created in Supabase using the SQL editor. Use the following SQL commands to create the necessary tables:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Festivals table
CREATE TABLE festivals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  duration_days INTEGER,
  location TEXT,
  location_detail TEXT,
  country TEXT,
  source_website TEXT NOT NULL,
  detail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_festivals_start_date ON festivals(start_date);
CREATE INDEX idx_festivals_source ON festivals(source_website);

-- User preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, festival_id)
);

-- Create indexes
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_festival_id ON user_preferences(festival_id);
CREATE INDEX idx_user_preferences_favorite ON user_preferences(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_user_preferences_archived ON user_preferences(is_archived) WHERE is_archived = TRUE;

-- Notes table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  festival_id UUID NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, festival_id)
);

-- Create indexes
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_festival_id ON notes(festival_id);

-- Scraper metadata table
CREATE TABLE scraper_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_website TEXT NOT NULL UNIQUE,
  last_run TIMESTAMP WITH TIME ZONE,
  festivals_found INTEGER,
  status TEXT,
  log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert mock festival data
INSERT INTO festivals (name, start_date, end_date, duration_days, location, country, source_website, detail_url)
VALUES
('Amsterdam Dance Event', '2025-10-15', '2025-10-19', 5, 'Amsterdam', 'Netherlands', 'mock', 'https://example.com/ade'),
('Tomorrowland', '2025-07-18', '2025-07-27', 10, 'Boom', 'Belgium', 'mock', 'https://example.com/tomorrowland'),
('Glastonbury Festival', '2025-06-24', '2025-06-28', 5, 'Pilton', 'United Kingdom', 'mock', 'https://example.com/glastonbury'),
('Coachella', '2025-04-11', '2025-04-20', 10, 'Indio', 'United States', 'mock', 'https://example.com/coachella'),
('Rock Werchter', '2025-07-03', '2025-07-06', 4, 'Werchter', 'Belgium', 'mock', 'https://example.com/rockwerchter');
```

## Step 6: Create Basic Project Structure

Set up the directory structure:

```bash
# Create component directories
mkdir -p components/ui
mkdir -p components/festival
mkdir -p components/layout
mkdir -p components/dev-tools

# Create app directories
mkdir -p app/dev-tools
```

## Step 7: Install Additional Dependencies

Install necessary dependencies:

```bash
# Install date-fns for date formatting
npm install date-fns

# Install shadcn-ui components we'll need
npx shadcn-ui@latest add table
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add card
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add input
npx shadcn-ui@latest add dialog
```

## Step 8: Set Up Git

Initialize Git and connect to the repository:

```bash
# Initialize Git repository if not already initialized
git init

# Add all files
git add .

# Commit the initial setup
git commit -m "Initial project setup"

# Connect to the remote repository
git remote add origin https://github.com/danielvandrunen/festifind.git

# Push to the main branch
git push -u origin main
```

## Step 9: Create Basic Types

Create a types file for TypeScript definitions:

```bash
# Create types file
touch lib/types.ts
```

Add the following content to `lib/types.ts`:

```typescript
// Festival type
export interface Festival {
  id: string;
  name: string;
  start_date: string;
  end_date?: string;
  duration_days: number;
  location: string;
  location_detail?: string;
  country?: string;
  source_website: string;
  detail_url?: string;
  created_at?: string;
  updated_at?: string;
}

// User preference type
export interface UserPreference {
  id: string;
  user_id: string;
  festival_id: string;
  is_favorite: boolean;
  is_archived: boolean;
  created_at?: string;
  updated_at?: string;
}

// Note type
export interface Note {
  id: string;
  user_id: string;
  festival_id: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

// Scraper metadata type
export interface ScraperMetadata {
  id: string;
  source_website: string;
  last_run?: string;
  festivals_found?: number;
  status?: string;
  log?: string;
  created_at?: string;
  updated_at?: string;
}

// Combined Festival with user preferences
export interface FestivalWithPreferences extends Festival {
  user_preference?: UserPreference;
  note?: Note;
}
```

## Step 10: Create API Utility Functions

Create a file for API interactions:

```bash
# Create API utilities file
touch lib/api.ts
```

Add the following content to `lib/api.ts`:

```typescript
import { supabase } from './supabase';
import { Festival, UserPreference, Note, FestivalWithPreferences } from './types';

/**
 * Fetch festivals with filtering options
 */
export async function getFestivals({
  month,
  selectedSources = [],
  showArchived = false,
  showFavorites = false,
  userId
}: {
  month: Date;
  selectedSources?: string[];
  showArchived?: boolean;
  showFavorites?: boolean;
  userId?: string;
}): Promise<FestivalWithPreferences[]> {
  const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  
  // Format dates for Supabase query
  const startDate = startOfMonth.toISOString().split('T')[0];
  const endDate = endOfMonth.toISOString().split('T')[0];
  
  let query = supabase
    .from('festivals')
    .select(`
      *,
      user_preference:user_preferences!left(*)
    `)
    .gte('start_date', startDate)
    .lte('start_date', endDate);
  
  // Apply source filter if any sources selected
  if (selectedSources.length > 0) {
    query = query.in('source_website', selectedSources);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching festivals:', error);
    return [];
  }
  
  // Filter the results based on user preferences
  let festivals = data as unknown as FestivalWithPreferences[];
  
  if (userId) {
    // Fetch user preferences for these festivals
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .in('festival_id', festivals.map(f => f.id));
    
    // Fetch notes for these festivals
    const { data: notes } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .in('festival_id', festivals.map(f => f.id));
    
    // Merge the data
    if (preferences) {
      festivals = festivals.map(festival => {
        const preference = preferences.find(p => p.festival_id === festival.id);
        const note = notes?.find(n => n.festival_id === festival.id);
        
        return {
          ...festival,
          user_preference: preference as UserPreference,
          note: note as Note
        };
      });
    }
    
    // Apply favorite filter
    if (showFavorites) {
      festivals = festivals.filter(f => f.user_preference?.is_favorite);
    }
    
    // Apply archive filter
    if (showArchived) {
      festivals = festivals.filter(f => f.user_preference?.is_archived);
    } else {
      festivals = festivals.filter(f => !f.user_preference?.is_archived);
    }
  }
  
  return festivals;
}

/**
 * Toggle favorite status for a festival
 */
export async function toggleFavorite(
  festivalId: string,
  userId: string,
  currentStatus: boolean
): Promise<boolean> {
  const newStatus = !currentStatus;
  
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      festival_id: festivalId,
      user_id: userId,
      is_favorite: newStatus
    }, { onConflict: 'user_id, festival_id' });
    
  if (error) {
    console.error('Error toggling favorite status:', error);
    return currentStatus;
  }
  
  return newStatus;
}

/**
 * Toggle archive status for a festival
 */
export async function toggleArchive(
  festivalId: string,
  userId: string,
  currentStatus: boolean
): Promise<boolean> {
  const newStatus = !currentStatus;
  
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      festival_id: festivalId,
      user_id: userId,
      is_archived: newStatus
    }, { onConflict: 'user_id, festival_id' });
    
  if (error) {
    console.error('Error toggling archive status:', error);
    return currentStatus;
  }
  
  return newStatus;
}

/**
 * Save note for a festival
 */
export async function saveNote(
  festivalId: string,
  userId: string,
  content: string
): Promise<boolean> {
  const { error } = await supabase
    .from('notes')
    .upsert({
      festival_id: festivalId,
      user_id: userId,
      content
    }, { onConflict: 'user_id, festival_id' });
    
  if (error) {
    console.error('Error saving note:', error);
    return false;
  }
  
  return true;
}

/**
 * Get scraper metadata
 */
export async function getScraperMetadata(): Promise<any[]> {
  const { data, error } = await supabase
    .from('scraper_metadata')
    .select('*');
    
  if (error) {
    console.error('Error fetching scraper metadata:', error);
    return [];
  }
  
  return data;
}
```

## Step 11: Create the Layout Component

Create a basic layout component:

```bash
# Create layout component
touch components/layout/MainLayout.tsx
```

Add the following content to `components/layout/MainLayout.tsx`:

```tsx
import Link from 'next/link';
import { Calendar, Settings, Home } from 'lucide-react';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="font-bold text-2xl flex items-center">
              <Calendar className="h-6 w-6 mr-2" />
              FestiFind
            </Link>
          </div>
          <nav>
            <ul className="flex space-x-4">
              <li>
                <Link href="/" className="flex items-center px-3 py-2 rounded hover:bg-slate-100">
                  <Home className="h-4 w-4 mr-2" />
                  Festivals
                </Link>
              </li>
              <li>
                <Link href="/dev-tools" className="flex items-center px-3 py-2 rounded hover:bg-slate-100">
                  <Settings className="h-4 w-4 mr-2" />
                  Dev Tools
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600">
          FestiFind &copy; {new Date().getFullYear()} - A festival aggregator tool
        </div>
      </footer>
    </div>
  );
}
```

## Step 12: Update the Root Layout

Update the root layout in `app/layout.tsx`:

```tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import MainLayout from "@/components/layout/MainLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FestiFind - Festival Aggregator",
  description: "Track, favorite, and archive festivals from multiple sources",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
```

## Step 13: Create Initial Page

Update the home page in `app/page.tsx`:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Festivals</h1>
        <p className="text-muted-foreground">
          Browse, favorite, and track festivals from multiple sources.
        </p>
      </div>
      
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Festivals</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Festivals</CardTitle>
              <CardDescription>
                Browse all upcoming festivals from various sources.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Festival table will go here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="favorites" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Favorite Festivals</CardTitle>
              <CardDescription>
                Your favorite festivals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Favorites table will go here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="archived" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Archived Festivals</CardTitle>
              <CardDescription>
                Festivals you've archived.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Archived festivals table will go here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

## Step 14: Create a Dev Tools Page

Create the dev tools page:

```bash
# Create dev tools page
touch app/dev-tools/page.tsx
```

Add the following content to `app/dev-tools/page.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DevTools() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Developer Tools</h1>
        <p className="text-muted-foreground">
          Tools for scraping, managing, and analyzing festival data.
        </p>
      </div>
      
      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Scraper Status</TabsTrigger>
          <TabsTrigger value="partyflock">Partyflock</TabsTrigger>
          <TabsTrigger value="festivalinfo">Festivalinfo</TabsTrigger>
          <TabsTrigger value="festileaks">Festileaks</TabsTrigger>
          <TabsTrigger value="eblive">EB Live</TabsTrigger>
          <TabsTrigger value="befesti">Befesti</TabsTrigger>
        </TabsList>
        
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scraper Status</CardTitle>
              <CardDescription>
                Overview of all scrapers and their current status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Scraper status table will go here.</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {["partyflock", "festivalinfo", "festileaks", "eblive", "befesti"].map((scraper) => (
          <TabsContent key={scraper} value={scraper} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{scraper.charAt(0).toUpperCase() + scraper.slice(1)} Scraper</CardTitle>
                <CardDescription>
                  Manage and run the {scraper} scraper.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>Controls and data for {scraper} scraper will go here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

## Step 15: Test the Application

Start the development server to test the application:

```bash
npm run dev
```

Visit http://localhost:3000 to see the basic structure of your application.

## Step 16: Commit and Tag the Initial Version

After verifying that everything works, commit and tag the initial version:

```bash
git add .
git commit -m "Set up basic project structure with v0, shadcn-ui, and Supabase"
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

## Next Steps

Now that you have the basic structure in place, you can proceed with:

1. Implementing the festival table component
2. Creating the month pagination component
3. Implementing favorite and archive functionality
4. Adding notes system
5. Building the scraper interfaces

Each component should be developed incrementally, with regular commits and version tagging to maintain a clear development history.