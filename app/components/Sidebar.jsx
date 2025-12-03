'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Home,
  Menu,
  Music,
  X,
  BarChart,
  Puzzle,
  Code
} from 'lucide-react';

const scraperItems = [
  { name: 'Partyflock', href: '/scrapers/partyflock', icon: Bot },
  { name: 'EBLive', href: '/scrapers/eblive', icon: Bot },
];

const navigationItems = [
  { name: 'Dashboard', href: '/home', icon: Home },
  { name: 'Festivals', href: '/festivals', icon: Music },
  { name: 'Sales Monitor', href: '/sales-monitor', icon: BarChart },
  { name: 'Extension Feed', href: '/extension-feed', icon: Puzzle },
  { name: 'Dev Tools', href: '/dev-tools', icon: Code },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrapersOpen, setIsScrapersOpen] = useState(false);

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleScrapers = () => setIsScrapersOpen(!isScrapersOpen);

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-blue-600 text-white p-2 rounded-md"
        onClick={toggleSidebar}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-5 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-blue-600">FestiFind</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {navigationItems.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center px-4 py-2 rounded-md text-gray-700 hover:bg-blue-50 hover:text-blue-700",
                      pathname === item.href && "bg-blue-100 text-blue-700 font-medium"
                    )}
                  >
                    <item.icon size={20} className="mr-3" />
                    {item.name}
                  </Link>
                </li>
              ))}

              {/* Scrapers section with dropdown */}
              <li>
                <button
                  onClick={toggleScrapers}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2 rounded-md text-gray-700 hover:bg-blue-50 hover:text-blue-700",
                    pathname.startsWith('/scrapers') && "bg-blue-100 text-blue-700 font-medium"
                  )}
                >
                  <div className="flex items-center">
                    <Bot size={20} className="mr-3" />
                    Scrapers
                  </div>
                  {isScrapersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isScrapersOpen && (
                  <ul className="ml-8 mt-1 space-y-1">
                    {scraperItems.map((item) => (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center px-4 py-2 rounded-md text-gray-700 hover:bg-blue-50 hover:text-blue-700",
                            pathname === item.href && "bg-blue-100 text-blue-700 font-medium"
                          )}
                        >
                          <item.icon size={16} className="mr-2" />
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">© 2025 FestiFind</p>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
    </>
  );
} 