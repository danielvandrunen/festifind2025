'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  
  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="font-bold text-xl bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          <Link href="/">FestiFind</Link>
        </div>
        <nav>
          <ul className="flex gap-6">
            <li>
              <Link 
                href="/" 
                className={`py-2 font-medium transition-colors ${
                  pathname === '/' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                Home
              </Link>
            </li>
            <li>
              <Link 
                href="/festivals" 
                className={`py-2 font-medium transition-colors ${
                  pathname === '/festivals' 
                    ? 'text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                Festivals
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
} 