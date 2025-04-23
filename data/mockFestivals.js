const mockFestivals = [
  {
    id: "1",
    name: "Tomorrowland",
    startDate: "2025-07-18",
    endDate: "2025-07-27",
    location: {
      city: "Boom",
      country: "Belgium"
    },
    source: {
      name: "Tomorrowland Official",
      url: "https://www.tomorrowland.com"
    },
    isFavorite: true,
    isArchived: false,
    notes: "Need to buy tickets early, they sell out fast!"
  },
  {
    id: "2",
    name: "Glastonbury Festival",
    startDate: "2025-06-25",
    endDate: "2025-06-29",
    location: {
      city: "Pilton",
      country: "United Kingdom"
    },
    source: {
      name: "Glastonbury Official",
      url: "https://www.glastonburyfestivals.co.uk"
    },
    isFavorite: false,
    isArchived: false,
    notes: ""
  },
  {
    id: "3",
    name: "Coachella",
    startDate: "2025-04-11",
    endDate: "2025-04-20",
    location: {
      city: "Indio, California",
      country: "USA"
    },
    source: {
      name: "Coachella Official",
      url: "https://www.coachella.com"
    },
    isFavorite: false,
    isArchived: true,
    notes: "Too expensive this year"
  },
  {
    id: "4",
    name: "Ultra Music Festival",
    startDate: "2025-03-28",
    endDate: "2025-03-30",
    location: {
      city: "Miami, Florida",
      country: "USA"
    },
    source: {
      name: "Ultra Official",
      url: "https://ultramusicfestival.com"
    },
    isFavorite: true,
    isArchived: false,
    notes: "Looking for accommodations nearby"
  },
  {
    id: "5",
    name: "Burning Man",
    startDate: "2025-08-24",
    endDate: "2025-09-01",
    location: {
      city: "Black Rock Desert, Nevada",
      country: "USA"
    },
    source: {
      name: "Burning Man Official",
      url: "https://burningman.org"
    },
    isFavorite: false,
    isArchived: false,
    notes: "Need to prepare for extreme conditions"
  }
];

module.exports = { mockFestivals }; 