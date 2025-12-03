#!/usr/bin/env node

console.log('=== THOROUGH FestiFind localStorage Cleanup ===\n');

console.log('📋 Copy and paste this code in your browser console:\n');

console.log(`
// === COPY THIS THOROUGH CLEANUP CODE ===

console.log('🧹 === THOROUGH FestiFind localStorage Cleanup ===\\n');

// Find ALL festifind-related keys
const allFestifindKeys = Object.keys(localStorage).filter(key => key.includes('festifind'));

console.log('🔍 Found festifind localStorage keys:');
allFestifindKeys.forEach(key => {
  const value = localStorage.getItem(key);
  try {
    const parsed = JSON.parse(value);
    const count = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 1;
    console.log(\`   📦 \${key}: \${count} items\`);
  } catch (e) {
    console.log(\`   📦 \${key}: \${value ? 'string value' : 'empty'}\`);
  }
});

// Clear ALL festifind data
console.log('\\n🗑️  Clearing ALL festifind localStorage data...');
allFestifindKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(\`   ✅ Cleared: \${key}\`);
});

// Also clear any potential Vue/React state cache
const potentialCacheKeys = [
  'vuex',
  'react-query',
  'swr-cache',
  'apollo-cache',
  'redux-persist'
].filter(key => localStorage.getItem(key));

if (potentialCacheKeys.length > 0) {
  console.log('\\n🔍 Found potential app cache keys:');
  potentialCacheKeys.forEach(key => {
    console.log(\`   ⚠️  \${key} (not clearing - check manually if needed)\`);
  });
}

// Final verification
console.log('\\n✅ Verification:');
const remainingFestifindKeys = Object.keys(localStorage).filter(key => key.includes('festifind'));
if (remainingFestifindKeys.length === 0) {
  console.log('   🎉 ALL festifind localStorage data cleared!');
} else {
  console.log('   ⚠️  Still remaining:', remainingFestifindKeys);
}

console.log('\\n🔄 Next steps:');
console.log('   1. Close all FestiFind tabs');
console.log('   2. Wait 5 seconds');
console.log('   3. Open fresh tab: https://festifind2025.vercel.app/sales-monitor');
console.log('   4. Should now load fresh data from database');

// === END COPY ===
`);

console.log('\n💡 After this cleanup:');
console.log('   - Close ALL FestiFind tabs');
console.log('   - Open a completely fresh tab');
console.log('   - This forces the app to reload from scratch'); 