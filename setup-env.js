#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Path to .env.local file
const envFilePath = path.join(process.cwd(), '.env.local');

// Check if .env.local exists
let existingEnv = {};
if (fs.existsSync(envFilePath)) {
  const envContent = fs.readFileSync(envFilePath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        existingEnv[key.trim()] = value.trim();
      }
    }
  });
  
  console.log('Found existing .env.local file.');
  console.log('Current environment variables:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL:', existingEnv.NEXT_PUBLIC_SUPABASE_URL || 'Not set');
  console.log('- SUPABASE_SERVICE_ROLE_KEY:', existingEnv.SUPABASE_SERVICE_ROLE_KEY ? '***** (Set)' : 'Not set');
  console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', existingEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***** (Set)' : 'Not set');
}

// Ask for missing variables
const requestVariables = () => {
  rl.question('\nEnter Supabase URL [' + (existingEnv.NEXT_PUBLIC_SUPABASE_URL || '') + ']: ', (supabaseUrl) => {
    const finalSupabaseUrl = supabaseUrl || existingEnv.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!finalSupabaseUrl) {
      console.log('Supabase URL is required!');
      return requestVariables();
    }
    
    rl.question('Enter Supabase service role key [keep existing if any]: ', (serviceKey) => {
      const finalServiceKey = serviceKey || existingEnv.SUPABASE_SERVICE_ROLE_KEY;
      
      rl.question('Enter Supabase anon key [keep existing if any]: ', (anonKey) => {
        const finalAnonKey = anonKey || existingEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        // Create or update .env.local
        const envContent = `NEXT_PUBLIC_SUPABASE_URL=${finalSupabaseUrl}
SUPABASE_SERVICE_ROLE_KEY=${finalServiceKey || ''}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${finalAnonKey || ''}
`;
        
        fs.writeFileSync(envFilePath, envContent);
        console.log('\nEnvironment variables updated successfully!');
        console.log('File saved to:', envFilePath);
        
        rl.close();
      });
    });
  });
};

// Confirm update if file exists
if (Object.keys(existingEnv).length > 0) {
  rl.question('\nUpdate environment variables? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      requestVariables();
    } else {
      console.log('No changes made to environment variables.');
      rl.close();
    }
  });
} else {
  console.log('No .env.local file found. Let\'s create one!');
  requestVariables();
}

// Handle readline close
rl.on('close', () => {
  console.log('Setup complete!');
  process.exit(0);
}); 