const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU';

// Initialize Supabase client with service role key for schema queries
const supabase = createClient(supabaseUrl, supabaseKey);

async function getTableNames() {
  const { data, error } = await supabase
    .rpc('get_table_names')
    .select();
  
  if (error) {
    console.error('Error fetching table names:', error);
    // Try alternative approach if RPC not available
    return getTableNamesAlternative();
  }
  
  return data;
}

async function getTableNamesAlternative() {
  // Query information_schema directly
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');
  
  if (error) {
    console.error('Error fetching tables from information_schema:', error);
    return [];
  }
  
  return data;
}

async function getTableSchema(tableName) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)
    .order('ordinal_position');
  
  if (error) {
    console.error(`Error fetching schema for table ${tableName}:`, error);
    return [];
  }
  
  return data;
}

async function getTableConstraints(tableName) {
  const { data, error } = await supabase
    .from('information_schema.table_constraints')
    .select(`
      constraint_name,
      constraint_type
    `)
    .eq('table_schema', 'public')
    .eq('table_name', tableName);
  
  if (error) {
    console.error(`Error fetching constraints for table ${tableName}:`, error);
    return [];
  }
  
  return data;
}

async function describeSchema() {
  try {
    // Try direct SQL query first
    const { data: tables, error } = await supabase
      .from('pg_catalog.pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
      
    if (error) {
      console.error('Error fetching tables:', error);
      return;
    }
    
    console.log('=== DATABASE SCHEMA ===\n');
    
    if (!tables || tables.length === 0) {
      console.log('No tables found in the public schema.');
      return;
    }
    
    // Store full schema details
    const schemaDetails = {};
    
    for (const table of tables) {
      const tableName = table.tablename;
      console.log(`TABLE: ${tableName}`);
      
      const columns = await getTableSchema(tableName);
      const constraints = await getTableConstraints(tableName);
      
      schemaDetails[tableName] = { columns, constraints };
      
      if (columns && columns.length > 0) {
        console.log('COLUMNS:');
        columns.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
          console.log(`  ${col.column_name} ${col.data_type} ${nullable} ${defaultVal}`);
        });
      } else {
        console.log('No columns found');
      }
      
      if (constraints && constraints.length > 0) {
        console.log('CONSTRAINTS:');
        constraints.forEach(con => {
          console.log(`  ${con.constraint_name} (${con.constraint_type})`);
        });
      }
      
      console.log('\n');
    }
    
    // Save schema to a JSON file for later use
    const fs = require('fs');
    fs.writeFileSync('schema-details.json', JSON.stringify(schemaDetails, null, 2));
    console.log('Schema details saved to schema-details.json');
    
  } catch (error) {
    console.error('Error describing schema:', error);
  }
}

// Execute the schema description
describeSchema(); 