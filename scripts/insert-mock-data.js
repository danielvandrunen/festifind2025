const { createClient } = require('@supabase/supabase-js');

// Hardcode Supabase credentials for this script using service role key
const supabaseUrl = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU';

console.log('Creating Supabase client with service role credentials:');
console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

// Define mock festival data directly in this script
const mockFestivals = [
  {
    name: "Tomorrowland",
    start_date: "2025-07-18",
    end_date: "2025-07-27",
    location: "Boom",
    country: "Belgium",
    url: "https://www.tomorrowland.com",
    source: "Tomorrowland Official",
    favorite: true,
    archived: false,
    notes: "Need to buy tickets early, they sell out fast!"
  },
  {
    name: "Glastonbury Festival",
    start_date: "2025-06-25",
    end_date: "2025-06-29",
    location: "Pilton",
    country: "United Kingdom",
    url: "https://www.glastonburyfestivals.co.uk",
    source: "Glastonbury Official",
    favorite: false,
    archived: false,
    notes: ""
  },
  {
    name: "Coachella",
    start_date: "2025-04-11",
    end_date: "2025-04-20",
    location: "Indio, California",
    country: "USA",
    url: "https://www.coachella.com",
    source: "Coachella Official",
    favorite: false,
    archived: true,
    notes: "Too expensive this year"
  },
  {
    name: "Ultra Music Festival",
    start_date: "2025-03-28",
    end_date: "2025-03-30",
    location: "Miami, Florida",
    country: "USA",
    url: "https://ultramusicfestival.com",
    source: "Ultra Official",
    favorite: true,
    archived: false,
    notes: "Looking for accommodations nearby"
  },
  {
    name: "Burning Man",
    start_date: "2025-08-24",
    end_date: "2025-09-01",
    location: "Black Rock Desert, Nevada",
    country: "USA",
    url: "https://burningman.org",
    source: "Burning Man Official",
    favorite: false,
    archived: false,
    notes: "Need to prepare for extreme conditions"
  }
];

async function insertMockData() {
  console.log('Starting to insert mock data into database...');
  console.log(`Preparing to insert ${mockFestivals.length} festivals`);

  try {
    // First, let's try to clear the table to avoid duplicates
    console.log('Clearing existing festival data...');
    const { error: clearError } = await supabase
      .from('festivals')
      .delete()
      .not('id', 'is', null); // Delete all records
      
    if (clearError) {
      console.error('Error clearing existing data:', clearError);
      return;
    }
    
    console.log('Table cleared. Inserting new data...');
    
    // Insert the data into the festivals table
    const { data, error } = await supabase
      .from('festivals')
      .insert(mockFestivals)
      .select();

    if (error) {
      console.error('Error inserting mock data:', error);
      return;
    }

    console.log(`✅ Successfully inserted ${data.length} festivals into the database.`);
  } catch (err) {
    console.error('Error during database operation:', err);
  }
}

// Run the function
insertMockData()
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  }); 