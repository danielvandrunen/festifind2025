'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../app/contexts/AuthContext';
import AppSidebar from './Sidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  
  // Development mode bypass for testing - allows access to app without auth
  const isDevelopment = process.env.NODE_ENV === 'development';
  const devBypassRoutes = ['/festivals', '/home', '/settings', '/sales-monitor', '/scrapers', '/dev-tools', '/extension-feed'];
  const shouldBypassAuth = isDevelopment && pathname && devBypassRoutes.some(route => pathname.startsWith(route));
  
  // Routes that should not show the sidebar (landing page, auth pages)
  const publicRoutes = ['/', '/login', '/register', '/auth'];
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false;
  
  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (isPublicRoute) {
    // Full-screen layout for landing page and auth pages
    // If user is already authenticated and on landing page, redirect will happen via AuthContext
    return (
      <div className="min-h-screen">
        {children}
      </div>
    );
  }
  
  // Protected routes - require authentication (bypass in dev mode for testing)
  if (!user && !shouldBypassAuth) {
    // Redirect to landing page will happen via AuthContext
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }
  
  // Authenticated layout with sidebar using SidebarProvider
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col">
          {/* Mobile header with sidebar trigger */}
          <header className="bg-white border-b border-gray-200 px-6 py-4 lg:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-semibold text-gray-900">FestiFind</h1>
            </div>
          </header>

          {/* Main content area */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default LayoutWrapper;
