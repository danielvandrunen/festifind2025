// Run this in the browser console to check localStorage persistence

function checkLocalStorage() {
  console.log('Checking localStorage for FestiFind data:');
  
  // Check favorites
  const favorites = localStorage.getItem('festifind_favorites');
  if (favorites) {
    const parsedFavorites = JSON.parse(favorites);
    console.log('✅ Found favorites:', parsedFavorites);
    console.log(`Total favorites: ${Object.keys(parsedFavorites).length}`);
    
    // List all favorited festivals
    console.log('Favorited festival IDs:');
    Object.keys(parsedFavorites).forEach(id => {
      console.log(`- ${id}`);
    });
  } else {
    console.log('❌ No favorites found in localStorage');
  }
  
  // Check archived
  const archived = localStorage.getItem('festifind_archived');
  if (archived) {
    const parsedArchived = JSON.parse(archived);
    console.log('✅ Found archived items:', parsedArchived);
    console.log(`Total archived: ${Object.keys(parsedArchived).length}`);
  } else {
    console.log('❌ No archived items found in localStorage');
  }
  
  // Check notes
  const notes = localStorage.getItem('festifind_notes');
  if (notes) {
    const parsedNotes = JSON.parse(notes);
    console.log('✅ Found notes:', parsedNotes);
    console.log(`Total notes: ${Object.keys(parsedNotes).length}`);
  } else {
    console.log('❌ No notes found in localStorage');
  }
  
  return 'Check browser console for details';
}

console.log('Run checkLocalStorage() to check current localStorage data');

// To clear all localStorage data, run:
// localStorage.removeItem('festifind_favorites');
// localStorage.removeItem('festifind_archived');
// localStorage.removeItem('festifind_notes'); 