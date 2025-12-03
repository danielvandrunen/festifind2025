import { useState, useEffect } from "react";
import { Check, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export type SourceOption = {
  id: string;
  name: string; 
  count?: number;
};

interface SourceFilterProps {
  sources: SourceOption[];
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
}

export default function SourceFilter({
  sources,
  selectedSources,
  onSourcesChange,
}: SourceFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Calculate how many filters are active
  const activeFiltersCount = selectedSources.length;
  const allSelected = activeFiltersCount === sources.length;
  
  // Toggle a single source
  const toggleSource = (sourceId: string) => {
    if (selectedSources.includes(sourceId)) {
      onSourcesChange(selectedSources.filter(id => id !== sourceId));
    } else {
      onSourcesChange([...selectedSources, sourceId]);
    }
  };
  
  // Select all sources
  const selectAll = () => {
    onSourcesChange(sources.map(source => source.id));
  };
  
  // Clear all selections
  const clearAll = () => {
    onSourcesChange([]);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1">
          <Filter className="h-4 w-4" />
          Sources
          {activeFiltersCount > 0 && (
            <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter by Source</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem 
            onSelect={(e) => { 
              e.preventDefault();
              allSelected ? clearAll() : selectAll();
            }}
            className="flex items-center gap-2"
          >
            <Checkbox 
              checked={allSelected} 
              id="select-all"
              onCheckedChange={selectAll}
            />
            <label htmlFor="select-all" className="flex-1 cursor-pointer">
              Select All
            </label>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {sources.map((source) => (
            <DropdownMenuItem
              key={source.id}
              onSelect={(e) => {
                e.preventDefault();
                toggleSource(source.id);
              }}
              className="flex items-center gap-2"
            >
              <Checkbox 
                checked={selectedSources.includes(source.id)} 
                id={`source-${source.id}`}
                onCheckedChange={() => toggleSource(source.id)}
              />
              <label htmlFor={`source-${source.id}`} className="flex-1 cursor-pointer">
                {source.name}
              </label>
              {source.count !== undefined && (
                <span className="text-xs text-gray-500">
                  {source.count}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="flex justify-between p-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAll}
            disabled={activeFiltersCount === 0}
          >
            Clear
          </Button>
          <Button 
            size="sm" 
            onClick={() => setIsOpen(false)}
          >
            Apply
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 