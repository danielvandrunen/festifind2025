// @ts-nocheck
// Force ESM mode

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Helper function to validate and normalize festival data
function validateAndNormalizeFestivalData(data) {
  // If data is an object with a festivals array, extract that array
  if (data && !Array.isArray(data) && data.festivals && Array.isArray(data.festivals)) {
    return data.festivals;
  }
  
  // If data is already an array, return it
  if (Array.isArray(data)) {
    return data;
  }
  
  // Otherwise return an empty array
  return [];
}

// Helper function to find the most recent valid JSON file in a directory
async function findLatestFile(directory, pattern = 'festivalinfo_') {
  try {
    console.log(`Finding latest file in ${directory} matching pattern: ${pattern}`);
    
    // Get all files in directory
    const allFiles = fs.readdirSync(directory);
    console.log(`Found ${allFiles.length} total files in directory`);

    // Also check the festivalinfo subdirectory if it exists
    const festivalinfoDir = path.join(directory, 'festivalinfo');
    let festivalinfoFiles = [];
    if (fs.existsSync(festivalinfoDir)) {
      festivalinfoFiles = fs.readdirSync(festivalinfoDir)
        .map(filename => ({
          name: filename,
          path: path.join(festivalinfoDir, filename),
          inSubdir: true
        }));
      console.log(`Found ${festivalinfoFiles.length} files in festivalinfo subdirectory`);
    }

    // Combine files from both directories
    const combinedFiles = [
      ...allFiles.map(filename => ({
        name: filename,
        path: path.join(directory, filename),
        inSubdir: false
      })),
      ...festivalinfoFiles
    ];
    
    // First look for real scrape files that include festival count in the name
    const filesWithCounts = combinedFiles
      .filter(file => 
        file.name.endsWith('.json') && 
        file.name.includes(pattern) && 
        !file.name.includes('_mock_') && 
        !file.name.includes('_metrics_') &&
        file.name.includes('festivals')
      )
      .map(file => {
        // Extract festival count from filename
        const countMatch = file.name.match(/(\d+)festivals\.json$/);
        const festivalCount = countMatch ? parseInt(countMatch[1], 10) : 0;
        
        try {
          const stats = fs.statSync(file.path);
          return { 
            name: file.name, 
            path: file.path,
            mtime: stats.mtime.getTime(),
            festivalCount,
            type: 'real',
            inSubdir: file.inSubdir
          };
        } catch (err) {
          console.warn(`Error getting stats for ${file.name}:`, err);
          return null;
        }
      })
      .filter(Boolean);
      
    console.log(`Found ${filesWithCounts.length} files with festival counts in filename`);
    
    // Find regular real data files (older format without counts in name)
    const regularFiles = combinedFiles
      .filter(file => 
        file.name.endsWith('.json') && 
        file.name.includes(pattern) && 
        !file.name.includes('_mock_') && 
        !file.name.includes('_metrics_') &&
        !file.name.includes('festivals.json')
      )
      .map(file => {
        try {
          const stats = fs.statSync(file.path);
          return { 
            name: file.name, 
            path: file.path,
            mtime: stats.mtime.getTime(),
            festivalCount: 0, // Unknown count
            type: 'real',
            inSubdir: file.inSubdir
          };
        } catch (err) {
          console.warn(`Error getting stats for ${file.name}:`, err);
          return null;
        }
      })
      .filter(Boolean);
      
    console.log(`Found ${regularFiles.length} regular real data files`);
    
    // Combine all real files
    const allRealFiles = [...filesWithCounts, ...regularFiles];
    
    // Prioritize files with more festivals, then by modification time
    allRealFiles.sort((a, b) => {
      // First prioritize files with known festival counts
      if (a.festivalCount && !b.festivalCount) return -1;
      if (!a.festivalCount && b.festivalCount) return 1;
      
      // Then prioritize by festival count (higher is better)
      if (a.festivalCount !== b.festivalCount) {
        return b.festivalCount - a.festivalCount;
      }
      
      // Finally sort by modification time
      return b.mtime - a.mtime;
    });
    
    console.log(`Combined ${allRealFiles.length} real data files, sorted by festival count and time`);
    
    // If we have real files, return the best one
    if (allRealFiles.length > 0) {
      const bestFile = allRealFiles[0];
      console.log(`Selected best real file: ${bestFile.name} with ${bestFile.festivalCount || 'unknown'} festivals, in subdirectory: ${bestFile.inSubdir}`);
      // If file is in subdirectory, return the relative path
      return bestFile.inSubdir ? `festivalinfo/${bestFile.name}` : bestFile.name;
    }
    
    // If no real files, look for mock files as fallback
    console.log('No real data files found, looking for mock files...');
    const mockFiles = combinedFiles
      .filter(file => 
        file.name.endsWith('.json') && 
        file.name.includes(pattern) && 
        file.name.includes('_mock_')
      )
      .map(file => {
        try {
          const stats = fs.statSync(file.path);
          return { 
            name: file.name, 
            path: file.path,
            mtime: stats.mtime.getTime(),
            type: 'mock',
            inSubdir: file.inSubdir
          };
        } catch (err) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);
    
    console.log(`Found ${mockFiles.length} mock files`);
    
    if (mockFiles.length > 0) {
      console.log(`Using mock file as fallback: ${mockFiles[0].name}, in subdirectory: ${mockFiles[0].inSubdir}`);
      // If file is in subdirectory, return the relative path
      return mockFiles[0].inSubdir ? `festivalinfo/${mockFiles[0].name}` : mockFiles[0].name;
    }
    
    console.log('No festival data files found');
    return null;
  } catch (error) {
    console.error('Error finding latest file:', error);
    return null;
  }
}

export async function GET(request) {
  try {
    console.log("========== FESTIVALINFO DATA API CALLED ==========");
    
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    
    console.log(`Request params: file=${file}, page=${page}, limit=${limit}, search=${search}`);
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Define data directory
    const dataDir = path.join(process.cwd(), 'data');
    console.log(`Looking for data in: ${dataDir}`);
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Debug: List all files in the data directory
    try {
      const allFilesInDir = fs.readdirSync(dataDir);
      console.log(`All files in data directory (${allFilesInDir.length} files):`, JSON.stringify(allFilesInDir.slice(0, 10)));
      
      // Check festivalinfo subdirectory as well
      const festivalinfoDir = path.join(dataDir, 'festivalinfo');
      if (fs.existsSync(festivalinfoDir)) {
        console.log(`Festivalinfo subdirectory exists: ${festivalinfoDir}`);
        try {
          const festivalinfoFiles = fs.readdirSync(festivalinfoDir);
          console.log(`Files in festivalinfo subdirectory (${festivalinfoFiles.length} files):`, JSON.stringify(festivalinfoFiles));
        } catch (err) {
          console.error('Error listing festivalinfo subdirectory:', err);
        }
      } else {
        console.log(`Festivalinfo subdirectory does not exist: ${festivalinfoDir}`);
      }
    } catch (err) {
      console.error('Error listing all files in data directory:', err);
    }
    
    // Get the filename to read
    let filename;
    let fileSelectMethod = 'specified'; // Track how the file was selected for debugging
    let fileType = 'unknown';
    
    if (file) {
      // If a specific file is requested, use that
      filename = path.join(dataDir, file);
      fileSelectMethod = 'explicit';
      
      // Determine file type
      if (file.includes('_mock_')) {
        fileType = 'mock';
      } else if (file.includes('_metrics_')) {
        fileType = 'metrics';
      } else {
        fileType = 'real';
      }
    } else {
      // Otherwise find the most recent file
      const latestFile = await findLatestFile(dataDir);
      fileSelectMethod = 'automatic';
      
      if (!latestFile) {
        console.error('No festival data files found in', dataDir);
        
        // List directory contents to help diagnose issues
        try {
          const allFiles = fs.readdirSync(dataDir);
          console.log('All files in data directory:', allFiles);
        } catch (err) {
          console.error('Error listing directory:', err);
        }
        
        return NextResponse.json({ 
          success: false, 
          error: 'No festival data files found. Run the scraper first to generate data.',
          dataDir: dataDir,
          fileSelectMethod
        }, { status: 404 });
      }
      
      filename = path.join(dataDir, latestFile);
      
      // Determine file type
      if (latestFile.includes('_mock_')) {
        fileType = 'mock';
      } else if (latestFile.includes('_metrics_')) {
        fileType = 'metrics';
      } else {
        fileType = 'real';
      }
    }
    
    // Check if file exists
    if (!fs.existsSync(filename)) {
      return NextResponse.json({ 
        success: false, 
        error: `File not found: ${path.basename(filename)}. The requested data file does not exist.`,
        fileSelectMethod
      }, { status: 404 });
    }
    
    // Read the file
    let fileData;
    try {
      fileData = fs.readFileSync(filename, 'utf8');
    } catch (error) {
      console.error(`Error reading file ${filename}:`, error);
      return NextResponse.json({ 
        success: false, 
        error: `Error reading file: ${error.message}`, 
        fileSelectMethod
      }, { status: 500 });
    }
    
    // Parse the file data and ensure it's an array
    let data;
    try {
      data = JSON.parse(fileData);
      
      // Validate and normalize the data structure
      data = validateAndNormalizeFestivalData(data);
    } catch (error) {
      console.error('Error parsing JSON data:', error);
      // Check if the file contains any content
      const preview = fileData.slice(0, 100).trim();
      const message = preview.length > 0 
        ? `Failed to parse JSON data. File starts with: "${preview}..."` 
        : 'Failed to parse JSON data. File appears to be empty.';
        
      return NextResponse.json({ 
        success: false, 
        error: message,
        fileSelectMethod
      }, { status: 500 });
    }
    
    // Filter data if search parameter is provided
    let filteredData = data;
    if (search && filteredData.length > 0) {
      const searchLower = search.toLowerCase();
      filteredData = data.filter(item => {
        return (
          (item.name && item.name.toLowerCase().includes(searchLower)) ||
          (item.location && item.location.toLowerCase().includes(searchLower)) ||
          (item.city && item.city.toLowerCase().includes(searchLower)) ||
          (item.country && item.country.toLowerCase().includes(searchLower))
        );
      });
    }
    
    // Ensure filteredData is an array before using slice
    if (!Array.isArray(filteredData)) {
      console.error('Filtered data is not an array:', typeof filteredData);
      filteredData = [];
    }
    
    // Get total count for pagination
    const total = filteredData.length;
    
    // Paginate the data
    const paginatedData = filteredData.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      data: paginatedData,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      file: path.basename(filename),
      fileSelectMethod,
      fileType,
      isMockData: fileType === 'mock'
    });
  } catch (error) {
    console.error('Error fetching festival data:', error);
    return NextResponse.json({ 
      success: false, 
      error: `Server error: ${error.message}` 
    }, { status: 500 });
  }
} 