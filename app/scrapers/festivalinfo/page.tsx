'use client';

import React, { useState, useEffect } from 'react';
import os from 'os';
import DataPanel from '../../components/scrapers/festivalinfo/DataPanel';

export default function FestivalInfoScraperPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [maxPages, setMaxPages] = useState<number>(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<any>(null);
  
  // Data tab state
  const [festivalData, setFestivalData] = useState<any[]>([]);
  const [dataFiles, setDataFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalFestivals, setTotalFestivals] = useState(0);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  
  // Docker test state
  const [dockerStatus, setDockerStatus] = useState<any>(null);
  const [dockerTesting, setDockerTesting] = useState(false);

  // Function to run the scraper
  const runScraper = async () => {
    try {
      setIsRunning(true);
      setError(null);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Starting scraper with maxPages=${maxPages} (0 = all pages)...`]);

      const response = await fetch('/api/scrapers/festivalinfo/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxPages }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setResult(data);
        
        // Split logs by newline and add to logs state
        if (data.logs) {
          const logLines = data.logs.split('\n').filter(Boolean);
          setLogs((prev) => [...prev, ...logLines]);
        }
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Scraper completed successfully!`]);
        
        // Clear cache of previous data
        setFestivalData([]);
        
        // Give file system a moment to catch up then refresh data files
        // Using a longer delay to ensure file system operations complete
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Waiting for file system to update before loading data...`]);
        
        // First delay to ensure file is written to disk
        setTimeout(() => {
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] First file system check...`]);
          
          // Second delay to give more time for Docker container to finish and file operations to complete
          setTimeout(() => {
            setLogs((prev) => [...prev, `[${new Date().toISOString()}] Final file system check, loading data...`]);
            fetchDataFiles();
            handleTabClick("data"); // Switch to data tab to show results
            setLogs((prev) => [...prev, `[${new Date().toISOString()}] Data files refreshed.`]);
          }, 5000); // 5 second final delay
          
        }, 3000); // 3 second initial delay
      } else {
        setError(data.error || 'Failed to run scraper');
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Error: ${data.error || 'Unknown error'}`]);
        
        // Add more detailed error information if available
        if (data.message) {
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] Message: ${data.message}`]);
        }
        if (data.details) {
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] Details: ${data.details}`]);
        }
        if (data.stderr) {
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] stderr: ${data.stderr}`]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Error: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    } finally {
      setIsRunning(false);
    }
  };

  // Function to build Docker image
  const buildDockerImage = async () => {
    try {
      setIsBuilding(true);
      setError(null);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Starting to build Docker image...`]);
      
      const response = await fetch('/api/scrapers/festivalinfo/build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setBuildResult(data);
        
        // Add build logs
        if (data.logs) {
          const logLines = data.logs.split('\n').filter(Boolean);
          setLogs((prev) => [...prev, ...logLines.map(line => `[BUILD] ${line}`)]);
        }
        
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Docker image built successfully!`]);
        if (data.images && data.images.length > 0) {
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] Available images: ${data.images.join(', ')}`]);
        }
      } else {
        setError(data.error || 'Failed to build Docker image');
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Error building Docker image: ${data.error || 'Unknown error'}`]);
        
        if (data.message) {
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] ${data.message}`]);
        }
        if (data.stdout) {
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] Build output: ${data.stdout}`]);
        }
        if (data.stderr) {
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] Build errors: ${data.stderr}`]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Error: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    } finally {
      setIsBuilding(false);
    }
  };
  
  // Function to test Docker functionality
  const testDocker = async () => {
    try {
      setDockerTesting(true);
      setDockerStatus(null);
      setError(null);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Testing Docker functionality...`]);

      const response = await fetch('/api/scrapers/festivalinfo/test');
      const data = await response.json();
      
      setDockerStatus(data);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Docker test completed.`]);
      
      if (data.error) {
        setError(data.error);
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Docker test error: ${data.error}`]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Docker test error: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    } finally {
      setDockerTesting(false);
    }
  };

  // Fetch list of available data files
  const fetchDataFiles = async () => {
    try {
      // Clear any existing data error
      setDataError(null);
      setDataLoading(true);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Fetching available data files...`]);
      
      const response = await fetch('/api/scrapers/festivalinfo/files');
      const data = await response.json();
      
      if (response.ok && data.success) {
        if (data.files && data.files.length > 0) {
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] Found ${data.files.length} data files.`]);
          setDataFiles(data.files);
          
          // Filter out mock files and metrics files to find the real scrape results
          const realFilesOnly = data.files.filter(file => 
            file.name.includes('festivalinfo_') && 
            !file.name.includes('_mock_') && 
            !file.name.includes('_metrics_')
          );
          
          // The most recent real scrape file (regardless of festival count)
          const recentRealFiles = realFilesOnly.slice(0, 5); // Get the 5 most recent real scrape files
          
          let fileToLoad: any = null;
          
          // If we have real scrape files, prioritize those
          if (recentRealFiles.length > 0) {
            // Choose the most recent valid file with festivals
            const validRealFiles = recentRealFiles.filter(file => file.isValid && file.festivalCount > 0);
            
            if (validRealFiles.length > 0) {
              fileToLoad = validRealFiles[0]; // Most recent valid real file
              setLogs((prev) => [...prev, `[${new Date().toISOString()}] Selected most recent real scrape file: ${fileToLoad.name} with ${fileToLoad.festivalCount} festivals`]);
            } else {
              fileToLoad = recentRealFiles[0]; // Fall back to most recent even if not validated
              setLogs((prev) => [...prev, `[${new Date().toISOString()}] Selected most recent real scrape file (unvalidated): ${fileToLoad.name}`]);
            }
          } else {
            // Fall back to looking at all files including mocks if no real files exist
            // Look for most recent files first, prioritizing valid files
            const recentFiles = data.files.slice(0, 5); // Check the 5 most recent files
            const validFiles = recentFiles.filter(file => file.isValid);
            
            if (validFiles.length > 0) {
              fileToLoad = validFiles[0];
              setLogs((prev) => [...prev, `[${new Date().toISOString()}] No real scrape files found. Selected most recent valid file: ${fileToLoad.name}`]);
            } else if (recentFiles.length > 0) {
              fileToLoad = recentFiles[0];
              setLogs((prev) => [...prev, `[${new Date().toISOString()}] No valid files found, using most recent: ${fileToLoad.name}`]);
            }
          }
          
          if (fileToLoad) {
            setSelectedFile(fileToLoad.name);
            
            // Force data reload even if same file
            setLogs((prev) => [...prev, `[${new Date().toISOString()}] Loading festival data from ${fileToLoad.name}...`]);
            fetchFestivalData(fileToLoad.name, 1, '');
          } else {
            setFestivalData([]);
            setDataError('No valid festival data files found. Run the scraper to collect data.');
          }
        } else {
          // No data files available
          setDataFiles([]);
          setSelectedFile(null);
          setFestivalData([]);
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] No data files found. Run the scraper to collect data.`]);
          setDataError('No data files available. Run the scraper to collect data.');
        }
      } else {
        setDataError(data.error || 'Failed to load data files');
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Error: ${data.error || 'Failed to load data files'}`]);
        
        // Add detailed error info if available
        if (data.stack) {
          console.error('File listing error:', data.stack);
        }
      }
    } catch (error) {
      console.error('Error fetching data files:', error);
      setDataError('Failed to load data files. Please check the server logs for details.');
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Error: Failed to load data files - ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setDataLoading(false);
    }
  };
  
  // Fetch festival data from file
  const fetchFestivalData = async (file = selectedFile, page = currentPage, query = searchQuery) => {
    if (!file) return;
    
    setDataLoading(true);
    setDataError(null);
    setLogs((prev) => [...prev, `[${new Date().toISOString()}] Loading festival data from ${file}...`]);
    
    try {
      const url = new URL('/api/scrapers/festivalinfo/data', window.location.origin);
      url.searchParams.append('file', file);
      url.searchParams.append('page', page.toString());
      url.searchParams.append('limit', pageSize.toString());
      
      if (query) {
        url.searchParams.append('search', query);
      }
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (response.ok && data.success) {
        if (data.data && data.data.length > 0) {
          setFestivalData(data.data);
          setTotalPages(data.pagination.pages);
          setTotalFestivals(data.pagination.total);
          setCurrentPage(data.pagination.page);
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] Successfully loaded ${data.pagination.total} festivals.`]);
        } else {
          setFestivalData([]);
          setLogs((prev) => [...prev, `[${new Date().toISOString()}] No festival data found in the file.`]);
          setDataError('No festival data found in the selected file.');
        }
      } else {
        setDataError(data.error || 'Failed to fetch festival data');
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Error: ${data.error || 'Failed to fetch festival data'}`]);
      }
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Unknown error');
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Error loading data: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    } finally {
      setDataLoading(false);
    }
  };
  
  // Handle search
  const handleSearch = () => {
    setCurrentPage(1); // Reset to first page on new search
    fetchFestivalData(selectedFile, 1, searchQuery);
  };
  
  // Handle search input key press
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  // Handle pagination
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    fetchFestivalData(selectedFile, page, searchQuery);
  };
  
  // Load data files on component mount
  useEffect(() => {
    fetchDataFiles();
  }, []);
  
  // Handle switching tabs
  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    
    // If switching to data tab, refresh data files to get the latest
    if (tab === "data") {
      fetchDataFiles();
    }
  };

  // Function to clean up old data files
  const cleanupDataFiles = async () => {
    try {
      setIsCleaningUp(true);
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Cleaning up old data files...`]);
      
      const response = await fetch('/api/scrapers/festivalinfo/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keepCount: 5 }), // Keep 5 most recent files
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Cleanup completed. Deleted ${data.deleted.length} old files.`]);
        // Refresh the file list
        fetchDataFiles();
      } else {
        setLogs((prev) => [...prev, `[${new Date().toISOString()}] Cleanup failed: ${data.error || 'Unknown error'}`]);
      }
    } catch (error) {
      setLogs((prev) => [...prev, `[${new Date().toISOString()}] Cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">FestivalInfo.nl Scraper</h1>
        <div className="px-3 py-1 border rounded-full text-sm">Isolated Scraper</div>
      </div>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Isolated Container</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                This scraper runs in a completely isolated Docker container with its own database schema.
                It stores data in the <code className="bg-yellow-100 px-1 rounded">festival_info</code> schema to prevent cross-contamination.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <ul className="flex border-b">
          <li className="-mb-px mr-1">
            <a 
              className={`inline-block border-l border-t border-r rounded-t py-2 px-4 font-semibold ${activeTab === "overview" ? "bg-white text-blue-700" : "bg-gray-200 text-blue-500 hover:text-blue-800"}`} 
              href="#overview"
              onClick={() => handleTabClick("overview")}
            >
              Overview
            </a>
          </li>
          <li className="mr-1">
            <a 
              className={`inline-block border-l border-t border-r rounded-t py-2 px-4 font-semibold ${activeTab === "data" ? "bg-white text-blue-700" : "bg-gray-200 text-blue-500 hover:text-blue-800"}`} 
              href="#data"
              onClick={() => handleTabClick("data")}
            >
              Data
            </a>
          </li>
          <li className="mr-1">
            <a 
              className={`inline-block border-l border-t border-r rounded-t py-2 px-4 font-semibold ${activeTab === "logs" ? "bg-white text-blue-700" : "bg-gray-200 text-blue-500 hover:text-blue-800"}`} 
              href="#logs"
              onClick={() => handleTabClick("logs")}
            >
              Logs
            </a>
          </li>
          <li className="mr-1">
            <a 
              className={`inline-block border-l border-t border-r rounded-t py-2 px-4 font-semibold ${activeTab === "settings" ? "bg-white text-blue-700" : "bg-gray-200 text-blue-500 hover:text-blue-800"}`} 
              href="#settings"
              onClick={() => handleTabClick("settings")}
            >
              Settings
            </a>
          </li>
        </ul>
      </div>
      
      {/* Overview Tab */}
      <div id="overview" className={`space-y-4 ${activeTab !== "overview" ? "hidden" : ""}`}>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Scraper Information</h2>
          <p className="text-gray-600 mb-4">Key details about the FestivalInfo.nl scraper</p>
          
          {error && error.includes('Docker') && (
            <div className="mb-6 p-4 border-l-4 border-yellow-400 bg-yellow-50">
              <h3 className="font-semibold text-yellow-800">Docker Setup Required</h3>
              <p className="mb-2 text-yellow-700">The application will automatically use a temporary directory as a safe location for Docker file sharing, but you need to add it to Docker's settings:</p>
              <div className="text-yellow-700 mb-2">
                <strong>File Sharing Permission:</strong> If you see a "Mounts denied" error, follow these steps:
              </div>
              <ol className="list-decimal list-inside text-yellow-700 space-y-1">
                <li>Open Docker Desktop</li> 
                <li>Go to Settings → Resources → File Sharing</li>
                <li>Click + and add: <code className="bg-yellow-100 px-1 rounded font-mono">/tmp</code></li>
                <li>Click "Apply & Restart"</li>
                <li>Try running the scraper again</li>
              </ol>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-500">Status</h3>
              <p className="font-semibold text-lg">
                {isRunning ? 'Running...' : (result ? 'Ready (Last run successful)' : 'Ready to Run')}
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-500">Last Run</h3>
              <p className="font-semibold text-lg">
                {result ? new Date().toLocaleString() : 'Never'}
              </p>
            </div>
            <div>
              <h3 className="font-medium text-gray-500">Docker Container</h3>
              <p className="font-semibold text-lg">festivalinfo-scraper</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-500">Database Schema</h3>
              <p className="font-semibold text-lg">festival_info</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 mt-4">
            <div className="flex items-center mb-4">
              <label htmlFor="maxPages" className="mr-2 text-gray-700">Pages to Scrape:</label>
              <select 
                id="maxPages"
                className="border rounded p-2 mr-2"
                value={maxPages}
                onChange={(e) => setMaxPages(parseInt(e.target.value))}
                disabled={isRunning || isBuilding}
              >
                <option value="0">All Pages (Full Scrape)</option>
                <option value="1">1 Page (~25 festivals)</option>
                <option value="2">2 Pages (~50 festivals)</option>
                <option value="5">5 Pages (~125 festivals)</option>
                <option value="10">10 Pages (~250 festivals)</option>
              </select>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <button 
                onClick={buildDockerImage}
                disabled={isBuilding || isRunning}
                className={`bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded ${(isBuilding || isRunning) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isBuilding ? 'Building Image...' : '1. Build Docker Image'}
              </button>
              
              <button 
                onClick={runScraper}
                disabled={isRunning || isBuilding}
                className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded ${(isRunning || isBuilding) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isRunning ? 'Running Scraper...' : '2. Run Scraper'}
              </button>
              
              <button 
                onClick={testDocker}
                disabled={dockerTesting || isBuilding || isRunning}
                className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ${(dockerTesting || isBuilding || isRunning) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {dockerTesting ? 'Testing Docker...' : 'Test Docker Setup'}
              </button>
            </div>
            
            {buildResult && (
              <div className="p-4 mb-4 bg-purple-50 border border-purple-200 rounded">
                <h3 className="font-medium text-purple-700 mb-2">Docker Image Built Successfully</h3>
                <p className="text-sm text-purple-600">Ready to run scraper with image: <span className="font-mono">{buildResult.images[0]}</span></p>
                <p className="text-sm mt-2">
                  ✅ <span className="font-medium">Next step:</span> Click the "Run Scraper" button
                </p>
              </div>
            )}
            
            <div className="p-4 mt-2 bg-gray-50 border rounded">
              <h3 className="font-medium mb-2">Fully Automated Docker Setup</h3>
              <p className="text-sm mb-2">The application now handles these steps automatically:</p>
              <ol className="list-decimal list-inside text-sm space-y-1">
                <li>Creates a temporary directory in your home folder (easier to share with Docker)</li>
                <li>Builds the Docker image if needed</li>
                <li>Runs the Docker container with proper volume mounting</li>
                <li>Copies scraped data from the temporary location to the project folder</li>
              </ol>
              <div className="mt-4 text-sm text-gray-600">
                <p><span className="font-medium">How it works:</span> Instead of trying to share your project directory with Docker (which often causes permission issues), we use a temporary directory as an intermediary location that's more likely to work with Docker's security settings.</p>
                
                <p className="mt-2"><span className="font-medium">Temporary directory:</span> <code className="bg-gray-100 px-1 rounded font-mono">/tmp/festifind_temp_data</code></p>
              </div>
              
              <div className="mt-4 border-t pt-4 border-gray-200">
                <h4 className="font-medium text-gray-700">Troubleshooting Docker Issues</h4>
                <div className="mt-2 space-y-2 text-sm">
                  <p><span className="font-semibold">Mounts denied error:</span> If you see "Mounts denied" in the logs, you need to add <code>/tmp</code> to Docker's file sharing settings.</p>
                  <p><span className="font-semibold">Docker image not found:</span> Use the "Build Docker Image" button first before running the scraper.</p>
                  <p><span className="font-semibold">For persistent issues:</span> Try restarting Docker Desktop completely.</p>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-gray-500 mt-2">
              <strong>Note:</strong> Setting <code className="bg-gray-100 px-1 rounded">maxPages=0</code> will scrape ALL pages (complete scrape).
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Most Recent Data</h2>
            <p className="text-gray-600 mb-4">Last scraped festivals</p>
            {result?.outputFile ? (
              <div>
                <p>Data saved to: <code className="bg-gray-100 px-1 rounded">{result.outputFile}</code></p>
                <div className="mt-2">
                  <a href="#data" onClick={() => handleTabClick("data")} className="text-blue-500 hover:underline">View scraped data</a>
                </div>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No data available yet</p>
            )}
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Statistics</h2>
            <p className="text-gray-600 mb-4">Scraper performance metrics</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Festivals:</span>
                <span className="font-medium">{result?.metrics?.totalFestivals || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Unique Festivals:</span>
                <span className="font-medium">{result?.metrics?.uniqueFestivals || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Duplicates:</span>
                <span className="font-medium">{result?.metrics?.duplicates || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Data Tab */}
      <div id="data" className={`space-y-4 ${activeTab !== "data" ? "hidden" : ""}`}>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Scraped Festival Data</h2>
            <div className="flex items-center gap-3">
              {selectedFile ? (
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
                  {dataFiles.find(file => file.name === selectedFile)?.festivalCount || 0} festivals from most recent scrape
                </div>
              ) : (
                <div className="text-sm text-gray-600">No data available</div>
              )}
              <button 
                onClick={() => {
                  setLogs((prev) => [...prev, `[${new Date().toISOString()}] Manually refreshing data files...`]);
                  fetchDataFiles();
                }}
                className="p-2 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded"
                title="Refresh data"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Re-add the DataPanel component */}
          <DataPanel />
          
          {/* Add mock data warning banner */}
          {selectedFile && dataFiles.find(f => f.name === selectedFile)?.isMockData && (
            <div className="w-full bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
              <p className="font-bold">Mock Data Active</p>
              <p>You are viewing test data, not actual scraper results. To see real data, run the scraper or select a file that doesn't include "mock" in the name.</p>
              {dataFiles.some(f => !f.isMockData && !f.isMetricsFile && f.festivalCount > 0) && (
                <p className="mt-2">
                  <button 
                    className="underline text-blue-600" 
                    onClick={() => {
                      // Find the first non-mock data file with festivals
                      const realFile = dataFiles.find(f => !f.isMockData && !f.isMetricsFile && f.festivalCount > 0);
                      if (realFile) {
                        setSelectedFile(realFile.name);
                        fetchFestivalData(realFile.name, 1, searchQuery);
                      }
                    }}
                  >
                    Click here to load real scraper data instead
                  </button>
                </p>
              )}
            </div>
          )}
          
          {/* Add file selector dropdown */}
          {dataFiles.length > 0 && (
            <div className="mb-4">
              <label htmlFor="fileSelector" className="block text-sm font-medium text-gray-700 mb-1">
                Select Data File:
              </label>
              <div className="flex gap-2">
                <select
                  id="fileSelector"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={selectedFile || ''}
                  onChange={(e) => {
                    const newFile = e.target.value;
                    setSelectedFile(newFile);
                    if (newFile) {
                      fetchFestivalData(newFile, 1, searchQuery);
                    }
                  }}
                >
                  <option value="">Select a file...</option>
                  
                  {/* Group real scrape files first */}
                  <optgroup label="Real Scrape Results">
                    {dataFiles.filter(file => !file.isMockData && !file.isMetricsFile).map((file) => (
                      <option key={file.name} value={file.name}>
                        {file.name.replace('festivalinfo_', '')} ({file.festivalCount} festivals)
                      </option>
                    ))}
                  </optgroup>
                  
                  {/* Show mock data files separately */}
                  <optgroup label="Mock Test Data">
                    {dataFiles.filter(file => file.isMockData).map((file) => (
                      <option key={file.name} value={file.name}>
                        {file.name.replace('festivalinfo_mock_', '')} ({file.festivalCount} mock festivals)
                      </option>
                    ))}
                  </optgroup>
                  
                  {/* Show metrics files separately */}
                  <optgroup label="Metrics Files (No Festival Data)">
                    {dataFiles.filter(file => file.isMetricsFile).map((file) => (
                      <option key={file.name} value={file.name}>
                        {file.name.replace('festivalinfo_metrics_', '')}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <button
                  onClick={() => {
                    if (selectedFile) {
                      fetchFestivalData(selectedFile, 1, searchQuery);
                    }
                  }}
                  disabled={!selectedFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
                >
                  Load Data
                </button>
              </div>
              
              {/* Data management tools */}
              <div className="mt-3 flex items-center space-x-2">
                <span className="text-sm text-gray-500">{dataFiles.length} files found</span>
                <button
                  onClick={fetchDataFiles}
                  className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  disabled={dataLoading}
                >
                  Refresh Files
                </button>
                <button
                  onClick={cleanupDataFiles}
                  className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                  disabled={isCleaningUp || dataLoading}
                >
                  {isCleaningUp ? 'Cleaning...' : 'Clean Up Old Files'}
                </button>
              </div>
            </div>
          )}
          
          {/* Global notification banner about current data */}
          {selectedFile && (
            <div className="w-full">
              {dataFiles.find(f => f.name === selectedFile)?.isMockData ? (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
                  <p className="font-bold">Mock Data Active</p>
                  <p>You are viewing test data, not actual scraper results. To see real data, run the scraper or select a real data file above.</p>
                </div>
              ) : dataFiles.find(f => f.name === selectedFile)?.festivalCount > 500 ? (
                <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
                  <p className="font-bold">Full Scrape Data</p>
                  <p>Viewing {dataFiles.find(f => f.name === selectedFile)?.festivalCount} festivals from complete scraper results.</p>
                </div>
              ) : dataFiles.find(f => f.name === selectedFile)?.festivalCount > 0 ? (
                <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
                  <p className="font-bold">Partial Scrape Data</p>
                  <p>Viewing {dataFiles.find(f => f.name === selectedFile)?.festivalCount} festivals from a limited scraper run.</p>
                </div>
              ) : null}
            </div>
          )}
          
          {/* Search box */}
          <div className="flex-grow">
            <input
              type="text"
              placeholder="Search festivals..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && selectedFile) {
                  fetchFestivalData(selectedFile, 1, searchQuery);
                }
              }}
            />
          </div>
          <button
            onClick={() => {
              if (selectedFile) {
                fetchFestivalData(selectedFile, 1, searchQuery);
              }
            }}
            disabled={!selectedFile}
            className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
          >
            Search
          </button>
          <button
            onClick={() => {
              setSearchQuery('');
              if (selectedFile) {
                fetchFestivalData(selectedFile, 1, '');
              }
            }}
            disabled={!selectedFile || !searchQuery}
            className="px-4 py-2 bg-gray-600 text-white rounded-md disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>
      
      {/* Logs section */}
      <div id="logs" className={`mt-6 bg-white shadow rounded-lg p-6 ${activeTab !== "logs" ? "hidden" : ""}`}>
        <h2 className="text-xl font-semibold mb-2">Scraper Logs</h2>
        <p className="text-gray-600 mb-4">Output from the scraper</p>
        <div className="bg-black text-green-400 font-mono p-4 rounded-md h-96 overflow-auto">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="whitespace-pre-line">{log}</div>
            ))
          ) : (
            <p>No logs available. Run the scraper to see output.</p>
          )}
        </div>
      </div>
      
      {/* Settings section */}
      <div id="settings" className={`mt-6 bg-white shadow rounded-lg p-6 ${activeTab !== "settings" ? "hidden" : ""}`}>
        <h2 className="text-xl font-semibold mb-2">Scraper Settings</h2>
        <p className="text-gray-600 mb-4">Configure the behavior of the scraper</p>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">Environment Variables</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><code className="bg-gray-100 px-1 rounded">FESTIVALINFO_MAX_PAGES</code>: Maximum number of pages to scrape (0 = all)</li>
              <li><code className="bg-gray-100 px-1 rounded">FESTIVALINFO_DELAY</code>: Delay between page requests in ms (default: 2000)</li>
              <li><code className="bg-gray-100 px-1 rounded">FESTIVALINFO_DETAIL_DELAY</code>: Delay between festival detail requests (default: 1500)</li>
              <li><code className="bg-gray-100 px-1 rounded">LOG_LEVEL</code>: Logging verbosity (info, debug, error)</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium mb-1">Configuration Files</h3>
            <p className="text-sm">
              Core configuration is in <code className="bg-gray-100 px-1 rounded">scrapers/festivalinfo/config.js</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 