// Import configuration from config/db.js if it exists, otherwise use environment variables
let dbConfig;
try {
  dbConfig = require('../config/db.js').supabaseConfig;
} catch (e) {
  console.log('Using environment variables for Supabase config');
  dbConfig = null;
}

// Supabase configuration
const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || 
       (dbConfig ? dbConfig.url : 'https://sxdbptmmvhluyxrlzgmh.supabase.co'),
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
           (dbConfig ? dbConfig.anonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY')
};

module.exports = {
  supabaseConfig
}; 