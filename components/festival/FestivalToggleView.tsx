import { LayoutGrid, Table } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = 'table' | 'grid';

interface FestivalToggleViewProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function FestivalToggleView({
  viewMode,
  onViewModeChange
}: FestivalToggleViewProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-md p-1">
      <Button
        variant={viewMode === 'table' ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange('table')}
        className={`px-3 ${viewMode === 'table' ? "" : "hover:bg-gray-200"}`}
      >
        <Table className="h-4 w-4 mr-1" />
        Table
      </Button>
      
      <Button
        variant={viewMode === 'grid' ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewModeChange('grid')}
        className={`px-3 ${viewMode === 'grid' ? "" : "hover:bg-gray-200"}`}
      >
        <LayoutGrid className="h-4 w-4 mr-1" />
        Grid
      </Button>
    </div>
  );
} 