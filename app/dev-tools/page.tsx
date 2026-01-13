'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useFestival } from '../contexts/FestivalContext';
import { useNotification } from '../contexts/NotificationContext';

const DevToolsPage: React.FC = () => {
  const [isClearing, setIsClearing] = useState(false);
  const [lastClearTime, setLastClearTime] = useState<string | null>(null);
  const { clearAllResearchData } = useFestival();
  const { showSuccess, showError, showInfo } = useNotification();

  const handleClearResearchData = async () => {
    if (isClearing) return;

    // Show confirmation dialog
    const confirmed = window.confirm(
      '⚠️ WARNING: This will permanently delete ALL research data from both the database and local storage.\n\n' +
      'This action cannot be undone. Are you sure you want to continue?'
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsClearing(true);
      showInfo('Clearing all research data...');
      
      await clearAllResearchData();
      
      setLastClearTime(new Date().toLocaleString());
      showSuccess('All research data has been cleared successfully!');
    } catch (error) {
      console.error('Error clearing research data:', error);
      showError(`Failed to clear research data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            🛠️ Developer Tools
          </h1>
          <p className="text-gray-600 mt-2">
            Administrative tools for development and debugging purposes.
          </p>
        </div>

        {/* Warning Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Development Environment Only
              </h3>
              <p className="text-sm text-yellow-700">
                These tools are intended for development and debugging purposes only. 
                Use with caution as some actions cannot be undone.
              </p>
            </div>
          </div>
        </div>

        {/* Research Data Management */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            🔬 Research Data Management
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Clear All Research Data
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Permanently removes all festival research data from both the database and local storage. 
                  This includes all research logs, statuses, and cached data.
                </p>
                
                {lastClearTime && (
                  <div className="flex items-center text-sm text-green-600 dark:text-green-400 mb-4">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Last cleared: {lastClearTime}
                  </div>
                )}
                
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-red-700 dark:text-red-300">
                      <strong>Warning:</strong> This action is irreversible and will affect all festivals in the system.
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleClearResearchData}
                disabled={isClearing}
                className={`ml-6 flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isClearing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {isClearing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Research Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            ℹ️ System Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Environment:</span>
              <span className="ml-2 text-gray-600">Development</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Build Time:</span>
              <span className="ml-2 text-gray-600">{new Date().toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">User Agent:</span>
              <span className="ml-2 text-gray-600 break-all">
                {typeof window !== 'undefined' ? window.navigator.userAgent.substring(0, 50) + '...' : 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Local Storage:</span>
              <span className="ml-2 text-gray-600">
                {typeof window !== 'undefined' ? 'Available' : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevToolsPage; 