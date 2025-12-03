// @ts-nocheck
// Force ESM mode

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execPromise = promisify(exec);

// Check if Docker is available and set up properly
async function ensureDockerSetup() {
  try {
    // Check if Docker is running
    const { stdout: dockerVersion } = await execPromise('docker --version');
    console.log('Docker check:', dockerVersion.trim());
    
    // Check if docker-compose is available
    const { stdout: composeVersion } = await execPromise('docker-compose --version');
    console.log('Docker Compose check:', composeVersion.trim());
    
    // Check if the festivalinfo image exists
    try {
      const { stdout: imageList } = await execPromise('docker images --format "{{.Repository}}:{{.Tag}}" | grep -i festivalinfo');
      const images = imageList.trim().split('\n').filter(Boolean);
      
      if (images.length === 0) {
        console.log('No festivalinfo Docker image found, attempting to build it');
        // Try to build the image automatically
        const { stdout: buildOutput } = await execPromise('docker-compose build festivalinfo-scraper', { timeout: 300000 });
        console.log('Docker image built successfully:', buildOutput);
      } else {
        console.log('Found existing Docker images:', images);
      }
      
      return { success: true };
    } catch (imageError) {
      console.log('Error checking for Docker images, attempting to build');
      try {
        // Try to build the image automatically
        const { stdout: buildOutput } = await execPromise('docker-compose build festivalinfo-scraper', { timeout: 300000 });
        console.log('Docker image built successfully:', buildOutput);
        return { success: true };
      } catch (buildError) {
        return { 
          success: false, 
          error: 'Failed to build Docker image: ' + buildError.message,
          details: buildError.stderr || ''
        };
      }
    }
  } catch (error) {
    return { 
      success: false, 
      error: 'Docker environment is not properly configured: ' + error.message,
      details: error.stderr || ''
    };
  }
}

export async function POST(request) {
  try {
    const { maxPages = 0 } = await request.json(); // 0 = scrape all pages
    
    console.log(`Starting festivalinfo scraper with maxPages=${maxPages}`);
    
    // Get current directory for debugging
    const currentDir = process.cwd();
    console.log('Current working directory:', currentDir);
    
    // Use home directory for temporary data storage (more likely to be shareable with Docker)
    const homeDir = os.homedir();
    // Create a path in /tmp which is guaranteed to be writable on macOS
    const tempDataDir = path.join('/tmp', 'festifind_temp_data');
    const finalDataDir = path.join(currentDir, 'data');
    const festivalinfoDir = path.join(finalDataDir, 'festivalinfo');
    
    // Ensure directories exist
    if (!fs.existsSync(tempDataDir)) {
      fs.mkdirSync(tempDataDir, { recursive: true });
      console.log(`Created temporary data directory: ${tempDataDir}`);
    }
    
    if (!fs.existsSync(finalDataDir)) {
      fs.mkdirSync(finalDataDir, { recursive: true });
      console.log(`Created final data directory: ${finalDataDir}`);
    }
    
    if (!fs.existsSync(festivalinfoDir)) {
      fs.mkdirSync(festivalinfoDir, { recursive: true });
      console.log(`Created festivalinfo data directory: ${festivalinfoDir}`);
    }
    
    // Check permissions on the temporary data directory
    try {
      const testFile = path.join(tempDataDir, '.test_write_permission');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log('Temporary data directory is writable');
    } catch (permError) {
      console.error('Temporary data directory permissions issue:', permError);
      return NextResponse.json({
        success: false,
        error: 'Cannot write to temporary data directory',
        message: 'The application does not have permission to write to the temporary data directory',
        details: permError.message
      }, { status: 500 });
    }
    
    // Ensure Docker is set up properly
    const dockerSetup = await ensureDockerSetup();
    if (!dockerSetup.success) {
      return NextResponse.json({
        success: false,
        error: dockerSetup.error,
        message: 'Docker setup failed',
        details: dockerSetup.details,
        setupCommand: 'docker-compose build festivalinfo-scraper'
      }, { status: 500 });
    }
    
    // First try with docker volume from home directory
    console.log('Running scraper with direct Docker command...');
    try {
      // Get Docker images
      const { stdout: imageList } = await execPromise('docker images --format "{{.Repository}}:{{.Tag}}" | grep -i festivalinfo');
      const images = imageList.trim().split('\n').filter(Boolean);
      
      if (images.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No festivalinfo Docker images found',
          message: 'Docker image not found. Please run: docker-compose build festivalinfo-scraper',
        }, { status: 500 });
      }
      
      // Use the first image found
      const imageName = images[0];
      console.log(`Using Docker image: ${imageName}`);
      
      // Use home directory instead of project directory for volume mount
      const tempDataDirAbsolute = path.resolve(tempDataDir);
      console.log(`Using temporary data directory: ${tempDataDirAbsolute}`);
      
      // Ensure proper permissions on temporary directory
      try {
        fs.chmodSync(tempDataDirAbsolute, 0o777);
        console.log('Set permissions on temporary directory to 777 for Docker access');
      } catch (permError) {
        console.warn('Could not set directory permissions:', permError);
      }

      const dockerCommand = `docker run --rm -v "${tempDataDirAbsolute}:/app/data" -e FESTIVALINFO_MAX_PAGES=${maxPages} ${imageName}`;
      console.log(`Executing Docker command: ${dockerCommand}`);
      
      const { stdout, stderr } = await execPromise(dockerCommand, { timeout: 900000 });
      
      // Extract metrics first to use in the filename
      const totalFestivalsMatch = stdout.match(/Total festivals found: (\d+)/);
      const uniqueFestivalsMatch = stdout.match(/Unique festivals: (\d+)/);
      const duplicatesMatch = stdout.match(/Duplicates: (\d+)/);
      
      const metrics = {
        totalFestivals: totalFestivalsMatch ? parseInt(totalFestivalsMatch[1]) : 0,
        uniqueFestivals: uniqueFestivalsMatch ? parseInt(uniqueFestivalsMatch[1]) : 0,
        duplicates: duplicatesMatch ? parseInt(duplicatesMatch[1]) : 0,
      };
      
      // Find the output file path from the logs
      const outputFileMatch = stdout.match(/Successfully saved festivals to (.+\.json)/);
      const outputFile = outputFileMatch ? outputFileMatch[1].trim() : null;
      
      if (!outputFile) {
        console.error('No output file found in scraper logs');
        return NextResponse.json({ 
          success: false,
          error: 'Scraper completed but no output file was found',
          message: 'Failed to find scraper output',
          logs: stdout
        }, { status: 500 });
      }
      
      // Copy the output file from the temporary directory to the project directory
      const outputBasename = path.basename(outputFile);
      const tempFilePath = path.join(tempDataDir, outputBasename);
      
      // Create a new filename that includes the count of festivals to make it easier to identify
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const finalFilename = `festivalinfo_${timestamp}_${metrics.uniqueFestivals}festivals.json`;
      const finalFilePath = path.join(finalDataDir, finalFilename);
      const festivalinfoFilePath = path.join(festivalinfoDir, finalFilename);
      
      if (fs.existsSync(tempFilePath)) {
        // Copy to main data directory
        fs.copyFileSync(tempFilePath, finalFilePath);
        console.log(`Copied data file from ${tempFilePath} to ${finalFilePath}`);
        
        // Also copy to festivalinfo subdirectory
        fs.copyFileSync(tempFilePath, festivalinfoFilePath);
        console.log(`Copied data file from ${tempFilePath} to ${festivalinfoFilePath}`);
        
        // Force update the modification time of the copied files to ensure they're newer than any existing files
        try {
          const now = new Date();
          fs.utimesSync(finalFilePath, now, now);
          fs.utimesSync(festivalinfoFilePath, now, now);
          console.log(`Updated file timestamps to current time: ${now.toISOString()}`);
        } catch (timeError) {
          console.warn(`Failed to update file timestamp: ${timeError.message}`);
        }
      } else {
        console.error(`Output file not found at ${tempFilePath}`);
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Scraper completed successfully using Docker',
        metrics,
        outputFile: finalFilePath,
        logs: stdout
      });
    } catch (error) {
      // If using home directory fails, try alternative mount strategies
      console.error('Direct Docker command failed:', error.message);
      
      // Try with alternative Docker volume syntax
      try {
        console.log('Trying alternative Docker volume syntax...');
        const imageName = images[0];
        // Use Docker's built-in named volume instead of host path mounting
        const altDockerCommand = `docker run --rm -v festifind_data:/app/data -e FESTIVALINFO_MAX_PAGES=${maxPages} ${imageName}`;
        console.log(`Executing alternative Docker command: ${altDockerCommand}`);
        
        const { stdout, stderr } = await execPromise(altDockerCommand, { timeout: 300000 });
        
        // Process the output
        const totalFestivalsMatch = stdout.match(/Total festivals found: (\d+)/);
        const uniqueFestivalsMatch = stdout.match(/Unique festivals: (\d+)/);
        const duplicatesMatch = stdout.match(/Duplicates: (\d+)/);
        
        const metrics = {
          totalFestivals: totalFestivalsMatch ? parseInt(totalFestivalsMatch[1]) : 0,
          uniqueFestivals: uniqueFestivalsMatch ? parseInt(uniqueFestivalsMatch[1]) : 0,
          duplicates: duplicatesMatch ? parseInt(duplicatesMatch[1]) : 0,
        };
        
        // Find the output file path from the logs
        const outputFileMatch = stdout.match(/Successfully saved festivals to (.+\.json)/);
        const outputFile = outputFileMatch ? outputFileMatch[1].trim() : null;
        
        if (!outputFile) {
          console.error('No output file found in scraper logs');
          return NextResponse.json({ 
            success: false,
            error: 'Scraper completed but no output file was found',
            message: 'Failed to find scraper output',
            logs: stdout
          }, { status: 500 });
        }
        
        // Copy the data from the named volume to our project
        // Create a temporary container to access the volume data
        const tempContainerName = 'temp-festifind-data-copy';
        const copyCommand = `docker run --name ${tempContainerName} -v festifind_data:/source -v "${finalDataDir}:/destination" --rm busybox sh -c "cp -r /source/* /destination/"`;
        console.log(`Executing data copy command: ${copyCommand}`);
        
        try {
          await execPromise(copyCommand, { timeout: 30000 });
          console.log('Data copied from Docker volume to project directory');
        } catch (copyError) {
          console.error('Failed to copy data from Docker volume:', copyError);
        }
        
        // Since we can't know the exact file name on the host, use the one reported by the scraper
        const estimatedOutputFile = path.join(finalDataDir, path.basename(outputFile));
        
        return NextResponse.json({ 
          success: true, 
          message: 'Scraper completed successfully using Docker named volume',
          metrics,
          outputFile: estimatedOutputFile,
          logs: stdout
        });
      } catch (altError) {
        // If alternative Docker method fails, try docker-compose
        console.error('Alternative Docker command failed:', altError.message);
        
        try {
          const command = `docker-compose run --rm -e FESTIVALINFO_MAX_PAGES=${maxPages} festivalinfo-scraper`;
          console.log(`Trying docker-compose: ${command}`);
          
          const { stdout, stderr } = await execPromise(command, { timeout: 300000 });
          
          // Process the output
          const totalFestivalsMatch = stdout.match(/Total festivals found: (\d+)/);
          const uniqueFestivalsMatch = stdout.match(/Unique festivals: (\d+)/);
          const duplicatesMatch = stdout.match(/Duplicates: (\d+)/);
          
          const metrics = {
            totalFestivals: totalFestivalsMatch ? parseInt(totalFestivalsMatch[1]) : 0,
            uniqueFestivals: uniqueFestivalsMatch ? parseInt(uniqueFestivalsMatch[1]) : 0,
            duplicates: duplicatesMatch ? parseInt(duplicatesMatch[1]) : 0,
          };
          
          // Find the output file path from the logs
          const outputFileMatch = stdout.match(/Successfully saved festivals to (.+\.json)/);
          const outputFile = outputFileMatch ? outputFileMatch[1].trim() : null;
          
          if (!outputFile) {
            console.error('No output file found in scraper logs');
            return NextResponse.json({ 
              success: false,
              error: 'Scraper completed but no output file was found',
              message: 'Failed to find scraper output',
              logs: stdout
            }, { status: 500 });
          }
          
          return NextResponse.json({ 
            success: true, 
            message: 'Scraper completed successfully',
            metrics,
            outputFile,
            logs: stdout
          });
        } catch (composeError) {
          // If both methods fail, provide detailed error and guidance
          console.error('All Docker methods failed:', composeError.message);
          
          if (error.stderr && error.stderr.includes('Mounts denied') || 
              composeError.stderr && composeError.stderr.includes('Mounts denied')) {
            return NextResponse.json({
              success: false,
              error: 'Docker cannot access your directories',
              message: 'Please update Docker file sharing settings in Docker Desktop',
              details: `In Docker Desktop, go to Settings → Resources → File Sharing and add:\n/tmp`,
              commands: [
                'docker-compose build festivalinfo-scraper',
                `docker run --rm -v "/tmp/festifind_temp_data:/app/data" -e FESTIVALINFO_MAX_PAGES=${maxPages} festivalinfo-scraper`
              ],
              dockerError: error.stderr || composeError.stderr
            }, { status: 500 });
          } else {
            return NextResponse.json({ 
              success: false, 
              error: 'Scraper commands failed',
              message: 'Both Docker and docker-compose attempts failed',
              dockerError: error.message,
              composeError: composeError.message,
              stderr: error.stderr || composeError.stderr || ''
            }, { status: 500 });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in festivalinfo run API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error',
      message: 'Internal server error'
    }, { status: 500 });
  }
} 