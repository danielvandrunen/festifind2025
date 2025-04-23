'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client';
import { FestivalTable } from '../../components/festival/FestivalTable';
import { MonthPaginator } from '../../components/festival/MonthPaginator';
import { SourceFilter } from '../../components/festival/SourceFilter';
import { Festival, FestivalSource } from '../../lib/types';

export default function FestivalsPage() {
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSources, setSelectedSources] = useState<FestivalSource[]>([
    'befesti', 'partyflock', 'festileaks', 'festivalinfo', 'eblive'
  ]);

  useEffect(() => {
    const fetchFestivals = async () => {
      setLoading(true);
      
      // Calculate start and end dates for the current month
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .gte('start_date', startDate.toISOString().split('T')[0])
        .lte('start_date', endDate.toISOString().split('T')[0])
        .in('source', selectedSources)
        .order('start_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching festivals:', error);
      } else {
        setFestivals(data as Festival[]);
      }
      
      setLoading(false);
    };

    fetchFestivals();
  }, [currentDate, selectedSources]);

  const handleMonthChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handleSourcesChange = (sources: FestivalSource[]) => {
    setSelectedSources(sources);
  };

  const handleFavoriteToggle = async (id: string) => {
    const festival = festivals.find(f => f.id === id);
    if (!festival) return;

    const { error } = await supabase
      .from('festivals')
      .update({ favorite: !festival.favorite })
      .eq('id', id);

    if (error) {
      console.error('Error updating favorite status:', error);
    } else {
      setFestivals(festivals.map(f => 
        f.id === id ? { ...f, favorite: !f.favorite } : f
      ));
    }
  };

  const handleArchiveToggle = async (id: string) => {
    const festival = festivals.find(f => f.id === id);
    if (!festival) return;

    const { error } = await supabase
      .from('festivals')
      .update({ archived: !festival.archived })
      .eq('id', id);

    if (error) {
      console.error('Error updating archive status:', error);
    } else {
      setFestivals(festivals.map(f => 
        f.id === id ? { ...f, archived: !f.archived } : f
      ));
    }
  };

  const handleOpenNotes = (id: string) => {
    // This would open a notes modal in a real implementation
    alert(`Open notes for festival ID: ${id}`);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6">Upcoming Festivals</h1>
      
      <MonthPaginator 
        currentDate={currentDate}
        onMonthChange={handleMonthChange}
      />
      
      <SourceFilter 
        selectedSources={selectedSources}
        onSourcesChange={handleSourcesChange}
      />
      
      {loading ? (
        <div className="text-center py-6">Loading festivals...</div>
      ) : (
        <FestivalTable 
          festivals={festivals} 
          onFavoriteToggle={handleFavoriteToggle}
          onArchiveToggle={handleArchiveToggle}
          onOpenNotes={handleOpenNotes}
        />
      )}
    </div>
  );
} 