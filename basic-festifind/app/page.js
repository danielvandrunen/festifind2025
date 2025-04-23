export default function Home() {
  return (
    <div className="max-w-5xl mx-auto">
      <section className="text-center py-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Find Your Next Festival Experience
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Discover, track, and plan your music festival adventures all in one place.
        </p>
        <a 
          href="/festivals" 
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg shadow-md transition-colors"
        >
          Explore Festivals
        </a>
      </section>

      <section className="grid md:grid-cols-3 gap-8 py-12">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Discover New Events</h2>
          <p className="text-gray-600">
            Browse hundreds of music festivals from around the world, with new events added regularly.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Save Your Favorites</h2>
          <p className="text-gray-600">
            Keep track of the festivals you're interested in and never miss out on ticket releases.
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Plan Your Journey</h2>
          <p className="text-gray-600">
            Get all the details you need for a perfect festival experience, from locations to lineups.
          </p>
        </div>
      </section>
    </div>
  );
} 