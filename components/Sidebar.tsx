'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Calendar, Wrench, Settings, Home, BarChart, Code, Puzzle, LogOut, User } from 'lucide-react';
import { useAuth } from '../app/contexts/AuthContext';
import SafeLink from './SafeLink';

const Sidebar = () => {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  const navItems = [
    { name: 'Home', href: '/home', icon: Home },
    { name: 'Festivals', href: '/festivals', icon: Calendar },
    { name: 'Sales Monitor', href: '/sales-monitor', icon: BarChart },
    { name: 'Extension Feed', href: '/extension-feed', icon: Puzzle },
    { name: 'Dev Tools', href: '/dev-tools', icon: Code },
  ];

  return (
    <div className="w-64 bg-white dark:bg-gray-800 shadow-md min-h-screen p-4 hidden md:block">
      <div className="flex items-center justify-center mb-8 pt-4">
        <img 
          src="/logo.svg" 
          alt="FestiFind" 
          className="h-12 w-auto"
        />
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <SafeLink
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 py-3 text-sm rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <item.icon className={`h-5 w-5 mr-3 ${isActive ? 'text-blue-600 dark:text-blue-300' : ''}`} />
              {item.name}
            </SafeLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="mt-auto pt-8 border-t border-gray-200 dark:border-gray-700">
        {user && (
          <div className="mb-4">
            <div className="flex items-center px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
              <User className="h-4 w-4 mr-2" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        )}
        
        <button
          onClick={signOut}
          className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md transition-colors"
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sign Out
        </button>
      </div>

      {/* Mobile navigation (shown on smaller screens) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 shadow-up p-2 md:hidden flex justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <SafeLink
              key={item.name}
              href={item.href}
              className={`p-2 rounded-md flex flex-col items-center ${
                isActive
                  ? 'text-blue-600 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs mt-1">{item.name}</span>
            </SafeLink>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar; 