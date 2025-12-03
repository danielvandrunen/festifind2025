#!/bin/sh
set -e

# Explicitly remove any .babelrc file to ensure SWC works with next/font
if [ -f /app/.babelrc ]; then
  echo "Removing .babelrc file to ensure SWC compatibility..."
  rm -f /app/.babelrc
fi

# Create .env file if it doesn't exist
if [ ! -f /app/.env ]; then
  echo "Creating .env file..."
  cat > /app/.env << EOENV
# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://sxdbptmmvhluyxrlzgmh.supabase.co
# Using service role key instead of anon key
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU

# Node environment
NODE_ENV=${NODE_ENV:-development}

# Next.js settings
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS=--max_old_space_size=4096
EOENV
fi

# Remove any existing .babelrc file in app directory
find /app -name ".babelrc" -delete

# Ensure environment variables are exported
export NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://sxdbptmmvhluyxrlzgmh.supabase.co}
# Using service role key instead of anon key
export NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU}
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS=--max_old_space_size=4096

# Print environment variables for debugging
echo "=== Environment variables ==="
echo "NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY: $(echo \"$NEXT_PUBLIC_SUPABASE_ANON_KEY\" | cut -c1-10)... (masked)"
echo "NODE_ENV: ${NODE_ENV}"
echo "==========================="

# Install required packages
echo "Installing required npm packages..."
npm install --save @babel/runtime cheerio || true

# Ensure browsers are available
if [ ! -f /usr/bin/chromium-browser ]; then
  echo "Chromium browser not found in Next.js container. We'll use the Python scraper container for browser automation."
  # Not exiting since we don't need the browser in this container
fi

# Fix JavaScript module issues
echo "Running JavaScript module fix script..."

# Add "type": "module" to package.json if not already present
if grep -q '"type": "module"' /app/package.json; then
  echo "Package.json already has type:module"
else
  echo "Adding type:module to package.json"
  sed -i 's/"private": true,/"private": true,\n  "type": "module",/' /app/package.json
fi

# Create .next directory with proper permissions
echo "Setting up build directories..."
mkdir -p /app/.next/cache/webpack
mkdir -p /app/.next/server
mkdir -p /app/.next/static
chmod -R 777 /app/.next

# Handle the fallback-build-manifest.json error
mkdir -p /app/.next
touch /app/.next/fallback-build-manifest.json
echo "{}" > /app/.next/fallback-build-manifest.json
chmod 666 /app/.next/fallback-build-manifest.json

# Create contexts directory if it doesn't exist
mkdir -p /app/app/contexts

# Check for NotificationContext.js
if [ ! -f /app/app/contexts/NotificationContext.js ]; then
  echo "Creating NotificationContext.js..."
  cat > /app/app/contexts/NotificationContext.js << EOCONTEXT
'use client';
import { createContext, useState, useContext } from 'react';

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (message, type = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
    return id;
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  };
  
  // Add convenience methods for different notification types
  const showInfo = (message) => {
    return addNotification(message, 'info');
  };

  const showSuccess = (message) => {
    return addNotification(message, 'success');
  };

  const showError = (message) => {
    return addNotification(message, 'error');
  };

  const showWarning = (message) => {
    return addNotification(message, 'warning');
  };

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        addNotification, 
        removeNotification,
        showInfo,
        showSuccess,
        showError,
        showWarning
      }}
    >
      {children}
      
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map((notification) => (
          <div 
            key={notification.id} 
            className={\`p-4 rounded shadow-lg max-w-md \${
              notification.type === 'error' ? 'bg-red-500 text-white' :
              notification.type === 'success' ? 'bg-green-500 text-white' :
              notification.type === 'warning' ? 'bg-yellow-500 text-white' :
              'bg-blue-500 text-white'
            }\`}
          >
            {notification.message}
            <button 
              className="ml-2 text-white" 
              onClick={() => removeNotification(notification.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
EOCONTEXT
fi

# Copy standardized Supabase client if it doesn't exist
if [ ! -f /app/lib/supabase-client.js ]; then
  echo "Creating standardized Supabase client..."
  mkdir -p /app/lib
  cat > /app/lib/supabase-client.js << EOSUPABASE
/**
 * Centralized Supabase client for the entire application
 * This creates a single instance that should be imported and used everywhere
 */

import { createClient } from '@supabase/supabase-js';

// Default values 
const DEFAULT_URL = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
// Using service role key for better access privileges
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU';

// Environment variables take precedence over defaults
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

// Log configuration for debugging (without exposing full key)
if (process.env.NODE_ENV === 'development') {
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase key provided:', supabaseKey ? 'Yes (masked)' : 'No');
  console.log('Key type:', supabaseKey.includes('"role":"service_role"') ? 'service_role' : 'anon');
}

// Initialize the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
  // Add global error handler to help debug connection issues
  global: {
    fetch: (...args) => {
      return fetch(...args).catch(error => {
        console.error('Supabase fetch error:', error);
        throw error;
      });
    }
  }
});

/**
 * Fetch data with automatic error handling and retries
 * @param {string} table - The table to query
 * @param {Object} options - Query options (select, order, filters, etc.)
 * @param {number} retries - Number of retry attempts (default: 1)
 * @returns {Promise<Array>} - The fetched data or empty array
 */
export async function fetchData(table, options = {}, retries = 1) {
  try {
    let query = supabase.from(table).select(options.select || '*');
    
    // Apply ordering if specified
    if (options.order) {
      query = query.order(options.order.column, { 
        ascending: options.order.ascending 
      });
    }
    
    // Apply filters if provided
    if (options.filters) {
      options.filters.forEach(filter => {
        query = query.filter(filter.column, filter.operator, filter.value);
      });
    }
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      console.error(\`Error fetching from \${table}:\`, error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error(\`Exception fetching from \${table}:\`, error);
    
    // Retry logic for transient issues
    if (retries > 0) {
      console.log(\`Retrying fetch from \${table}, \${retries} attempts left...\`);
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(fetchData(table, options, retries - 1));
        }, 1000); // 1 second delay before retry
      });
    }
    
    // Return empty array if all retries failed
    return [];
  }
}

/**
 * Test the Supabase connection
 * @returns {Promise<boolean>} - Whether the connection was successful
 */
export async function testConnection() {
  try {
    const { data, error } = await supabase.from('festivals').select('count', { count: 'exact' });
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Exception testing Supabase connection:', error);
    return false;
  }
}

export { supabase };
export default supabase;
EOSUPABASE
fi

# Final pre-start check
echo "Running final pre-start checks..."

# Remove any .babelrc file that might have been created during setup
find /app -name ".babelrc" -delete

# Create an empty next.config.js file that forces SWC
cat > /app/next.config.js << EONEXTCONFIG
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    forceSwcTransforms: true,
  },
  reactStrictMode: true,
  swcMinify: true,
};

export default nextConfig;
EONEXTCONFIG

echo "Environment setup complete. Starting application..."

# Run the command provided to the docker container
exec "$@"
