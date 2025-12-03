import SafeLink from '../../components/SafeLink';

export default function ScraperToolsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Scraper Tools</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow flex flex-col gap-4">
          <h2 className="text-xl font-semibold mb-2">Planned Scrapers</h2>
          <SafeLink href="/scrapers/eblive2" className="px-4 py-2 bg-teal-600 text-white rounded-md text-center font-semibold shadow hover:bg-teal-700 transition-colors">EBLive 2.0 (New Implementation)</SafeLink>
          <SafeLink href="/scrapers/eblive_py_ui" className="px-4 py-2 bg-orange-600 text-white rounded-md text-center font-semibold shadow hover:bg-orange-700 transition-colors">EBLive Python Scraper (New)</SafeLink>
          <SafeLink href="/scrapers/eblive" className="px-4 py-2 bg-purple-600 text-white rounded-md text-center font-semibold shadow hover:bg-purple-700 transition-colors">EBLive</SafeLink>
          <SafeLink href="/scrapers/festileaks" className="px-4 py-2 bg-blue-600 text-white rounded-md text-center font-semibold shadow hover:bg-blue-700 transition-colors">Festileaks</SafeLink>
          <SafeLink href="/scrapers/festivalinfo" className="px-4 py-2 bg-green-600 text-white rounded-md text-center font-semibold shadow hover:bg-green-700 transition-colors">Festivalinfo</SafeLink>
          {/* Add more planned scrapers as needed */}
        </div>
      </div>
    </div>
  );
} 