import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FestiFind',
  description: 'Your gateway to festivals around the world',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="font-bold text-xl">
              <a href="/">FestiFind</a>
            </div>
            <nav>
              <ul className="flex space-x-6">
                <li>
                  <a href="/festivals" className="hover:text-blue-600">Festivals</a>
                </li>
                {/* More navigation items can be added here */}
              </ul>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
} 