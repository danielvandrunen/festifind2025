import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    // Get the absolute path to the JSON file
    const filePath = path.join(process.cwd(), 'public', 'data', 'eblive-festivals.json');
    
    // Read the file
    const fileContents = fs.readFileSync(filePath, 'utf8');
    
    // Parse the JSON
    const data = JSON.parse(fileContents);
    
    // Return the data
    res.status(200).json({
      success: true,
      count: data.length,
      festivals: data
    });
  } catch (error) {
    console.error('Error loading festival data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load festival data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
} 