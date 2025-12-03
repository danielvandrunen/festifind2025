const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration
const supabaseUrl = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU';

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseKey);

// Query to get table schema information
const schemaQuery = `
SELECT
    t.table_name,
    array_agg(
        json_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable,
            'column_default', c.column_default
        ) ORDER BY c.ordinal_position
    ) as columns,
    array_agg(
        DISTINCT json_build_object(
            'constraint_name', tc.constraint_name,
            'constraint_type', tc.constraint_type
        )
    ) FILTER (WHERE tc.constraint_name IS NOT NULL) as constraints
FROM
    information_schema.tables t
LEFT JOIN
    information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
LEFT JOIN
    information_schema.table_constraints tc ON tc.table_name = t.table_name AND tc.table_schema = t.table_schema
WHERE
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
GROUP BY
    t.table_name
ORDER BY
    t.table_name;
`;

async function runDirectQuery() {
  try {
    console.log("Executing direct SQL query to fetch schema...");
    
    // Check if Postgres API is available
    if (typeof supabase.rpc !== 'function') {
      console.error("Error: The Supabase client doesn't support RPC calls.");
      return;
    }
    
    try {
      // Try using the PostgreSQL API directly
      const { data, error } = await supabase.rpc('pgmeta_get_schema_info');
      
      if (error) {
        console.log("RPC method failed, attempting direct SQL query...");
      } else {
        console.log("Schema via RPC:", data);
        fs.writeFileSync('schema-rpc.json', JSON.stringify(data, null, 2));
        console.log("Schema saved to schema-rpc.json");
        return;
      }
    } catch (e) {
      console.log("RPC method not available, trying direct query...");
    }
    
    // Direct way: use the REST API to get tables first
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    
    if (tablesError) {
      console.error("Error fetching tables:", tablesError);
      return;
    }
    
    console.log("Tables found:", tables.length);
    
    // Build schema object
    const schema = {};
    
    for (const table of tables) {
      const tableName = table.table_name;
      
      // Get columns
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .order('ordinal_position');
      
      if (columnsError) {
        console.error(`Error fetching columns for ${tableName}:`, columnsError);
        continue;
      }
      
      // Get constraints
      const { data: constraints, error: constraintsError } = await supabase
        .from('information_schema.table_constraints')
        .select('constraint_name, constraint_type')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);
      
      if (constraintsError) {
        console.error(`Error fetching constraints for ${tableName}:`, constraintsError);
      }
      
      schema[tableName] = {
        columns: columns || [],
        constraints: constraints || []
      };
    }
    
    console.log("Schema collected for tables:", Object.keys(schema));
    
    // Save schema to file
    fs.writeFileSync('schema-details.json', JSON.stringify(schema, null, 2));
    console.log("Schema saved to schema-details.json");
    
    // Print summary
    for (const [tableName, tableInfo] of Object.entries(schema)) {
      console.log(`\nTABLE: ${tableName}`);
      
      console.log('COLUMNS:');
      tableInfo.columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? `DEFAULT ${col.column_default}` : '';
        console.log(`  ${col.column_name} ${col.data_type} ${nullable} ${defaultVal}`);
      });
      
      if (tableInfo.constraints.length > 0) {
        console.log('CONSTRAINTS:');
        tableInfo.constraints.forEach(con => {
          console.log(`  ${con.constraint_name} (${con.constraint_type})`);
        });
      }
    }
    
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

// Run the query
runDirectQuery(); 