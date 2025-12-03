// Festival data from the database
export interface Festival {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  country: string;
  source: string;
  source_url?: string;
  created_at: string;
  updated_at: string;
}

// Define the research status type
export interface ResearchStatus {
  id: string;
  status: 'pending' | 'complete' | 'failed';
}

// Define a type for sales stages
export type SalesStage = 'favorited' | 'outreach' | 'talking' | 'offer' | 'deal';

// User preference for a festival (favorite, archived, notes)
export interface FestivalPreference {
  id: string;
  festival_id: string;
  user_id: string;
  favorite: boolean;
  archived: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Combined festival with user preferences
export interface FestivalWithPreferences extends Festival {
  favorite: boolean;
  archived: boolean;
  notes?: string;
  sales_stage?: SalesStage;
  research?: ResearchStatus | null;
} 