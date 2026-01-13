import React from 'react';

export default function Settings() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Customize your FestiFind experience</p>
        </div>
        
        {/* Display Preferences */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Display Preferences</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default View</label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input 
                    type="radio" 
                    name="viewMode" 
                    defaultChecked 
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">Card View</span>
                </label>
                <label className="flex items-center">
                  <input 
                    type="radio" 
                    name="viewMode" 
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">Table View</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Show Archived Festivals</label>
              <label className="inline-flex items-center">
                <input 
                  type="checkbox" 
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm">Include archived festivals in list</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Theme</label>
              <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600">
                <option>System Default</option>
                <option>Light Mode</option>
                <option>Dark Mode</option>
              </select>
            </div>
          </div>
        </section>
        
        {/* Festival Sources */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Festival Sources</h2>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Select which sources to include in your festival listings
            </p>
            
            <div className="space-y-2">
              {['Befesti.nl', 'Festileaks', 'Festival Info', 'Partyflock', 'EB Live'].map(source => (
                <label key={source} className="flex items-center">
                  <input 
                    type="checkbox" 
                    defaultChecked
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm">{source}</span>
                </label>
              ))}
            </div>
          </div>
        </section>
        
        {/* Notification Settings */}
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
          
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm">New Festival Alerts</span>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input 
                  type="checkbox" 
                  name="newFestivals" 
                  id="newFestivals" 
                  className="sr-only"
                  defaultChecked
                />
                <label 
                  htmlFor="newFestivals" 
                  className="block h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"
                ></label>
              </div>
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-sm">Scraper Completion</span>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input 
                  type="checkbox" 
                  name="scraperCompletion" 
                  id="scraperCompletion" 
                  className="sr-only"
                  defaultChecked
                />
                <label 
                  htmlFor="scraperCompletion" 
                  className="block h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"
                ></label>
              </div>
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-sm">Favorite Festival Updates</span>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input 
                  type="checkbox" 
                  name="favoriteUpdates" 
                  id="favoriteUpdates" 
                  className="sr-only"
                />
                <label 
                  htmlFor="favoriteUpdates" 
                  className="block h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 cursor-pointer"
                ></label>
              </div>
            </label>
          </div>
        </section>
        
        {/* Save Button */}
        <div className="flex justify-end">
          <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
} 