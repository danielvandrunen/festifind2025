import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase-client';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body containing localStorage data
    const body = await request.json();
    const { favorites, archived, notes, salesStages } = body;
    
    console.log('Syncing user preferences to database:', {
      favoritesCount: Object.keys(favorites || {}).length,
      archivedCount: Object.keys(archived || {}).length,
      notesCount: Object.keys(notes || {}).length,
      salesStagesCount: Object.keys(salesStages || {}).length
    });
    
    // Collect all festival IDs that need updates
    const allFestivalIds = new Set([
      ...Object.keys(favorites || {}),
      ...Object.keys(archived || {}),
      ...Object.keys(notes || {}),
      ...Object.keys(salesStages || {})
    ]);
    
    if (allFestivalIds.size === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No preferences to sync',
        synced: 0
      });
    }
    
    // Process festivals in batches to avoid overwhelming the database
    const batchSize = 50;
    const festivalIds = Array.from(allFestivalIds);
    let syncedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < festivalIds.length; i += batchSize) {
      const batch = festivalIds.slice(i, i + batchSize);
      
      // Prepare update objects for this batch
      const updates = batch.map(festivalId => {
        const updates: any = { id: festivalId };
        
        // Only update fields that have values in localStorage
        if (favorites && favorites[festivalId] !== undefined) {
          updates.favorite = !!favorites[festivalId];
        }
        
        if (archived && archived[festivalId] !== undefined) {
          updates.archived = !!archived[festivalId];
        }
        
        if (notes && notes[festivalId] !== undefined) {
          updates.notes = notes[festivalId];
        }
        
        if (salesStages && salesStages[festivalId] !== undefined) {
          updates.sales_stage = salesStages[festivalId];
        }
        
        // Apply smart favoriting logic
        if (updates.sales_stage && updates.sales_stage !== 'favorited') {
          updates.favorite = true; // Auto-favorite festivals in active sales stages
        }
        
        return updates;
      });
      
      // Update festivals in this batch
      for (const updateData of updates) {
        try {
          const { error } = await supabase
            .from('festivals')
            .update(updateData)
            .eq('id', updateData.id);
          
          if (error) {
            console.error(`Error updating festival ${updateData.id}:`, error);
            errorCount++;
          } else {
            syncedCount++;
          }
        } catch (error) {
          console.error(`Unexpected error updating festival ${updateData.id}:`, error);
          errorCount++;
        }
      }
    }
    
    console.log(`Preferences sync completed: ${syncedCount} synced, ${errorCount} errors`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Synced preferences for ${syncedCount} festivals`,
      synced: syncedCount,
      errors: errorCount
    });
    
  } catch (error: any) {
    console.error('Error syncing preferences to database:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error syncing preferences',
      error: error.message
    }, { status: 500 });
  }
} 