import Head from 'next/head';
import Link from 'next/link';

export default function EBLiveStaticPage() {
  return (
    <>
      <Head>
        <title>EBLive Festival Data | FestiFind</title>
        <meta name="description" content="EBLive festival static data" />
      </Head>
      
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto',
        padding: '40px 20px' 
      }}>
        <h1 style={{ textAlign: 'center', margin: '20px 0', color: '#333' }}>
          EBLive Festival Data
        </h1>
        
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '30px',
          marginBottom: '30px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
        }}>
          <h2 style={{ color: '#444', marginTop: 0 }}>Static Data Implementation</h2>
          
          <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#555' }}>
            We have replaced the EBLive scraper with a static data implementation. This change was made to improve reliability 
            and performance, while we rebuild our data collection strategy.
          </p>
          
          <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#555' }}>
            The static data includes a curated selection of festivals that have been manually verified for accuracy.
          </p>
          
          <div style={{ 
            backgroundColor: '#f9f9f9',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '20px'
          }}>
            <h3 style={{ color: '#555', marginTop: 0 }}>Features of the Static Implementation:</h3>
            <ul style={{ color: '#555', paddingLeft: '20px' }}>
              <li>Verified festival information</li>
              <li>No runtime dependencies on external websites</li>
              <li>Faster page loading</li>
              <li>More reliable data access</li>
            </ul>
          </div>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <Link
            href="/home"
            style={{ 
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#4285F4',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 'bold'
            }}
          >
            Return to Home
          </Link>
        </div>
      </div>
    </>
  );
} 