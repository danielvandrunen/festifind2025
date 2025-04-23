# Festival Table Component Specification

## Overview

The Festival Table component is a central UI element in the FestiFind application. It displays festival data in a tabular format with sorting, filtering, and interactive features like favoriting and archiving.

## Component Purpose

This component provides users with:
1. A clear overview of festivals in a tabular format
2. Tools to sort and filter the displayed festivals
3. Interactive elements to mark festivals as favorites
4. Option to archive festivals they're not interested in
5. Ability to add notes to festivals

## Visual Design

The Festival Table follows a clean, modern Stripe-like design with:
- White background with subtle borders
- High-contrast text for readability
- Clear visual indicators for favorites and archived items
- Consistent spacing and alignment
- Interactive elements (buttons, toggles) with hover effects
- Clear pagination indicators

## Component Structure

```tsx
<FestivalTable
  festivals={festivals}
  onFavoriteToggle={handleFavoriteToggle}
  onArchiveToggle={handleArchiveToggle}
  onNoteChange={handleNoteChange}
/>
```

## Props Interface

```typescript
interface FestivalTableProps {
  // Array of festival data to display
  festivals: FestivalWithPreferences[];
  
  // Callback for when a festival is favorited/unfavorited
  onFavoriteToggle?: (festivalId: string, isFavorite: boolean) => void;
  
  // Callback for when a festival is archived/unarchived
  onArchiveToggle?: (festivalId: string, isArchived: boolean) => void;
  
  // Callback for when a note is changed
  onNoteChange?: (festivalId: string, note: string) => void;
}
```

## Implementation Details

### Table Structure

The table contains the following columns:
1. **Name** - Festival name with link to original source
2. **Date** - Formatted as "1 April - 3 April (3 days)" or similar
3. **Location** - City and country information
4. **Source** - Website from which the festival data originated
5. **Actions** - Interactive buttons for favorite, archive, and notes

### Column Sorting

Columns that support sorting:
- Name (alphabetical)
- Date (chronological)
- Location (alphabetical by city)
- Source (alphabetical)

### Interactive Elements

Each row contains:
- **Favorite button** - Heart icon toggle (empty/filled)
- **Archive button** - Archive icon toggle
- **Notes button** - Opens a dialog for adding/editing notes
- **External link** - Icon linking to the original festival page