import { useState } from "react";
import { MapPin } from "lucide-react";
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

export type LocationOption = {
  id: string;
  name: string; 
  count?: number;
};

interface LocationFilterProps {
  locations: LocationOption[];
  selectedLocations: string[];
  onLocationsChange: (locations: string[]) => void;
}

export default function LocationFilter({
  locations,
  selectedLocations,
  onLocationsChange,
}: LocationFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Calculate how many filters are active
  const activeFiltersCount = selectedLocations.length;
  const allSelected = activeFiltersCount === locations.length;
  
  // Toggle a single location
  const toggleLocation = (locationId: string) => {
    if (selectedLocations.includes(locationId)) {
      onLocationsChange(selectedLocations.filter(id => id !== locationId));
    } else {
      onLocationsChange([...selectedLocations, locationId]);
    }
  };
  
  // Select all locations
  const selectAll = () => {
    onLocationsChange(locations.map(location => location.id));
  };
  
  // Clear all selections
  const clearAll = () => {
    onLocationsChange([]);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1">
          <MapPin className="h-4 w-4" />
          Locations
          {activeFiltersCount > 0 && activeFiltersCount < locations.length && (
            <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {activeFiltersCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Filter by Country</DropdownMenuLabel>
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
              id="select-all-locations"
              onCheckedChange={selectAll}
            />
            <label htmlFor="select-all-locations" className="flex-1 cursor-pointer">
              Select All
            </label>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {locations.map((location) => (
            <DropdownMenuItem
              key={location.id}
              onSelect={(e) => {
                e.preventDefault();
                toggleLocation(location.id);
              }}
              className="flex items-center gap-2"
            >
              <Checkbox 
                checked={selectedLocations.includes(location.id)} 
                id={`location-${location.id}`}
                onCheckedChange={() => toggleLocation(location.id)}
              />
              <label htmlFor={`location-${location.id}`} className="flex-1 cursor-pointer">
                {location.name}
              </label>
              {location.count !== undefined && (
                <span className="text-xs text-gray-500">
                  {location.count}
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