const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration
const supabaseUrl = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey);

async function queryAllTables() {
  try {
    // First approach: Try querying specific common tables we might expect
    const tables = [
      'festivals',
      'users',
      'notes',
      'sources',
      'preferences',
      'scrapers'
    ];
    
    console.log('Attempting to query known tables...');
    
    const schemaInfo = {};
    
    for (const table of tables) {
      try {
        // Try to get the structure by querying a single row
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`Table '${table}' error:`, error.message);
        } else {
          console.log(`Table '${table}' exists`);
          
          // If we have data, we can infer the structure
          if (data && data.length > 0) {
            const structure = Object.keys(data[0]).map(column => {
              const type = typeof data[0][column];
              return { column, type };
            });
            
            schemaInfo[table] = {
              columns: structure,
              rowCount: data.length > 0 ? 1 : 0,
              sample: data
            };
          } else {
            console.log(`Table '${table}' exists but is empty`);
            schemaInfo[table] = { 
              exists: true, 
              isEmpty: true 
            };
            
            // Try to get the columns by using RPC
            try {
              const { data: columns, error: colError } = await supabase.rpc('get_columns', { table_name: table });
              if (!colError && columns) {
                schemaInfo[table].columns = columns;
              }
            } catch (e) {
              // No column info available
            }
          }
        }
      } catch (e) {
        console.log(`Error querying table '${table}':`, e.message);
      }
    }
    
    // Save the results
    fs.writeFileSync('supabase-schema.json', JSON.stringify(schemaInfo, null, 2));
    console.log('Schema information saved to supabase-schema.json');
    
    // Second approach: Try using REST API to directly list tables
    try {
      console.log('\nAttempting to list all tables using REST API...');
      const { data, error } = await supabase.rest('/rest/v1/?exclude=spatial_ref_sys');
      
      if (error) {
        console.log('Error listing tables via REST API:', error.message);
      } else {
        console.log('Tables from REST API:', data);
        fs.writeFileSync('supabase-tables.json', JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.log('REST API approach failed:', e.message);
    }
    
    // Third approach: Use Postgrest introspection endpoint
    try {
      console.log('\nAttempting to use Postgrest introspection...');
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Postgrest introspection result:', data);
        fs.writeFileSync('postgrest-schema.json', JSON.stringify(data, null, 2));
      } else {
        console.log('Postgrest introspection failed:', response.statusText);
      }
    } catch (e) {
      console.log('Postgrest approach failed:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

queryAllTables(); 