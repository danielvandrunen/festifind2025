// Simulated data functions for the basic FestiFind version

export async function fetchFestivals() {
  // Simulating API request delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    {
      id: '1',
      name: 'Coachella Valley Music and Arts Festival',
      start_date: '2025-04-11',
      end_date: '2025-04-20',
      location: 'Indio',
      city: 'Indio',
      country: 'USA',
      source: 'Official Website',
      website: 'https://www.coachella.com/'
    },
    {
      id: '2',
      name: 'Glastonbury Festival',
      start_date: '2025-06-25',
      end_date: '2025-06-29',
      location: 'Worthy Farm',
      city: 'Pilton',
      country: 'UK',
      source: 'Music Industry News',
      website: 'https://www.glastonburyfestivals.co.uk/'
    },
    {
      id: '3',
      name: 'Tomorrowland',
      start_date: '2025-07-18',
      end_date: '2025-07-27',
      location: 'De Schorre',
      city: 'Boom',
      country: 'Belgium',
      source: 'Official Website',
      website: 'https://www.tomorrowland.com/'
    },
    {
      id: '4',
      name: 'Lollapalooza',
      start_date: '2025-08-01',
      end_date: '2025-08-03',
      location: 'Grant Park',
      city: 'Chicago',
      country: 'USA',
      source: 'Music Industry News',
      website: 'https://www.lollapalooza.com/'
    },
    {
      id: '5',
      name: 'Electric Daisy Carnival',
      start_date: '2025-05-16',
      end_date: '2025-05-18',
      location: 'Las Vegas Motor Speedway',
      city: 'Las Vegas',
      country: 'USA',
      source: 'Official Website',
      website: 'https://lasvegas.electricdaisycarnival.com/'
    },
    {
      id: '6',
      name: 'Ultra Music Festival',
      start_date: '2025-03-28',
      end_date: '2025-03-30',
      location: 'Bayfront Park',
      city: 'Miami',
      country: 'USA',
      source: 'Festival Database',
      website: 'https://ultramusicfestival.com/'
    },
    {
      id: '7',
      name: 'Primavera Sound',
      start_date: '2025-06-05',
      end_date: '2025-06-07',
      location: 'Parc del Fòrum',
      city: 'Barcelona',
      country: 'Spain',
      source: 'Festival Database',
      website: 'https://www.primaverasound.com/'
    },
    {
      id: '8',
      name: 'Burning Man',
      start_date: '2025-08-24',
      end_date: '2025-09-01',
      location: 'Black Rock Desert',
      city: 'Nevada',
      country: 'USA',
      source: 'Official Website',
      website: 'https://burningman.org/'
    },
    {
      id: '9',
      name: 'Fuji Rock Festival',
      start_date: '2025-07-25',
      end_date: '2025-07-27',
      location: 'Naeba Ski Resort',
      city: 'Yuzawa',
      country: 'Japan',
      source: 'Music Industry News',
      website: 'https://www.fujirockfestival.com/'
    },
    {
      id: '10',
      name: 'Roskilde Festival',
      start_date: '2025-06-28',
      end_date: '2025-07-05',
      location: 'Roskilde Festival Grounds',
      city: 'Roskilde',
      country: 'Denmark',
      source: 'Festival Database',
      website: 'https://www.roskilde-festival.dk/'
    }
  ];
}

export async function fetchFestival(id) {
  const festivals = await fetchFestivals();
  return festivals.find(festival => festival.id === id);
} 