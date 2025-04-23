export interface Festival {
  id: string;
  name: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  location: {
    city: string;
    country: string;
  };
  source: {
    name: string;
    url: string;
  };
}

export interface FestivalWithPreferences extends Festival {
  isFavorite: boolean;
  isArchived: boolean;
  notes: string;
} 