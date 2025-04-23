import Link from "next/link";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      <main className="flex flex-col gap-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to FestiFind</h1>
          <p className="text-xl mb-8">Your gateway to festivals around the world</p>
          
          <div className="flex gap-4 justify-center">
            <Link 
              href="/festivals" 
              className="rounded-full bg-blue-600 text-white px-6 py-3 font-medium hover:bg-blue-700 transition-colors"
            >
              Browse Festivals
            </Link>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="font-bold text-xl mb-3">Discover</h2>
            <p className="text-gray-600 mb-4">Find upcoming festivals in your favorite locations around the world.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="font-bold text-xl mb-3">Save</h2>
            <p className="text-gray-600 mb-4">Bookmark festivals you're interested in and keep track of your plans.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="font-bold text-xl mb-3">Share</h2>
            <p className="text-gray-600 mb-4">Share festival details with friends and organize your trips together.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
