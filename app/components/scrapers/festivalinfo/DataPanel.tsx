import React, { useEffect, useState } from 'react';

interface Festival {
  id?: string;
  name: string;
  location?: {
    city?: string;
    country?: string;
  };
  city?: string;
  country?: string;
  country_code?: string;
  url?: string;
  duration?: number;
  numActs?: number;
  dateRange?: {
    current: number;
    total: number;
  };
  startDate?: string;
  endDate?: string;
}

interface DataFile {
  name: string;
  isValid: boolean;
  festivalCount: number;
  isMockData?: boolean;
  isMetricsFile?: boolean;
}

const DataPanel: React.FC = () => {
  const [fileSelection, setFileSelection] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Festival[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [dataFile, setDataFile] = useState<string>('Unknown file');
  const [isMockData, setIsMockData] = useState<boolean>(false);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [availableFiles, setAvailableFiles] = useState<DataFile[]>([]);
  const [isFilesLoading, setIsFilesLoading] = useState<boolean>(false);

  // Fetch available data files
  const fetchDataFiles = async () => {
    setIsFilesLoading(true);
    try {
      const response = await fetch('/api/scrapers/festivalinfo/files');
      if (!response.ok) {
        throw new Error('Failed to fetch data files');
      }
      const result = await response.json();
      if (result.success && result.files) {
        setAvailableFiles(result.files);
        // If no file is selected and we have files, select the first valid one
        if (!fileSelection && result.files.length > 0) {
          const validFiles = result.files.filter(f => f.isValid && !f.isMetricsFile);
          if (validFiles.length > 0) {
            setFileSelection(validFiles[0].name);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching data files:', err);
    } finally {
      setIsFilesLoading(false);
    }
  };

  // Load data files on mount
  useEffect(() => {
    fetchDataFiles();
  }, []);

  // Load festival data when fileSelection changes or refresh is triggered
  useEffect(() => {
    console.log("DataPanel component mounted or fileSelection changed");
    if (!isLoading && fileSelection) {
      console.log("Loading data (not currently loading)");
      setIsLoading(true);
      setError(null);
      
      const loadData = async () => {
        try {
          console.log(`Fetching data, fileSelection=${fileSelection}`);
          const url = fileSelection 
            ? `/api/scrapers/festivalinfo/data?file=${encodeURIComponent(fileSelection)}&page=${page}&limit=${pageSize}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`
            : `/api/scrapers/festivalinfo/data?page=${page}&limit=${pageSize}${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`;
          
          console.log(`Request URL: ${url}`);
          const response = await fetch(url);
          console.log(`Response status: ${response.status}`);
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error("API error response:", errorData);
            throw new Error(errorData.error || 'Failed to fetch festival data');
          }
          
          const result = await response.json();
          console.log(`Loaded data successfully, got ${result.data.length} festivals, total: ${result.pagination.total}`);
          setData(result.data);
          setTotalItems(result.pagination.total);
          setTotalPages(result.pagination.pages);
          setDataFile(result.file || 'Unknown file');
          setIsMockData(result.isMockData || false);
        } catch (err) {
          console.error('Error loading festival data:', err);
          setError(err instanceof Error ? err.message : 'Failed to load festival data');
        } finally {
          setIsLoading(false);
        }
      };
      
      loadData();
    }
  }, [fileSelection, page, pageSize, searchTerm, refreshTrigger]);

  // Handle search submission
  const handleSearch = () => {
    setPage(1); // Reset to page 1 for new search
    setRefreshTrigger(prev => prev + 1); // Trigger data refresh
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Generate pagination controls
  const renderPagination = () => {
    const pageNumbers: number[] = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return (
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium ${page === 1 ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages}
            className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium ${page === totalPages ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{data.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span className="font-medium">{Math.min(page * pageSize, totalItems)}</span> of{' '}
              <span className="font-medium">{totalItems}</span> results
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className={`relative inline-flex items-center rounded-l-md px-2 py-2 ${page === 1 ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              
              {pageNumbers.map(number => (
                <button
                  key={number}
                  onClick={() => handlePageChange(number)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm ${number === page ? 'bg-blue-500 text-white' : 'text-gray-900 hover:bg-gray-50'}`}
                >
                  {number}
                </button>
              ))}
              
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className={`relative inline-flex items-center rounded-r-md px-2 py-2 ${page === totalPages ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header section with file selector and search */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Festival Data</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                fetchDataFiles();
                setRefreshTrigger(prev => prev + 1);
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
        
        {/* File selector and data info */}
        <div className="mb-4">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-grow">
              <label htmlFor="fileSelector" className="block text-sm font-medium text-gray-700 mb-1">
                Data File:
              </label>
              <select
                id="fileSelector"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={fileSelection || ''}
                onChange={(e) => setFileSelection(e.target.value)}
                disabled={isFilesLoading}
              >
                <option value="">Select a file...</option>
                
                {/* Group real scrape files first */}
                {availableFiles.length > 0 && (
                  <>
                    <optgroup label="Real Scrape Results">
                      {availableFiles
                        .filter(file => !file.isMockData && !file.isMetricsFile && file.isValid)
                        .map((file) => (
                          <option key={file.name} value={file.name}>
                            {file.name.replace('festivalinfo_', '')} ({file.festivalCount} festivals)
                          </option>
                        ))}
                    </optgroup>
                    
                    {/* Show mock data files separately */}
                    {availableFiles.filter(file => file.isMockData && file.isValid).length > 0 && (
                      <optgroup label="Mock Test Data">
                        {availableFiles
                          .filter(file => file.isMockData && file.isValid)
                          .map((file) => (
                            <option key={file.name} value={file.name}>
                              {file.name.replace('festivalinfo_mock_', '')} ({file.festivalCount} mock festivals)
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
            </div>
            
            <div className="flex-grow">
              <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">
                Search:
              </label>
              <div className="flex">
                <input
                  id="searchTerm"
                  type="text"
                  className="block w-full rounded-l-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Search festivals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600"
                  onClick={handleSearch}
                >
                  Search
                </button>
              </div>
            </div>
          </div>
          
          {/* Data info banner */}
          {dataFile && (
            <div className={`p-3 rounded-md ${isMockData ? 'bg-yellow-50 text-yellow-700' : 'bg-blue-50 text-blue-700'}`}>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {isMockData ? 'Viewing mock data' : `Viewing ${totalItems} festivals`} from file: {dataFile}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {isLoading ? (
        <div className="bg-white shadow rounded-lg p-8 flex justify-center">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-8 w-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600">Loading festival data...</p>
          </div>
        </div>
      ) : data.length > 0 ? (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          {/* Data table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City/Country</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acts</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((festival, index) => (
                  <tr key={festival.id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {festival.url ? (
                          <a href={festival.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            {festival.name}
                          </a>
                        ) : (
                          festival.name
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {festival.location?.city || festival.city || 'Unknown location'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {festival.location?.country || festival.country || festival.country_code || 'Unknown country'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {festival.startDate ? new Date(festival.startDate).toLocaleDateString() : 'Not specified'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {festival.duration ? `${festival.duration} days` : 'N/A'}
                      {festival.dateRange && ` (${festival.dateRange.current}/${festival.dateRange.total})`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {festival.numActs || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {festival.url && (
                        <a href={festival.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900">
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination controls */}
          {renderPagination()}
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          {fileSelection ? 'No festival data found matching your criteria.' : 'Select a data file to view festival information.'}
        </div>
      )}
    </div>
  );
};

export default DataPanel; 