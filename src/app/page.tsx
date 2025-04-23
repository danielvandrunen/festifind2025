import React from 'react';
import { supabase } from '../lib/supabase/client';
import Link from 'next/link';

export default async function Home() {
  // Test Supabase connection
  const { count, error } = await supabase
    .from('festivals')
    .select('*', { count: 'exact', head: true });
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center max-w-5xl">
        <h1 className="text-4xl font-bold mb-8">FestiFind</h1>
        <p className="mb-8 text-xl">Your gateway to festivals around the world</p>
        
        <div className="mb-10 grid text-center lg:max-w-5xl lg:grid-cols-2 gap-6">
          <Link href="/festivals" className="group p-8 border rounded-lg hover:shadow-md transition-all">
            <h2 className="mb-3 text-2xl font-semibold">
              Browse Festivals
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="m-0 text-sm opacity-70">
              Find and track upcoming festivals from multiple sources.
            </p>
          </Link>

          <div className="p-8 border rounded-lg">
            <h2 className="mb-3 text-2xl font-semibold">
              Database Status
            </h2>
            <p className="m-0 text-sm">
              {error ? (
                <span className="text-red-500">Error connecting to Supabase: {error.message}</span>
              ) : (
                <span className="text-green-500">Connected successfully! Festival count: {count || 0}</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
} 