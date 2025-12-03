import React, { useState, useEffect } from 'react';
import { Wand2, FileText, Loader2 } from 'lucide-react';

interface ResearchButtonProps {
  festivalId: string;
  status?: 'pending' | 'complete' | 'failed' | null;
  onResearch: (festivalId: string) => Promise<void>;
  onShowResearch?: (festivalId: string) => void;
  disabled?: boolean;
}

const ResearchButton: React.FC<ResearchButtonProps> = ({
  festivalId,
  status,
  onResearch,
  onShowResearch,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState(status);

  // Listen for research completion events to force UI updates
  useEffect(() => {
    const handleResearchCompleted = (event: CustomEvent) => {
      if (event.detail.festivalId === festivalId) {
        console.log(`🔄 ResearchButton: Received completion event for ${festivalId}`, event.detail);
        // Force a re-render by updating the last status
        setLastStatus(event.detail.status?.status);
      }
    };

    // Listen for the custom event dispatched when research completes
    document.addEventListener('festival-research-completed', handleResearchCompleted as EventListener);
    
    return () => {
      document.removeEventListener('festival-research-completed', handleResearchCompleted as EventListener);
    };
  }, [festivalId]);

  // Update last status when prop changes
  useEffect(() => {
    if (status !== lastStatus) {
      console.log(`🔄 ResearchButton: Status changed for ${festivalId}: ${lastStatus} → ${status}`);
      setLastStatus(status);
    }
  }, [status, lastStatus, festivalId]);
  
  const handleClick = async () => {
    if (disabled || isLoading) return;
    
    if (currentStatus === 'complete' && onShowResearch) {
      // Show existing research
      onShowResearch(festivalId);
    } else if (currentStatus !== 'pending' && currentStatus !== 'complete') {
      // Initiate new research
      setIsLoading(true);
      try {
        await onResearch(festivalId);
      } catch (error) {
        console.error('Research failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Don't show button if disabled globally
  if (disabled) {
    return null;
  }

  // Use the most current status (either from props or events)
  const currentStatus = status || lastStatus;
  
  // Debug log for tracking status
  useEffect(() => {
    const festival = document.querySelector(`[data-festival-id="${festivalId}"]`);
    const festivalName = festival?.getAttribute('data-festival-name') || festivalId;
    console.log(`🔍 ResearchButton: Status update for ${festivalName}: prop=${status}, last=${lastStatus}, effective=${currentStatus}, isLoading=${isLoading}`);
  }, [festivalId, status, lastStatus, currentStatus, isLoading]);
  
  // Show loading state if local loading or if status is pending
  const showLoader = isLoading || currentStatus === 'pending';
  
  // Determine button appearance based on current status
  if (currentStatus === 'complete') {
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition-colors"
        title="View research results"
      >
        <FileText size={16} />
        View Research
      </button>
    );
  }
  
  if (showLoader) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-400 text-white text-sm rounded-md cursor-not-allowed"
        title="Research in progress..."
      >
        <Loader2 size={16} className="animate-spin" />
        Researching...
      </button>
    );
  }
  
  if (currentStatus === 'failed') {
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-md transition-colors"
        title="Research failed - click to retry"
      >
        <Wand2 size={16} />
        Retry Research
      </button>
    );
  }

  // Default state - no research yet
  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors"
      title="Start AI research"
    >
      <Wand2 size={16} />
      Research
    </button>
  );
};

export default ResearchButton; 