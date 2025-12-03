'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { auth } from '../../lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const initialLoadComplete = useRef(false);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { session } = await auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      initialLoadComplete.current = true;
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', {
          event,
          userEmail: session?.user?.email,
          currentPath: pathname,
          initialLoadComplete: initialLoadComplete.current,
          timestamp: new Date().toISOString()
        });
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Only redirect on actual sign-in/sign-out events, not token refresh
        // AND only after initial load is complete to avoid redirects on page load
        if (initialLoadComplete.current) {
          if (event === 'SIGNED_IN' && session?.user) {
            // This is a fresh sign-in from the landing page
            const isOnPublicRoute = pathname ? ['/', '/login', '/register', '/auth'].includes(pathname) : false;
            if (isOnPublicRoute) {
              console.log('🔀 Redirecting to /home due to fresh sign-in on public route');
              router.push('/home');
            } else {
              console.log('🚫 Not redirecting - user signed in but not on public route');
            }
          } else if (event === 'SIGNED_OUT') {
            // User explicitly signed out
            console.log('🔀 Redirecting to / due to sign out');
            router.push('/');
          } else {
            console.log('🔄 Auth event ignored (likely token refresh):', event);
          }
          // TOKEN_REFRESHED and other events will NOT trigger redirects
        } else {
          console.log('⏳ Auth event ignored - initial load not complete yet');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await auth.signIn(email, password);
    
    if (error) {
      setLoading(false);
      return { error };
    }

    // Session will be set by the auth state change listener
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    setLoading(true);
    const { data, error } = await auth.signUp(email, password, fullName);
    
    if (error) {
      setLoading(false);
      return { error };
    }

    // For sign up, user might need to confirm email
    setLoading(false);
    return { error: null };
  };

  const signOut = async () => {
    setLoading(true);
    await auth.signOut();
    // Session will be cleared by the auth state change listener
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 