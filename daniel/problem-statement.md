# FestiFind - Problem Statement

## Overview

Music festival enthusiasts and industry professionals need a centralized place to discover, track, and manage festival information that is otherwise scattered across multiple websites. The current process of manually checking multiple sources is time-consuming and makes it difficult to keep track of festival dates, locations, and personal preferences.

## Problem

Currently, festival data is distributed across at least 5 different websites:
1. Partyflock (https://partyflock.nl/agenda/festivals)
2. Festivalinfo (https://www.festivalinfo.nl/festivals/)
3. Festileaks (https://festileaks.com/festivalagenda/)
4. EB Live (https://www.eblive.nl/festivals/)
5. Befesti (https://befesti.nl/festivalagenda)

Each website has its own format, structure, and navigation system. There's no unified interface to view all festivals in one place, mark favorites, take notes, or filter based on preferences.

## Solution

FestiFind will be a web application that:
- Aggregates festival data from multiple sources into one unified interface
- Allows users to browse festivals with a clean, modern UI (Stripe-style)
- Provides month-by-month pagination to navigate through festivals
- Enables filtering by source website
- Supports favoriting and archiving festivals
- Permits adding personal notes to festivals
- Includes developer tools for managing the scraping process

The application will be built with v0 (React), shadcn UI components, and use Supabase for database storage. It will initially launch with mock data and later incorporate individual scrapers for each source website.

## Target Users

1. **Festival Enthusiasts**: People who attend multiple festivals per year and need to keep track of dates and details
2. **Industry Professionals**: Those working in the music/festival industry who need a comprehensive overview of the festival landscape
3. **Event Planners**: People planning around festival dates who need to avoid conflicts
4. **Sales Teams**: Professionals who use festival data as a sales tool

## Success Metrics

1. Successful aggregation of festival data from all 5 sources
2. Intuitive UI that allows easy browsing, filtering, and management of festivals
3. Reliable persistence of user preferences (favorites, archives, notes)
4. Deployable production version with proper authentication

This document outlines the core problem and solution approach for the FestiFind project. It serves as the foundation for the technical architecture and implementation strategy.

## Related Documents
- [Technical Architecture Document](./technical-architecture.md)
- [Component Specifications](./component-specs.md)
- [Data Schema](./data-schema.md)
- [Tasks](./tasks.md)
