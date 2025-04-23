export default function FestivalsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Festivals</h1>
      <p className="mb-4">Discover amazing festivals from around the world.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {/* This would be populated from a database in a real application */}
        <FestivalCard 
          name="Summer Music Festival" 
          date="July 15-17, 2025" 
          location="New York, USA" 
        />
        <FestivalCard 
          name="Art & Culture Expo" 
          date="August 5-8, 2025" 
          location="Paris, France" 
        />
        <FestivalCard 
          name="Food & Wine Festival" 
          date="September 10-12, 2025" 
          location="Barcelona, Spain" 
        />
      </div>
    </div>
  );
}

// Simple card component for displaying festival information
function FestivalCard({ name, date, location }: { name: string; date: string; location: string }) {
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="h-48 bg-gray-200"></div>
      <div className="p-4">
        <h3 className="font-bold text-xl mb-2">{name}</h3>
        <p className="text-gray-600 mb-1">{date}</p>
        <p className="text-gray-500">{location}</p>
      </div>
    </div>
  );
} 