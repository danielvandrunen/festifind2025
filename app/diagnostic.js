'use client';

import { useState, useEffect } from 'react';

export default function DiagnosticPage() {
  const [apiResults, setApiResults] = useState(null);
  const [directResults, setDirectResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function runDiagnostics() {
      setLoading(true);
      try {
        // Check regular API endpoint
        console.log('Checking regular API endpoint...');
        const apiResponse = await fetch('/api/festivals');
        const apiData = await apiResponse.json();
        setApiResults({
          status: apiResponse.status,
          ok: apiResponse.ok,
          data: apiData,
          count: Array.isArray(apiData) ? apiData.length : 'not an array'
        });
        
        // Check diagnostic endpoint
        console.log('Checking diagnostic endpoint...');
        const diagnosticResponse = await fetch('/api/check-supabase');
        const diagnosticData = await diagnosticResponse.json();
        setDirectResults(diagnosticData);
        
      } catch (err) {
        console.error('Error running diagnostics:', err);
        setError(err.toString());
      } finally {
        setLoading(false);
      }
    }
    
    runDiagnostics();
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">FestiFind API Diagnostics</h1>
      
      {loading ? (
        <div className="mb-4 p-4 bg-blue-100 rounded">
          <p>Running diagnostics...</p>
        </div>
      ) : error ? (
        <div className="mb-4 p-4 bg-red-100 rounded">
          <p className="text-red-700">Error: {error}</p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Regular API Response</h2>
            <div className="p-4 bg-gray-100 rounded">
              <p>Status: {apiResults?.status}</p>
              <p>Success: {apiResults?.ok ? 'Yes' : 'No'}</p>
              <p>Festivals count: {apiResults?.count}</p>
              <div className="mt-4">
                <p className="font-semibold">Data preview:</p>
                <pre className="bg-gray-200 p-2 mt-2 overflow-auto max-h-60 rounded">
                  {JSON.stringify(apiResults?.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Supabase Direct Check</h2>
            <div className="p-4 bg-gray-100 rounded">
              <p>Environment: {directResults?.environment}</p>
              <p>Timestamp: {directResults?.timestamp}</p>
              <p>Supabase URL: {directResults?.supabaseUrl}</p>
              <p>Key (first chars): {directResults?.supabaseAnonKeyFirstChars}</p>
              
              <div className="mt-4">
                <p className="font-semibold">Test Results:</p>
                {directResults?.tests?.map((test, index) => (
                  <div key={index} className={`mt-2 p-3 rounded ${test.success ? 'bg-green-100' : 'bg-red-100'}`}>
                    <p className="font-medium">{test.name}: {test.success ? '✓ Success' : '✗ Failed'}</p>
                    {test.data && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Data:</p>
                        <pre className="bg-white p-2 text-xs mt-1 overflow-auto max-h-40 rounded">
                          {JSON.stringify(test.data, null, 2)}
                        </pre>
                      </div>
                    )}
                    {test.error && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-700">Error:</p>
                        <pre className="bg-white p-2 text-xs mt-1 overflow-auto max-h-40 rounded">
                          {JSON.stringify(test.error, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Environment Variables</h2>
            <div className="p-4 bg-gray-100 rounded">
              <p>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set'}</p>
              <p>NEXT_PUBLIC_SUPABASE_ANON_KEY present: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Yes' : 'No'}</p>
              <p>NODE_ENV: {process.env.NODE_ENV || 'not set'}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 