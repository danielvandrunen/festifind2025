'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../app/contexts/AuthContext';
import Sidebar from './Sidebar';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

const LayoutWrapper: React.FC<LayoutWrapperProps> = ({ children }) => {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  
  // Routes that should not show the sidebar (landing page, auth pages)
  const publicRoutes = ['/', '/login', '/register', '/auth'];
  const isPublicRoute = pathname ? publicRoutes.includes(pathname) : false;
  
  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
  
  // Protected routes - require authentication
  if (!user) {
    // Redirect to landing page will happen via AuthContext
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }
  
  // Authenticated layout with sidebar
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        {children}
      </main>
    </div>
  );
};

export default LayoutWrapper; 