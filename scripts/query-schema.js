const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU';

// Initialize Supabase client with service role key for schema queries
const supabase = createClient(supabaseUrl, supabaseKey);

async function runQuery() {
  try {
    // Get table list
    console.log("Fetching tables...");
    const { data: tables, error: tablesError } = await supabase.rpc('get_schema_info');
    
    if (tablesError) {
      console.error("Error getting schema via RPC, trying direct SQL:");
      
      // Alternative: direct SQL query to list tables
      const tableQuery = `
        SELECT 
          table_name 
        FROM 
          information_schema.tables 
        WHERE 
          table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY 
          table_name;
      `;
      
      const { data, error } = await supabase.from('supabase_functions.http_request').select('*').limit(1);
      if (error) {
        console.error("Cannot access supabase functions, trying raw SQL via PostgreSQL API");
      }
      
      // Use raw SQL query as a last resort
      const { data: tableList, error: sqlError } = await supabase.sql(tableQuery);
      
      if (sqlError) {
        console.error("SQL query error:", sqlError);
        return;
      }
      
      // Print the list of tables
      console.log("Tables in the database:");
      if (tableList && tableList.length > 0) {
        tableList.forEach(table => {
          console.log(`- ${table.table_name}`);
        });
        
        // For each table, get its column details
        for (const table of tableList) {
          const tableName = table.table_name;
          
          const columnQuery = `
            SELECT 
              column_name, 
              data_type, 
              is_nullable, 
              column_default
            FROM 
              information_schema.columns 
            WHERE 
              table_schema = 'public' 
              AND table_name = '${tableName}'
            ORDER BY 
              ordinal_position;
          `;
          
          const { data: columns, error: columnError } = await supabase.sql(columnQuery);
          
          if (columnError) {
            console.error(`Error getting columns for ${tableName}:`, columnError);
            continue;
          }
          
          console.log(`\nTable: ${tableName}`);
          console.log("Columns:");
          
          columns.forEach(col => {
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
            console.log(`  ${col.column_name} ${col.data_type} ${nullable} ${defaultVal}`);
          });
        }
      } else {
        console.log("No tables found in the public schema");
      }
    } else {
      // Process RPC result
      console.log("Database Schema Information:", tables);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// Execute the query
runQuery(); 