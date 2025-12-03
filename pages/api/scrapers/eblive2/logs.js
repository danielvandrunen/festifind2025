import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Check if logs directory exists
    if (!fs.existsSync(logsDir)) {
      return res.status(200).json({
        success: true,
        logs: [],
        message: 'No logs directory found'
      });
    }
    
    // Find the latest EBLive log file
    const logFiles = fs.readdirSync(logsDir)
      .filter(f => f.startsWith('eblive-') && f.endsWith('.log'))
      .map(filename => {
        const fullPath = path.join(logsDir, filename);
        const stats = fs.statSync(fullPath);
        return { 
          name: filename, 
          path: fullPath,
          created: stats.mtime.getTime()
        };
      })
      .sort((a, b) => b.created - a.created); // Sort by most recent first
    
    if (logFiles.length === 0) {
      return res.status(200).json({
        success: true,
        logs: [],
        message: 'No EBLive log files found'
      });
    }
    
    // Read the latest log file
    const latestLog = logFiles[0];
    const logContent = fs.readFileSync(latestLog.path, 'utf8');
    
    // Split into lines and format for display
    const logLines = logContent
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        // Try to extract timestamp and message
        const parts = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \[([A-Z]+)\] (.+)$/);
        if (parts) {
          const [_, timestamp, level, message] = parts;
          return `[${timestamp}] ${level}: ${message}`;
        }
        return line;
      })
      .slice(-200); // Return at most 200 most recent log lines
    
    return res.status(200).json({
      success: true,
      logs: logLines,
      logFile: latestLog.name,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching logs',
      error: error.message
    });
  }
} 