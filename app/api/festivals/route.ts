import { NextResponse } from 'next/server';
import { supabase, fetchData } from '../../../lib/supabase-client';

export async function GET(request) {
  const startTime = Date.now();
  console.log('API: Fetching festivals from Supabase...');
  
  try {
    // Get query parameters for date filtering and pagination
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const nullDates = url.searchParams.get('nullDates') === 'true';
    const searchQuery = url.searchParams.get('search');
    
    // Pagination parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    const chunked = url.searchParams.get('chunked') === 'true';
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Log connection details to verify we're connecting to the correct instance
    console.log('API: Using Supabase URL from environment/config');
    
    // Select all fields including user preferences that are now stored in the festivals table
    const selectFields = `
      id,
      name,
      start_date,
      end_date,
      location,
      country,
      url,
      source,
      emails,
      created_at,
      updated_at,
      favorite,
      archived,
      notes,
      sales_stage,
      linkedin_url,
      research_data,
      homepage_url,
      organizing_company,
      last_verified
    `;
    
    // If search query is provided, search across all festivals
    if (searchQuery) {
      console.log(`API: Searching for festivals matching: "${searchQuery}"`);
      
      // Use raw SQL query to bypass the 1000 row limit
      const { data: searchResults, error } = await supabase.rpc('search_festivals', {
        search_term: `%${searchQuery}%`
      });
      
      if (error) {
        console.error('API: Error searching festivals:', error);
        
        // Fallback to direct query if RPC fails
        const { data: fallbackResults, error: fallbackError } = await supabase
          .from('festivals')
          .select(selectFields)
          .or(`name.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`)
          .limit(10000);
          
        if (fallbackError) {
          return NextResponse.json({ error: fallbackError.message }, { status: 500 });
        }
        
        // Map url to source_url for frontend compatibility
        const mappedData = fallbackResults.map(festival => ({
          ...festival,
          source_url: festival.url
        }));
        
        console.log(`API: Found ${mappedData.length} festivals matching search query (fallback method)`);
        return NextResponse.json(mappedData);
      }
      
      // Map url to source_url for frontend compatibility
      const mappedData = searchResults.map(festival => ({
        ...festival,
        source_url: festival.url
      }));
      
      console.log(`API: Found ${mappedData.length} festivals matching search query`);
      console.log(`API: Search query completed in ${Date.now() - startTime}ms`);
      
              return NextResponse.json(mappedData, {
          headers: {
            'Cache-Control': 'public, max-age=10, s-maxage=30', // 10sec browser, 30sec edge
            'Vary': 'Accept-Encoding',
            'X-Response-Time': `${Date.now() - startTime}ms`,
          }
        });
    } else if (nullDates) {
      console.log('API: Fetching festivals with null dates');
      
      // Use raw SQL to bypass the 1000 row limit
      const { data: nullDateFestivals, error } = await supabase.rpc('get_null_date_festivals');
      
      if (error) {
        console.error('API: Error fetching festivals with null dates:', error);
        
        // Fallback to direct query
        const { data: fallbackResults, error: fallbackError } = await supabase
          .from('festivals')
          .select(selectFields)
          .is('start_date', null)
          .is('end_date', null)
          .order('name', { ascending: true })
          .limit(10000);
          
        if (fallbackError) {
          return NextResponse.json({ error: fallbackError.message }, { status: 500 });
        }
        
        // Map url to source_url for frontend compatibility
        const mappedData = fallbackResults.map(festival => ({
          ...festival,
          source_url: festival.url
        }));
        
        console.log(`API: Found ${mappedData.length} festivals with null dates (fallback method)`);
        return NextResponse.json(mappedData);
      }
      
      // Map url to source_url for frontend compatibility
      const mappedData = nullDateFestivals.map(festival => ({
        ...festival,
        source_url: festival.url
      }));
      
      console.log(`API: Found ${mappedData.length} festivals with null dates in database`);
      
              return NextResponse.json(mappedData, {
          headers: {
            'Cache-Control': 'public, max-age=10, s-maxage=30', // 10sec browser, 30sec edge  
            'Vary': 'Accept-Encoding',
          }
        });
    } else if (startDate && endDate) {
      console.log(`API: Filtering festivals by date range: ${startDate} to ${endDate}`);
      
      // Use raw SQL to get all festivals in date range
      const { data: dateRangeFestivals, error } = await supabase.rpc('get_festivals_in_date_range', {
        start_date_param: startDate,
        end_date_param: endDate
      });
      
      if (error) {
        console.error('API: Error fetching festivals in date range:', error);
        
        // If RPC fails, fall back to multiple queries as before
        // 1. Festival starts during the selected range
        const { data: festivalsStartingInRange, error: startError } = await supabase
          .from('festivals')
          .select(selectFields)
          .filter('start_date', 'gte', startDate)
          .filter('start_date', 'lte', endDate)
          .order('start_date', { ascending: true })
          .limit(10000);
        
        if (startError) {
          console.error('API: Error fetching festivals starting in range:', startError);
          return NextResponse.json({ error: startError.message }, { status: 500 });
        }
        
        // 2. Festival ends during the selected range
        const { data: festivalsEndingInRange, error: endError } = await supabase
          .from('festivals')
          .select(selectFields)
          .filter('end_date', 'gte', startDate)
          .filter('end_date', 'lte', endDate)
          .filter('start_date', 'lt', startDate) // Starts before range
          .order('start_date', { ascending: true })
          .limit(10000);
        
        if (endError) {
          console.error('API: Error fetching festivals ending in range:', endError);
        }
        
        // 3. Festival spans the entire selected range (starts before and ends after)
        const { data: festivalsSpanningRange, error: spanError } = await supabase
          .from('festivals')
          .select(selectFields)
          .filter('start_date', 'lt', startDate)
          .filter('end_date', 'gt', endDate)
          .order('start_date', { ascending: true })
          .limit(10000);
        
        if (spanError) {
          console.error('API: Error fetching spanning festivals:', spanError);
        }
        
        // Combine results and remove duplicates
        let allFestivals = [...(festivalsStartingInRange || [])];
        
        if (festivalsEndingInRange && festivalsEndingInRange.length > 0) {
          console.log(`API: Found ${festivalsEndingInRange.length} festivals that end during the selected range`);
          // Add only festivals that aren't already in the array
          festivalsEndingInRange.forEach(festival => {
            if (!allFestivals.find(f => f.id === festival.id)) {
              allFestivals.push(festival);
            }
          });
        }
        
        if (festivalsSpanningRange && festivalsSpanningRange.length > 0) {
          console.log(`API: Found ${festivalsSpanningRange.length} festivals that span the entire selected range`);
          // Add only festivals that aren't already in the array
          festivalsSpanningRange.forEach(festival => {
            if (!allFestivals.find(f => f.id === festival.id)) {
              allFestivals.push(festival);
            }
          });
        }
        
        // Map url to source_url for frontend compatibility
        allFestivals = allFestivals.map(festival => ({
          ...festival,
          source_url: festival.url
        }));
        
        console.log(`API: Found ${allFestivals.length} festivals in database for the selected range (fallback method)`);
        return NextResponse.json(allFestivals, {
          headers: {
            'Cache-Control': 'public, max-age=180, s-maxage=600', // 3min browser, 10min edge
            'Vary': 'Accept-Encoding',
          }
        });
      }
      
      // Map url to source_url for frontend compatibility
      const mappedData = dateRangeFestivals.map(festival => ({
        ...festival,
        source_url: festival.url
      }));
      
      console.log(`API: Found ${mappedData.length} festivals in database for the selected range`);
      
      // Log the first 5 festivals to debug
      if (mappedData.length > 0) {
        console.log('API: First 5 festivals:', mappedData.slice(0, 5).map(f => ({ 
          name: f.name, 
          start_date: f.start_date, 
          end_date: f.end_date 
        })));
      } else {
        console.log('API: No festivals found in database for the given criteria');
      }
      
      return NextResponse.json(mappedData);
    } else {
      // No date filtering, return all festivals (with optional chunking)
      console.log('API: Fetching all festivals from database');
      
      if (chunked) {
        console.log(`API: Using chunked loading - page ${page}, limit ${limit}, offset ${offset}`);
        
        // First get the total count
        const { count: totalCount, error: countError } = await supabase
          .from('festivals')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          console.error('API: Error getting total count:', countError);
          return NextResponse.json({ error: countError.message }, { status: 500 });
        }
        
        if (totalCount === null) {
          console.error('API: Total count is null');
          return NextResponse.json({ error: 'Unable to determine total count' }, { status: 500 });
        }
        
        // Then get the paginated data
        const { data: paginatedData, error: dataError } = await supabase
          .from('festivals')
          .select(selectFields)
          .order('start_date', { ascending: true })
          .range(offset, offset + limit - 1);
        
        if (dataError) {
          console.error('API: Error fetching paginated festivals:', dataError);
          return NextResponse.json({ error: dataError.message }, { status: 500 });
        }
        
        // Map url to source_url for frontend compatibility
        const mappedData = paginatedData.map(festival => ({
          ...festival,
          source_url: festival.url
        }));
        
        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = page < totalPages;
        
        console.log(`API: Returning chunk ${page}/${totalPages} with ${mappedData.length} festivals (total: ${totalCount})`);
        
        return NextResponse.json({
          data: mappedData,
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages,
            hasMore,
            loaded: Math.min(page * limit, totalCount)
          }
        }, {
          headers: {
            'Cache-Control': 'public, max-age=10, s-maxage=30', // 10sec browser, 30sec edge
            'Vary': 'Accept-Encoding',
          }
        });
      } else {
        // Original behavior - return all festivals at once
        // Use raw SQL to bypass the 1000 row limit
        const { data, error } = await supabase.rpc('get_all_festivals');
        
        if (error) {
          console.error('API: Error fetching all festivals:', error);
          
          // Fallback to direct query
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('festivals')
            .select(selectFields)
            .order('start_date', { ascending: true })
            .limit(10000);
            
          if (fallbackError) {
            return NextResponse.json({ error: fallbackError.message }, { status: 500 });
          }
          
          // Map url to source_url for frontend compatibility
          const mappedData = fallbackData.map(festival => ({
            ...festival,
            source_url: festival.url
          }));
          
          console.log(`API: Found ${mappedData.length} festivals in database (fallback method)`);
          
          // Log the first 5 festivals to debug
          if (mappedData.length > 0) {
            console.log('API: First 5 festivals:', mappedData.slice(0, 5).map(f => ({ 
              name: f.name, 
              start_date: f.start_date, 
              end_date: f.end_date 
            })));
          } else {
            console.log('API: No festivals found in database');
          }
          
          return NextResponse.json(mappedData);
        }
        
        // Map url to source_url for frontend compatibility
        const mappedData = data.map(festival => ({
          ...festival,
          source_url: festival.url
        }));
        
        console.log(`API: Found ${mappedData.length} festivals in database`);
        console.log(`API: All festivals query completed in ${Date.now() - startTime}ms`);
        
        // Log the first 5 festivals to debug
        if (mappedData.length > 0) {
          console.log('API: First 5 festivals:', mappedData.slice(0, 5).map(f => ({ 
            name: f.name, 
            start_date: f.start_date, 
            end_date: f.end_date 
          })));
        } else {
          console.log('API: No festivals found in database');
        }
        
        return NextResponse.json(mappedData, {
          headers: {
            'Cache-Control': 'public, max-age=10, s-maxage=30', // 10sec browser, 30sec edge
            'Vary': 'Accept-Encoding',
            'X-Response-Time': `${Date.now() - startTime}ms`,
          }
        });
      }
    }
    
  } catch (error) {
    console.error('API: Error fetching festivals:', error);
    // Return an empty array if there's an exception
    return NextResponse.json([]);
  }
} 