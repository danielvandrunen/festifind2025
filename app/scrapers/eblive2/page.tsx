'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Festival {
  id: string;
  name: string;
  location: string;
  dates: string;
  edition?: string;
  url: string;
  startDate?: string;
  endDate?: string;
  scrapedAt: string;
  source: string;
  hash: string;
}

export default function EBLive2ScraperPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'info' | 'data'>('logs');
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusPolling, setStatusPolling] = useState<NodeJS.Timeout | null>(null);
  const [maxPages, setMaxPages] = useState(41); // Default to 41 pages (all available)
  const [endpointType, setEndpointType] = useState<'inline' | 'run'>('inline'); // Default to inline implementation
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [sortField, setSortField] = useState<keyof Festival>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Load initial status on page load
  useEffect(() => {
    fetchStatus();
  }, []);

  // Clean up status polling when component unmounts
  useEffect(() => {
    return () => {
      if (statusPolling) {
        clearInterval(statusPolling);
      }
    };
  }, [statusPolling]);

  // Fetch status from API
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/scrapers/eblive2/status');
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'never_run') {
          setStatus('idle');
        } else if (data.success) {
          setStatus('success');
          setResult(data);
          
          // Fetch latest festivals from our new endpoint
          fetchLatestFestivals();
        } else {
          setStatus('error');
          setResult(data);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching status:', error);
      setStatus('error');
      setLoading(false);
    }
  };

  // Add new function to fetch latest festivals from the latest file
  const fetchLatestFestivals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scrapers/eblive2/latest');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.festivals && data.festivals.length > 0) {
          setFestivals(data.festivals);
          
          // Also update logs with info about the data
          setLogs(prevLogs => [
            ...prevLogs,
            `[${new Date().toISOString()}] Loaded ${data.festivals.length} festivals from ${data.file}`,
          ]);
        }
      } else {
        console.error('Failed to fetch latest festivals');
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching latest festivals:', error);
      setLoading(false);
    }
  };

  // New function to fetch logs from server logs
  const fetchLogs = async () => {
    try {
      // Get the latest log file
      const response = await fetch('/api/scrapers/eblive2/logs');
      if (response.ok) {
        const logData = await response.json();
        if (logData.logs && logData.logs.length > 0) {
          setLogs(logData.logs);
        }
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const runScraper = async () => {
    try {
      setStatus('running');
      setProgress(0);
      setLogs([
        `[${new Date().toISOString()}] Starting EBLive 2.0 scraper...`,
        `[${new Date().toISOString()}] Using ${endpointType} endpoint with maxPages=${maxPages}`,
        `[${new Date().toISOString()}] Sending request to API...`
      ]);

      // Start progress and log polling
      const interval = setInterval(async () => {
        // Regular progress updating
        setProgress((prev) => {
          if (prev >= 95) {
            return prev;
          }
          return prev + 2;
        });
        
        // Fetch actual logs instead of just simulating them
        await fetchLogs();
      }, 3000);

      // Call API to start scraper with parameters
      const response = await fetch(`/api/scrapers/eblive2/${endpointType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          maxPages: maxPages,
          testMode: false,
          dockerMode: process.env.NEXT_PUBLIC_DOCKER_ENV === 'true'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to run scraper');
      }

      const data = await response.json();
      
      // Set up polling to check status every 5 seconds
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch('/api/scrapers/eblive2/status');
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            // Update progress based on actual status
            if (statusData.progress) {
              setProgress(statusData.progress);
            }
            
            // Fetch logs regardless of completion status
            await fetchLogs();
            
            // If we have a status with a lastRun timestamp that's after our request
            if (statusData.lastRun && new Date(statusData.lastRun) > new Date(data.timestamp)) {
              clearInterval(interval); // Stop progress simulation
              clearInterval(pollInterval); // Stop polling
              setStatusPolling(null);
              
              setProgress(100);
              setResult(statusData);
              
              if (statusData.success) {
                setStatus('success');
                
                if (statusData.festivals) {
                  setFestivals(statusData.festivals);
                }
              } else {
                setStatus('error');
                await fetchLogs(); // Get final logs including error details
              }
            }
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 5000);
      
      setStatusPolling(pollInterval);
      
    } catch (error) {
      console.error('Error running scraper:', error);
      setStatus('error');
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString()}] Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      ]);
    }
  };

  // Update the uploadToSupabase function to use our new endpoint
  const uploadToSupabase = async () => {
    try {
      setUploadStatus('uploading');
      
      setLogs(prev => [
        ...prev,
        `[${new Date().toISOString()}] Uploading ${festivals.length} festivals to Supabase database...`
      ]);
      
      // Call our new upload API endpoint
      const response = await fetch('/api/scrapers/eblive2/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setUploadResult(data);
      
      if (response.ok && data.success) {
        setUploadStatus('success');
        setLogs(prev => [
          ...prev,
          `[${new Date().toISOString()}] Upload successful!`,
          `[${new Date().toISOString()}] Added ${data.count} festivals to database from ${data.file}`
        ]);
      } else {
        setUploadStatus('error');
        setLogs(prev => [
          ...prev,
          `[${new Date().toISOString()}] Upload failed: ${data.message || 'Unknown error'}`,
          `[${new Date().toISOString()}] Details: ${typeof data.error === 'object' ? JSON.stringify(data.error) : data.error || 'No details available'}`
        ]);
      }
    } catch (error) {
      console.error('Error uploading to Supabase:', error);
      setUploadStatus('error');
      setLogs(prev => [
        ...prev,
        `[${new Date().toISOString()}] Error uploading to Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`
      ]);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">EBLive 2.0 Scraper</h1>
        <span className={`px-3 py-1 text-sm font-medium rounded-full ${
          status === 'idle' ? 'bg-gray-100 text-gray-800' : 
          status === 'running' ? 'bg-blue-100 text-blue-800' : 
          status === 'success' ? 'bg-green-100 text-green-800' : 
          'bg-red-100 text-red-800'
        }`}>
          {status === 'idle' ? 'Ready' : status === 'running' ? 'Running' : status === 'success' ? 'Completed' : 'Error'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Control Panel</h2>
            <p className="text-gray-600">
              Run the EBLive 2.0 scraper to collect festival data from eblive.nl
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between">
                <span>Scraper Status</span>
                <span className={
                  status === 'idle' ? 'text-gray-500' : 
                  status === 'running' ? 'text-blue-500' : 
                  status === 'success' ? 'text-green-500' : 
                  'text-red-500'
                }>
                  {status === 'idle' ? 'Ready to run' : 
                    status === 'running' ? 'Running...' : 
                    status === 'success' ? 'Completed' : 
                    'Failed'}
                </span>
              </div>
              {status === 'running' && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}
            </div>
            
            {/* Configuration Options */}
            <div className="border rounded-md p-4 bg-gray-50">
              <h3 className="text-sm font-semibold mb-3">Scraper Configuration</h3>
              <div className="flex flex-col space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Pages to Scrape (1-41)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="41"
                      value={maxPages}
                      onChange={(e) => setMaxPages(parseInt(e.target.value))}
                      disabled={status === 'running'}
                      className="flex-grow"
                    />
                    <div className="w-16 flex items-center">
                      <input
                        type="number"
                        min="1"
                        max="41"
                        value={maxPages}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (value > 0 && value <= 41) {
                            setMaxPages(value);
                          }
                        }}
                        disabled={status === 'running'}
                        className="w-16 border rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {maxPages === 1 ? 'Scraping 1 page (approximately 26 festivals)' : 
                     maxPages === 41 ? 'Scraping all pages (approximately 900+ festivals)' : 
                     `Scraping ${maxPages} pages (approximately ${maxPages * 24} festivals)`}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scraper Implementation
                  </label>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input 
                        type="radio" 
                        value="inline" 
                        checked={endpointType === 'inline'} 
                        onChange={() => setEndpointType('inline')}
                        disabled={status === 'running'}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Inline (Puppeteer - Docker compatible)</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input 
                        type="radio" 
                        value="run" 
                        checked={endpointType === 'run'} 
                        onChange={() => setEndpointType('run')}
                        disabled={status === 'running'}
                        className="form-radio h-4 w-4 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Run (Playwright - Local only)</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {endpointType === 'inline' 
                      ? 'Inline implementation works in Docker and uses Puppeteer for web scraping.' 
                      : 'Run implementation uses Playwright and works best in local development.'}
                  </p>
                </div>
              </div>
            </div>
            
            {status === 'success' && result && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="font-medium">Success!</p>
                </div>
                <p className="mt-2">
                  Successfully scraped {result.festivalCount || '?'} festivals from EBLive.nl.
                  {result.timeElapsed && ` Time elapsed: ${result.timeElapsed}`}
                </p>
                {result.lastRun && (
                  <p className="mt-1 text-sm">
                    Last run: {new Date(result.lastRun).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            
            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="font-medium">Error</p>
                </div>
                <p className="mt-2">
                  Failed to run the scraper. {result?.error || 'Check the logs for details.'}
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 flex space-x-2">
            <button
              onClick={runScraper}
              disabled={status === 'running'}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-white ${
                status === 'running' 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {status === 'running' ? 'Running...' : 'Run Scraper'}
            </button>
            
            {status === 'success' && (
              <button
                onClick={uploadToSupabase}
                disabled={uploadStatus === 'uploading'}
                className={`flex-1 py-2 px-4 rounded-md font-medium text-white ${
                  uploadStatus === 'uploading' 
                    ? 'bg-purple-400 cursor-not-allowed' 
                    : uploadStatus === 'success'
                      ? 'bg-green-600 hover:bg-green-700'
                      : uploadStatus === 'error'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {uploadStatus === 'uploading' 
                  ? 'Uploading...' 
                  : uploadStatus === 'success'
                    ? 'Uploaded to Supabase'
                    : uploadStatus === 'error'
                      ? 'Retry Upload'
                      : 'Upload to Supabase'}
              </button>
            )}
          </div>
          
          {uploadStatus === 'success' && uploadResult && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-800 rounded-md p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="font-medium">Database Upload Successful!</p>
              </div>
              <p className="mt-2">
                Added {uploadResult.count} new festivals to the database.
                {uploadResult.alreadyExisted > 0 && ` ${uploadResult.alreadyExisted} festivals already existed.`}
              </p>
            </div>
          )}
          
          {uploadStatus === 'error' && uploadResult && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-800 rounded-md p-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="font-medium">Database Upload Failed</p>
              </div>
              <p className="mt-2">
                Error: {typeof uploadResult.error === 'object' ? JSON.stringify(uploadResult.error) : uploadResult.error || 'Unknown error'}
                {uploadResult.details && ` (${uploadResult.details})`}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex border-b">
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'logs' ? 'bg-gray-100 border-b-2 border-blue-500' : 'hover:bg-gray-50'}`}
              onClick={() => setActiveTab('logs')}
            >
              Logs
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'data' ? 'bg-gray-100 border-b-2 border-blue-500' : 'hover:bg-gray-50'}`}
              onClick={() => setActiveTab('data')}
            >
              Festival Data {festivals.length > 0 && `(${festivals.length})`}
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'info' ? 'bg-gray-100 border-b-2 border-blue-500' : 'hover:bg-gray-50'}`}
              onClick={() => setActiveTab('info')}
            >
              Information
            </button>
          </div>
          
          {activeTab === 'logs' && (
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Execution Logs</h3>
                <p className="text-gray-600">
                  Real-time logs from the scraper execution
                </p>
              </div>
              <div className="h-64 overflow-y-auto bg-gray-50 p-4 rounded-md">
                <pre className="text-sm font-mono">
                  {logs.length === 0 ? 
                    'No logs yet. Run the scraper to see logs.' : 
                    logs.map((log, index) => (
                      <div key={index} className="pb-1">{log}</div>
                    ))
                  }
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="p-6">
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Scraped Festival Data</h3>
                  <p className="text-gray-600">
                    {loading ? 'Loading data...' : 
                     festivals.length ? `Showing ${festivals.length} festivals from the scraper` : 
                     'No data yet. Run the scraper to see results.'}
                  </p>
                </div>
                {festivals.length > 0 && (
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => fetchLatestFestivals()}
                      className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                    >
                      Refresh Data
                    </button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">
                    Loading festival data...
                  </div>
                ) : festivals.length > 0 ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th 
                          className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => {
                            if (sortField === 'name') {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('name');
                              setSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Name
                            {sortField === 'name' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => {
                            if (sortField === 'location') {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('location');
                              setSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Location
                            {sortField === 'location' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => {
                            if (sortField === 'dates') {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('dates');
                              setSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Dates
                            {sortField === 'dates' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Edition
                        </th>
                        <th 
                          className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => {
                            if (sortField === 'startDate') {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('startDate');
                              setSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Start Date
                            {sortField === 'startDate' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => {
                            if (sortField === 'endDate') {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('endDate');
                              setSortDirection('asc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            End Date
                            {sortField === 'endDate' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {[...festivals]
                        .sort((a, b) => {
                          const aValue = a[sortField] || '';
                          const bValue = b[sortField] || '';
                          
                          if (sortDirection === 'asc') {
                            return aValue > bValue ? 1 : -1;
                          } else {
                            return aValue < bValue ? 1 : -1;
                          }
                        })
                        .map((festival) => (
                          <tr key={festival.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm font-medium">
                              <a 
                                href={festival.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {festival.name}
                              </a>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700">{festival.location}</td>
                            <td className="py-3 px-4 text-sm text-gray-700">{festival.dates}</td>
                            <td className="py-3 px-4 text-sm text-gray-700">{festival.edition || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-700">
                              {festival.startDate ? new Date(festival.startDate).toLocaleDateString() : '-'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700">
                              {festival.endDate ? new Date(festival.endDate).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={6} className="py-3 px-4 text-sm text-gray-500">
                          Total: {festivals.length} festivals
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="text-center py-10 px-4 bg-gray-50">
                    <p className="text-gray-500 mb-4">No festival data available yet.</p>
                    <p className="text-sm text-gray-400">Run the scraper to collect festival data from EBLive.nl</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'info' && (
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Scraper Information</h3>
                <p className="text-gray-600">
                  Details about the EBLive 2.0 scraper implementation
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold">Overview</h4>
                  <p className="text-gray-600">
                    The EBLive 2.0 scraper is an upgraded implementation that extracts festival data from eblive.nl.
                    It uses Playwright to interact with the website and extract all available festival information.
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold">Features</h4>
                  <ul className="list-disc pl-5 text-gray-600">
                    <li>Robust error handling and retry mechanism</li>
                    <li>Comprehensive logging for easy debugging</li>
                    <li>Efficient deduplication of festival data</li>
                    <li>Handles pagination to extract all festivals (900+)</li>
                    <li>Parses and normalizes Dutch date formats</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold">Technology</h4>
                  <p className="text-gray-600">
                    Built with Playwright, TypeScript, and Winston for logging. Running in a Docker container 
                    for consistent execution environment.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 