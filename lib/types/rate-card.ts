// Rate card related types

export interface RateCardUpdatePayload {
  requested?: boolean;
  received?: boolean;
  date?: string | null;
  notes?: string | null;
}

export interface FestivalWithRateCard {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  country: string;
  source: string;
  source_url?: string;
  rate_card_requested?: boolean;
  rate_card_received?: boolean;
  rate_card_date?: string | null;
  rate_card_notes?: string | null;
} 