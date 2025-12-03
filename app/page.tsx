export default function Home() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <main>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Welcome to FestiFind</h1>
          <p style={{ fontSize: '1.25rem', marginBottom: '2rem' }}>Your gateway to festivals around the world</p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <a 
              href="/festivals" 
              style={{ 
                borderRadius: '9999px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                padding: '0.75rem 1.5rem',
                fontWeight: '500',
                textDecoration: 'none'
              }}
            >
              Browse Festivals
            </a>
          </div>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '2rem', 
          marginTop: '3rem' 
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem', 
            borderRadius: '0.5rem', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
            border: '1px solid #eaeaea' 
          }}>
            <h2 style={{ fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.75rem' }}>Discover</h2>
            <p style={{ color: '#666' }}>Find upcoming festivals in your favorite locations around the world.</p>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem', 
            borderRadius: '0.5rem', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
            border: '1px solid #eaeaea' 
          }}>
            <h2 style={{ fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.75rem' }}>Save</h2>
            <p style={{ color: '#666' }}>Bookmark festivals you're interested in and keep track of your plans.</p>
          </div>
          
          <div style={{ 
            backgroundColor: 'white', 
            padding: '1.5rem', 
            borderRadius: '0.5rem', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
            border: '1px solid #eaeaea' 
          }}>
            <h2 style={{ fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.75rem' }}>Share</h2>
            <p style={{ color: '#666' }}>Share festival details with friends and organize your trips together.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
