import { useState } from 'react';

export default function FestivalScraperDashboard({
  festivals = [],
  totalCount = 0,
  stats = { countryCount: 0, cityCount: 0 },
  loading = false,
  supabaseStatus = { available: false, configured: false },
  onRunScraper,
  onUploadToSupabase,
  onRefresh
}) {
  const [maxPages, setMaxPages] = useState(2);
  const [headless, setHeadless] = useState(true);

  return (
    <div className="festival-dashboard">
      <div className="control-panel">
        <div className="row">
          <div className="column">
            <h4>Scrape Data</h4>
            <form onSubmit={(e) => {
              e.preventDefault();
              onRunScraper({ maxPages, headless });
            }}>
              <div className="form-group">
                <label htmlFor="max_pages">Max Pages</label>
                <input 
                  type="number" 
                  id="max_pages" 
                  min="1" 
                  max="41" 
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  className="form-control"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="headless">Browser Mode</label>
                <select 
                  id="headless" 
                  value={headless.toString()}
                  onChange={(e) => setHeadless(e.target.value === "true")}
                  className="form-control"
                >
                  <option value="true">Headless (hidden)</option>
                  <option value="false">Visible</option>
                </select>
              </div>
              
              <button type="submit" className="btn btn-scrape" disabled={loading}>
                {loading ? 'Running...' : 'Run Scraper'}
              </button>
            </form>
          </div>
          
          <div className="column">
            <h4>Upload to Supabase</h4>
            <p>
              Status: 
              {supabaseStatus.available ? (
                <span className="badge success">Library Available</span>
              ) : (
                <span className="badge error">Library Not Found</span>
              )}
              
              {supabaseStatus.configured ? (
                <span className="badge success">Credentials Set</span>
              ) : (
                <span className="badge error">Credentials Missing</span>
              )}
            </p>
            
            <button 
              onClick={onUploadToSupabase}
              disabled={!supabaseStatus.available || !supabaseStatus.configured || loading}
              className={`btn ${supabaseStatus.available && supabaseStatus.configured ? 'btn-upload' : 'btn-disabled'}`}
            >
              Upload to Supabase
            </button>
            
            {!supabaseStatus.available && (
              <p className="help-text">Install supabase package: <code>pip install supabase</code></p>
            )}
            
            {!supabaseStatus.configured && (
              <p className="help-text">Set SUPABASE_URL and SUPABASE_KEY environment variables</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="statistics">
        <h4>Statistics</h4>
        <div className="stat-cards">
          <div className="stat-card">
            <h5>Total Festivals</h5>
            <p className="stat-value">{totalCount}</p>
          </div>
          <div className="stat-card">
            <h5>Countries</h5>
            <p className="stat-value">{stats.countryCount}</p>
          </div>
          <div className="stat-card">
            <h5>Cities</h5>
            <p className="stat-value">{stats.cityCount}</p>
          </div>
        </div>
      </div>
      
      <div className="table-container">
        <div className="table-header">
          <h3>Festival Data ({totalCount} records)</h3>
          <button onClick={onRefresh} className="btn btn-refresh" disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
        
        {loading ? (
          <div className="loading">Loading festival data...</div>
        ) : festivals.length > 0 ? (
          <table className="festival-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>City</th>
                <th>Country</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Edition</th>
              </tr>
            </thead>
            <tbody>
              {festivals.map((festival, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    {festival.url ? (
                      <a href={festival.url} target="_blank" rel="noopener noreferrer">
                        {festival.name}
                      </a>
                    ) : (
                      festival.name
                    )}
                  </td>
                  <td>{festival.city || 'N/A'}</td>
                  <td>{festival.country_code || 'N/A'}</td>
                  <td>{festival.start_date || 'N/A'}</td>
                  <td>{festival.end_date || 'N/A'}</td>
                  <td>{festival.edition || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">
            No festival data found. Run the scraper to collect data.
          </div>
        )}
      </div>
      
      <style jsx>{`
        .festival-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .control-panel {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .row {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
        }
        
        .column {
          flex: 1;
          min-width: 300px;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        .form-control {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
        }
        
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
          font-size: 16px;
          transition: background-color 0.2s;
        }
        
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .btn-scrape {
          background-color: #6c757d;
          color: white;
        }
        
        .btn-upload {
          background-color: #28a745;
          color: white;
        }
        
        .btn-disabled {
          background-color: #dc3545;
          color: white;
        }
        
        .btn-refresh {
          background-color: #007bff;
          color: white;
          padding: 6px 12px;
          font-size: 14px;
        }
        
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          margin: 0 5px;
          color: white;
        }
        
        .badge.success {
          background-color: #28a745;
        }
        
        .badge.error {
          background-color: #dc3545;
        }
        
        .help-text {
          margin-top: 8px;
          font-size: 14px;
          color: #666;
        }
        
        .statistics {
          margin-bottom: 30px;
        }
        
        .stat-cards {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
        }
        
        .stat-card {
          flex: 1;
          min-width: 200px;
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          text-align: center;
        }
        
        .stat-card h5 {
          margin-top: 0;
          font-size: 18px;
          color: #666;
        }
        
        .stat-value {
          font-size: 48px;
          font-weight: bold;
          margin: 10px 0 0;
          color: #333;
        }
        
        .table-container {
          margin-top: 30px;
          overflow-x: auto;
        }
        
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .festival-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #ddd;
          background-color: white;
        }
        
        .festival-table th,
        .festival-table td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        
        .festival-table th {
          background-color: #343a40;
          color: white;
        }
        
        .festival-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        .festival-table tr:hover {
          background-color: #f1f1f1;
        }
        
        .loading,
        .no-data {
          padding: 30px;
          text-align: center;
          background-color: #f8f9fa;
          border-radius: 8px;
          color: #666;
        }
      `}</style>
    </div>
  );
} 