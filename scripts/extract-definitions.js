const fs = require('fs');

try {
  // Read the schema file
  const schema = JSON.parse(fs.readFileSync('postgrest-schema.json', 'utf8'));
  
  // Extract just the definitions
  const definitions = schema.definitions;
  
  // Save to a separate file for easier viewing
  fs.writeFileSync('table-definitions.json', JSON.stringify(definitions, null, 2));
  
  console.log('Table definitions extracted to table-definitions.json');
  
  // Also extract parameters which contain column details
  const parameters = {};
  
  for (const key in schema.parameters) {
    if (key.startsWith('rowFilter.')) {
      parameters[key] = schema.parameters[key];
    }
  }
  
  fs.writeFileSync('column-parameters.json', JSON.stringify(parameters, null, 2));
  console.log('Column parameters extracted to column-parameters.json');
  
} catch (error) {
  console.error('Error:', error.message);
} 