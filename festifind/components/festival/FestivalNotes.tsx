import { useState } from "react";
import { ChevronDown, ChevronUp, FileTextIcon } from "lucide-react";

interface FestivalNotesProps {
  notes: string;
  expanded?: boolean;
  maxPreviewLength?: number;
}

export default function FestivalNotes({ 
  notes,
  expanded = false, 
  maxPreviewLength = 100
}: FestivalNotesProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  
  // Return null if no notes
  if (!notes || notes.trim() === '') {
    return null;
  }
  
  const needsExpansion = notes.length > maxPreviewLength;
  const displayText = isExpanded || !needsExpansion 
    ? notes 
    : `${notes.substring(0, maxPreviewLength).trim()}...`;
  
  return (
    <div className="mt-2 text-sm">
      <div className="flex items-start gap-2">
        <FileTextIcon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="text-gray-600 whitespace-pre-wrap">{displayText}</div>
          
          {needsExpansion && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-500 hover:text-blue-700 text-xs font-medium flex items-center mt-1"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Show more
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 