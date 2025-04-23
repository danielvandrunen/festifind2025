import React from 'react';
import { FestivalSource } from '../../lib/types';

interface SourceFilterProps {
  selectedSources: FestivalSource[];
  onSourcesChange: (sources: FestivalSource[]) => void;
}

export function SourceFilter({ selectedSources, onSourcesChange }: SourceFilterProps) {
  const sources: FestivalSource[] = [
    'befesti',
    'partyflock',
    'festileaks',
    'festivalinfo',
    'eblive'
  ];
  
  const sourceLabels: Record<FestivalSource, string> = {
    'befesti': 'Befesti',
    'partyflock': 'Partyflock',
    'festileaks': 'Festileaks',
    'festivalinfo': 'Festivalinfo',
    'eblive': 'EB Live'
  };
  
  const handleSourceToggle = (source: FestivalSource) => {
    if (selectedSources.includes(source)) {
      onSourcesChange(selectedSources.filter(s => s !== source));
    } else {
      onSourcesChange([...selectedSources, source]);
    }
  };
  
  const handleSelectAll = () => {
    onSourcesChange([...sources]);
  };
  
  const handleClearAll = () => {
    onSourcesChange([]);
  };
  
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Filter by Source</h2>
        <div className="space-x-2">
          <button 
            onClick={handleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Select All
          </button>
          <span>|</span>
          <button 
            onClick={handleClearAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear All
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {sources.map(source => (
          <label 
            key={source}
            className="flex items-center bg-gray-100 hover:bg-gray-200 p-2 rounded cursor-pointer"
          >
            <input 
              type="checkbox"
              checked={selectedSources.includes(source)}
              onChange={() => handleSourceToggle(source)}
              className="mr-2"
            />
            {sourceLabels[source]}
          </label>
        ))}
      </div>
    </div>
  );
} 