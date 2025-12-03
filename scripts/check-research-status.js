#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkResearchStatus() {
  console.log('🔍 Checking research status in database...\n');

  try {
    // Get all research records
    const { data: research, error: researchError } = await supabase
      .from('festival_research')
      .select('*')
      .order('created_at', { ascending: false });

    if (researchError) {
      console.error('❌ Error fetching research:', researchError);
      return;
    }

    console.log(`📊 Total research records: ${research.length}\n`);

    if (research.length === 0) {
      console.log('✅ No research records found - database is clean');
      return;
    }

    // Group by status
    const statusCounts = research.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    console.log('📈 Research Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const emoji = status === 'completed' ? '✅' : status === 'pending' ? '⏳' : '❌';
      console.log(`  ${emoji} ${status}: ${count}`);
    });

    console.log('\n📋 Recent Research Records:');
    research.slice(0, 10).forEach((r, i) => {
      const statusEmoji = r.status === 'completed' ? '✅' : r.status === 'pending' ? '⏳' : '❌';
      const createdAt = new Date(r.created_at).toLocaleString();
      const updatedAt = new Date(r.updated_at).toLocaleString();
      
      console.log(`\n${i + 1}. ${statusEmoji} Research ID: ${r.id}`);
      console.log(`   Festival ID: ${r.festival_id}`);
      console.log(`   Status: ${r.status}`);
      console.log(`   Provider: ${r.provider || 'N/A'}`);
      console.log(`   Created: ${createdAt}`);
      console.log(`   Updated: ${updatedAt}`);
      
      if (r.status === 'pending') {
        const timeDiff = Date.now() - new Date(r.created_at).getTime();
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        console.log(`   ⚠️  Pending for ${minutesAgo} minutes`);
      }
    });

    // Check for stuck pending research
    const stuckResearch = research.filter(r => {
      if (r.status !== 'pending') return false;
      const timeDiff = Date.now() - new Date(r.created_at).getTime();
      return timeDiff > 5 * 60 * 1000; // More than 5 minutes
    });

    if (stuckResearch.length > 0) {
      console.log(`\n🚨 Found ${stuckResearch.length} stuck research processes (pending > 5 minutes):`);
      stuckResearch.forEach(r => {
        const timeDiff = Date.now() - new Date(r.created_at).getTime();
        const minutesAgo = Math.floor(timeDiff / (1000 * 60));
        console.log(`   - ${r.id} (${minutesAgo} minutes ago)`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkResearchStatus(); 