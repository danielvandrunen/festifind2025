// Clear all localStorage and force refresh
// Run this in the browser console to completely clear local cache

console.log('🧹 Clearing all localStorage...');

// Clear all FestiFind localStorage items
const keysToRemove = [
  'festifind-favorites',
  'festifind-archived', 
  'festifind-notes',
  'festifind-sales-stages',
  'festifind-rate-cards',
  'festifind-research-status',
  'festifind-preferences-synced'
];

keysToRemove.forEach(key => {
  localStorage.removeItem(key);
  console.log(`✅ Removed: ${key}`);
});

// Clear all localStorage (nuclear option)
localStorage.clear();
console.log('💥 Cleared entire localStorage');

// Clear sessionStorage too
sessionStorage.clear();
console.log('💥 Cleared sessionStorage');

// Force hard refresh
console.log('🔄 Forcing hard refresh...');
window.location.reload(true); 