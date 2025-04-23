export interface Festival {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  location: string;
  country: string;
  url: string;
  source: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  favorite: boolean;
  notes: string | null;
}

export type FestivalSource = 'befesti' | 'partyflock' | 'festileaks' | 'festivalinfo' | 'eblive';

export interface UserPreferences {
  id: string;
  user_id: string;
  selected_sources: FestivalSource[];
  view_mode: 'all' | 'favorites' | 'archived';
  created_at: string;
  updated_at: string;
} 