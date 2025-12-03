import React from 'react';
import './globals.css';
import { StorageProvider } from './contexts/StorageContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { FestivalProvider } from './contexts/FestivalContext';
import { AuthProvider } from './contexts/AuthContext';
import StagewiseToolbarWrapper from '../components/StagewiseToolbar';
import LayoutWrapper from '../components/LayoutWrapper';
import AuthDebugger from '../components/AuthDebugger';

export const metadata = {
  title: 'FestiFind',
  description: 'Track and discover festivals around the world',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <AuthProvider>
          <StorageProvider>
            <NotificationProvider>
              <FestivalProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
                <StagewiseToolbarWrapper />
                <AuthDebugger />
              </FestivalProvider>
            </NotificationProvider>
          </StorageProvider>
        </AuthProvider>
      </body>
    </html>
  );
} 