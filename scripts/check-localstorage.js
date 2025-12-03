#!/usr/bin/env node

/**
 * localStorage Diagnostic Tool
 * 
 * This script simulates what localStorage might contain.
 * Run this in your browser console on https://festifind2025.vercel.app/festivals
 * to see the actual localStorage contents.
 */

console.log('=== FestiFind localStorage Diagnostic Tool ===\n');

// Check if we're in browser environment
if (typeof window === 'undefined') {
  console.log('⚠️  This script should be run in the browser console');
  console.log('📋 Copy and paste the following code in your browser console on:');
  console.log('   https://festifind2025.vercel.app/festivals\n');
  
  console.log(`
// === COPY THIS CODE TO BROWSER CONSOLE ===

console.log('=== FestiFind localStorage Contents ===\\n');

const keys = [
  'festifind-favorites',
  'festifind-archived', 
  'festifind-notes',
  'festifind-sales-stages',
  'festifind-rate-cards',
  'festifind-research-status',
  'festifind-preferences-synced'
];

keys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    console.log(\`📦 \${key}:\`);
    try {
      const parsed = JSON.parse(value);
      const count = typeof parsed === 'object' ? Object.keys(parsed).length : 1;
      console.log(\`   Count: \${count} items\`);
      console.log(\`   Data:\`, parsed);
      console.log('');
    } catch (e) {
      console.log(\`   Raw value: \${value}\`);
      console.log('');
    }
  } else {
    console.log(\`❌ \${key}: Not found\`);
  }
});

// Also check for any festifind-related keys we might have missed
console.log('🔍 All localStorage keys containing "festifind":');
Object.keys(localStorage).filter(key => key.includes('festifind')).forEach(key => {
  console.log(\`   - \${key}\`);
});

// === END COPY ===
  `);
  
  process.exit(0);
}

// If somehow running in browser context, run the checks
const keys = [
  'festifind-favorites',
  'festifind-archived', 
  'festifind-notes',
  'festifind-sales-stages',
  'festifind-rate-cards',
  'festifind-research-status',
  'festifind-preferences-synced'
];

keys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    console.log(`📦 ${key}:`);
    try {
      const parsed = JSON.parse(value);
      const count = typeof parsed === 'object' ? Object.keys(parsed).length : 1;
      console.log(`   Count: ${count} items`);
      console.log(`   Data:`, parsed);
      console.log('');
    } catch (e) {
      console.log(`   Raw value: ${value}`);
      console.log('');
    }
  } else {
    console.log(`❌ ${key}: Not found`);
  }
}); 