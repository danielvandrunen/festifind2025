const { createClient } = require('@supabase/supabase-js');
const { mockFestivals } = require('../data/mockFestivals');

// Create Supabase client directly in this script
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Supabase URL exists:', !!supabaseUrl);
console.log('Supabase Key exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertMockData() {
  console.log('Starting to insert mock data into database...');

  // Convert our mock data to match the database schema
  const festivals = mockFestivals.map((festival: any) => ({
    name: festival.name,
    start_date: festival.startDate,
    end_date: festival.endDate,
    location: festival.location.city,
    country: festival.location.country,
    url: festival.source.url,
    source: festival.source.name,
    favorite: festival.isFavorite,
    archived: festival.isArchived,
    notes: festival.notes
  }));

  console.log(`Preparing to insert ${festivals.length} festivals`);

  try {
    // Insert the data into the festivals table
    const { data, error } = await supabase
      .from('festivals')
      .upsert(festivals, { 
        onConflict: 'name,source', // Avoid duplicates based on name and source
        ignoreDuplicates: false 
      })
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