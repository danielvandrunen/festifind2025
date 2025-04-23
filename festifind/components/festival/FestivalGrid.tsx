import { FestivalWithPreferences } from "@/types/festival";
import FestivalCard from "./FestivalCard";

interface FestivalGridProps {
  festivals: FestivalWithPreferences[];
  onFavoriteToggle?: (festivalId: string, isFavorite: boolean) => void;
  onArchiveToggle?: (festivalId: string, isArchived: boolean) => void;
}

export default function FestivalGrid({
  festivals,
  onFavoriteToggle,
  onArchiveToggle
}: FestivalGridProps) {
  if (festivals.length === 0) {
    return (
      <div className="text-center py-10 bg-gray-50 rounded-lg">
        <p className="text-gray-600">No festivals found for the selected filters.</p>
        <p className="text-sm mt-2">Try changing your filter settings.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {festivals.map(festival => (
        <FestivalCard
          key={festival.id}
          festival={festival}
          onFavoriteToggle={onFavoriteToggle}
          onArchiveToggle={onArchiveToggle}
        />
      ))}
    </div>
  );
} 