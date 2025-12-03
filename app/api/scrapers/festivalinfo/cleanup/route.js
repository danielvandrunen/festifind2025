// @ts-nocheck
// Force ESM mode

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { keepCount = 5 } = await request.json();
    
    // Get data directory
    const dataDir = path.join(process.cwd(), 'data');
    
    // Check if the directory exists
    if (!fs.existsSync(dataDir)) {
      return NextResponse.json({
        success: false,
        error: 'Data directory not found'
      }, { status: 404 });
    }
    
    // Get all files
    const files = fs.readdirSync(dataDir)
      .filter(file => file.endsWith('.json') && file.startsWith('festivalinfo_') && !file.includes('_metrics_'));
    
    console.log(`Found ${files.length} festivalinfo data files`);
    
    // Sort files by creation time (newest first)
    const sortedFiles = files.map(file => ({
      name: file,
      path: path.join(dataDir, file),
      // Extract festival count if available
      festivalCount: (() => {
        const match = file.match(/(\d+)festivals\.json$/);
        return match ? parseInt(match[1], 10) : 0;
      })(),
      time: fs.statSync(path.join(dataDir, file)).mtime.getTime()
    }))
    .sort((a, b) => {
      // First prioritize files with more festivals
      if (a.festivalCount !== b.festivalCount) {
        return b.festivalCount - a.festivalCount;
      }
      // Then sort by time
      return b.time - a.time;
    });
    
    // Keep the specified number of newest files
    const filesToKeep = sortedFiles.slice(0, keepCount);
    const filesToDelete = sortedFiles.slice(keepCount);
    
    console.log(`Keeping ${filesToKeep.length} files, deleting ${filesToDelete.length} files`);
    
    // Delete old files
    const deleted = [];
    filesToDelete.forEach(file => {
      try {
        fs.unlinkSync(file.path);
        deleted.push(file.name);
      } catch (error) {
        console.error(`Failed to delete ${file.path}:`, error);
      }
    });
    
    // Also cleanup metrics files that don't have corresponding data files
    const metricsFiles = fs.readdirSync(dataDir)
      .filter(file => file.includes('_metrics_') && file.endsWith('.json'));
    
    const orphanedMetricsFiles = metricsFiles.filter(metricsFile => {
      // Extract the timestamp from the metrics file
      const timestampMatch = metricsFile.match(/metrics_(.+)\.json$/);
      if (!timestampMatch) return false;
      
      const timestamp = timestampMatch[1];
      
      // Check if any kept data file has this timestamp
      return !filesToKeep.some(keptFile => keptFile.name.includes(timestamp));
    });
    
    console.log(`Found ${orphanedMetricsFiles.length} orphaned metrics files to delete`);
    
    // Delete orphaned metrics files
    orphanedMetricsFiles.forEach(file => {
      try {
        fs.unlinkSync(path.join(dataDir, file));
        deleted.push(file);
      } catch (error) {
        console.error(`Failed to delete ${file}:`, error);
      }
    });
    
    return NextResponse.json({
      success: true,
      deleted,
      kept: filesToKeep.map(f => f.name)
    });
  } catch (error) {
    console.error('Error cleaning up files:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
} 