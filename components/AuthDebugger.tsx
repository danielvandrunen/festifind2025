'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../app/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';

interface NavigationEvent {
  timestamp: string;
  from: string;
  to: string;
  trigger: string;
}

const AuthDebugger: React.FC = () => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [navigationHistory, setNavigationHistory] = useState<NavigationEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Track pathname changes
    const timestamp = new Date().toISOString();
    setNavigationHistory(prev => [
      ...prev.slice(-9), // Keep last 10 entries
      {
        timestamp,
        from: prev[prev.length - 1]?.to || 'initial',
        to: pathname || 'unknown',
        trigger: 'pathname_change'
      }
    ]);
  }, [pathname]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-3 py-2 rounded text-xs z-50"
      >
        Auth Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs max-w-md z-50">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold">Auth Debug</h4>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2">
        <div>
          <strong>Current State:</strong>
          <div>User: {user ? user.email : 'None'}</div>
          <div>Path: {pathname}</div>
          <div>Loading: {loading ? 'Yes' : 'No'}</div>
        </div>
        
        <div>
          <strong>Recent Navigation:</strong>
          <div className="max-h-32 overflow-y-auto">
            {navigationHistory.slice(-5).map((nav, index) => (
              <div key={index} className="text-[10px] opacity-75">
                {new Date(nav.timestamp).toLocaleTimeString()}: 
                {nav.from} → {nav.to}
              </div>
            ))}
          </div>
        </div>
        
        <div className="text-[10px] opacity-50">
          Check browser console for detailed auth logs
        </div>
      </div>
    </div>
  );
};

export default AuthDebugger; 