'use client';

import React, { useState } from 'react';
import { Filter, Check } from 'lucide-react';

interface SourceFilterProps {
  sources: string[];
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
}

const SourceFilter: React.FC<SourceFilterProps> = ({
  sources,
  selectedSources,
  onSourcesChange,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Toggle a single source
  const toggleSource = (source: string) => {
    if (selectedSources.includes(source)) {
      // Remove the source if it's already selected
      onSourcesChange(selectedSources.filter((s) => s !== source));
    } else {
      // Add the source if it's not selected
      onSourcesChange([...selectedSources, source]);
    }
  };

  // Select all sources
  const selectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSourcesChange([...sources]);
  };

  // Clear all selections
  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSourcesChange([]);
  };

  // Capitalize first letter of source
  const formatSourceName = (source: string) => {
    return source.charAt(0).toUpperCase() + source.slice(1);
  };

  return (
    <div className="relative">
      <button
        className={`px-3 py-2 rounded-md border text-sm flex items-center space-x-1 ${dropdownOpen ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        <Filter className="h-4 w-4 mr-1" />
        <span className="hidden md:inline">Sources</span>
        {selectedSources.length > 0 && (
          <span className="ml-1 rounded-full bg-blue-600 w-5 h-5 text-xs flex items-center justify-center text-white">
            {selectedSources.length}
          </span>
        )}
      </button>

      {dropdownOpen && (
        <div 
          className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg py-1 z-10 dark:bg-gray-800 border dark:border-gray-700"
        >
          <div className="flex justify-between items-center px-4 py-2 border-b dark:border-gray-700">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear All
            </button>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {sources.map((source) => (
              <div 
                key={source}
                className="flex items-center px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => toggleSource(source)}
              >
                <div 
                  className={`w-4 h-4 mr-3 rounded border flex items-center justify-center ${
                    selectedSources.includes(source) 
                      ? 'bg-blue-600 border-blue-600' 
                      : 'border-gray-300 dark:border-gray-500'
                  }`}
                >
                  {selectedSources.includes(source) && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                <span className="text-sm">{formatSourceName(source)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Close dropdown when clicking outside */}
      {dropdownOpen && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
};

export default SourceFilter; 