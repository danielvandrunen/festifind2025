import './globals.css';
import Navigation from '../components/Navigation';

export const metadata = {
  title: 'FestiFind',
  description: 'Find your next music festival experience',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
} 