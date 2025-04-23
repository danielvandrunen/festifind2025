import { supabase } from '../supabase';
import { Festival, FestivalWithPreferences } from '@/types/festival';

/**
 * Fetch all festivals from the database
 */
export async function getFestivals(): Promise<FestivalWithPreferences[]> {
  console.log('Fetching festivals from database...');
  
  try {
    const { data, error } = await supabase
      .from('festivals')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching festivals:', error);
      return [];
    }

    console.log(`Found ${data?.length || 0} festivals in database`);
    
    if (!data || data.length === 0) {
      console.log('No festivals found in database');
      return [];
    }
    
    // Log the first festival to help debug
    console.log('First festival data:', data[0]);

    // Transform database records to match our FestivalWithPreferences type
    return data.map(item => ({
      id: item.id,
      name: item.name,
      startDate: item.start_date,
      endDate: item.end_date,
      location: {
        city: item.location,
        country: item.country
      },
      source: {
        name: item.source,
        url: item.url
      },
      isFavorite: item.favorite,
      isArchived: item.archived,
      notes: item.notes || ''
    }));
  } catch (err) {
    console.error('Exception in getFestivals:', err);
    return [];
  }
}

/**
 * Update a festival's favorite status
 */
export async function updateFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await supabase
    .from('festivals')
    .update({ favorite: isFavorite })
    .eq('id', id);

  if (error) {
    console.error('Error updating favorite status:', error);
    throw new Error('Failed to update favorite status');
  }
}

/**
 * Update a festival's archived status
 */
export async function updateArchived(id: string, isArchived: boolean): Promise<void> {
  const { error } = await supabase
    .from('festivals')
    .update({ archived: isArchived })
    .eq('id', id);

  if (error) {
    console.error('Error updating archived status:', error);
    throw new Error('Failed to update archived status');
  }
}

/**
 * Update a festival's notes
 */
export async function updateNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('festivals')
    .update({ notes })
    .eq('id', id);

  if (error) {
    console.error('Error updating notes:', error);
    throw new Error('Failed to update notes');
  }
} 