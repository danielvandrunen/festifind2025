#!/usr/bin/env node

/**
 * localStorage Cleanup Tool
 * 
 * This script generates code to clear localStorage data that's conflicting 
 * with your manual database changes.
 * 
 * Run the generated code in your browser console.
 */

console.log('=== FestiFind localStorage Cleanup Tool ===\n');

console.log('🧹 This will clear localStorage data that conflicts with your database resets.\n');

console.log('📋 Copy and paste the following code in your browser console on:');
console.log('   https://festifind2025.vercel.app/festivals\n');

console.log(`
// === COPY THIS CODE TO BROWSER CONSOLE ===

console.log('🧹 === FestiFind localStorage Cleanup ===\\n');

// Keys to clear
const keysToClean = [
  'festifind-favorites',
  'festifind-archived', 
  'festifind-sales-stages',
  'festifind-notes',
  'festifind-preferences-synced'
];

// Backup current data first (optional)
console.log('📦 Backing up current localStorage data...');
const backup = {};
keysToClean.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    backup[key] = value;
    console.log(\`   - \${key}: \${JSON.parse(value) ? Object.keys(JSON.parse(value)).length : 1} items\`);
  }
});

console.log('\\n💾 Backup saved to console (copy if needed):');
console.log('window.festifindBackup =', backup);
window.festifindBackup = backup;

// Clear the data
console.log('\\n🗑️  Clearing localStorage data...');
keysToClean.forEach(key => {
  const existed = localStorage.getItem(key) !== null;
  localStorage.removeItem(key);
  console.log(\`   \${existed ? '✅' : '⚪'} \${key}: \${existed ? 'Cleared' : 'Not found'}\`);
});

// Verify cleanup
console.log('\\n🔍 Verification - Remaining festifind keys:');
const remainingKeys = Object.keys(localStorage).filter(key => key.includes('festifind'));
if (remainingKeys.length === 0) {
  console.log('   ✅ All festifind localStorage data cleared!');
} else {
  console.log('   ⚠️  Remaining keys:', remainingKeys);
}

console.log('\\n🎉 localStorage cleanup complete!');
console.log('💡 Next steps:');
console.log('   1. Refresh the page (F5)');
console.log('   2. Check that your database changes now persist correctly');
console.log('   3. Try favoriting/archiving a festival to test');

// === END COPY ===
`);

console.log('\n💡 After running this:');
console.log('   1. Your localStorage will be cleared');
console.log('   2. The app will load data fresh from the database');
console.log('   3. Your manual database resets should now be respected');
console.log('   4. New changes will sync properly without conflicts');

console.log('\n⚠️  Note: This will clear any unsaved local changes.');
console.log('   But since your database is already reset, this should be fine.'); 