import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function EBLiveFestivals() {
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/festivals/eblive-static');
        const data = await response.json();
        
        if (data.success) {
          setFestivals(data.festivals);
        } else {
          setError(data.message || 'Failed to load festival data');
        }
      } catch (err) {
        setError('An error occurred while fetching festival data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  return (
    <>
      <Head>
        <title>EBLive Festivals | FestiFind</title>
        <meta name="description" content="Browse EBLive festival data" />
      </Head>
      
      <div style={{ 
        maxWidth: '1000px', 
        margin: '0 auto',
        padding: '40px 20px'
      }}>
        <header style={{ marginBottom: '30px', textAlign: 'center' }}>
          <h1 style={{ color: '#333', marginBottom: '10px' }}>EBLive Festival Data</h1>
          <p style={{ color: '#666' }}>Browse our collection of European festivals</p>
        </header>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading festival data...</p>
          </div>
        ) : error ? (
          <div style={{ 
            backgroundColor: '#fff3f3', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #ffcccc',
            textAlign: 'center',
            color: '#cc0000'
          }}>
            <p>{error}</p>
            <p>Please try again later or contact support if the problem persists.</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: '#666' }}>Showing {festivals.length} festivals</p>
              <Link 
                href="/scraper-eblive" 
                style={{ color: '#4285F4', textDecoration: 'none' }}
              >
                About this data
              </Link>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {festivals.map(festival => (
                <div key={festival.id} style={{ 
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  transition: 'transform 0.2s',
                  backgroundColor: 'white',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ padding: '20px', flexGrow: 1 }}>
                    <h2 style={{ 
                      fontSize: '18px', 
                      fontWeight: 'bold',
                      color: '#333', 
                      marginTop: 0,
                      marginBottom: '10px'
                    }}>
                      {festival.name}
                    </h2>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      marginBottom: '10px',
                      color: '#555'
                    }}>
                      <span style={{ marginRight: '10px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="currentColor" />
                        </svg>
                      </span>
                      {festival.location}
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      marginBottom: '15px',
                      color: '#555'
                    }}>
                      <span style={{ marginRight: '10px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3.01 3.9 3.01 5L3 19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19ZM7 10H12V15H7V10Z" fill="currentColor" />
                        </svg>
                      </span>
                      {festival.dateText}
                    </div>
                  </div>
                  
                  <div style={{ 
                    borderTop: '1px solid #eee',
                    padding: '15px 20px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    <a 
                      href={festival.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        color: '#4285F4',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '14px'
                      }}
                    >
                      Visit official website
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginLeft: '5px' }}>
                        <path d="M19 19H5V5H12V3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V12H19V19ZM14 3V5H17.59L7.76 14.83L9.17 16.24L19 6.41V10H21V3H14Z" fill="currentColor" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
} 