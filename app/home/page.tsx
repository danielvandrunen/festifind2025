'use client';

import React, { useEffect, useRef } from 'react';
import { Calendar, Wrench, Settings, Database } from 'lucide-react';
import Link from 'next/link';
import { useFestival } from '../contexts/FestivalContext';

export default function Home() {
  const { 
    festivals, 
    loading, 
    loadingProgress,
    fetchFestivals,
    fetchFestivalsWithResearch 
  } = useFestival();
  
  // Track if we've already done the initial research fetch
  const initialResearchFetchDone = useRef(false);
  
  // Trigger festival loading immediately when the app starts
  useEffect(() => {
    const initialLoad = async () => {
      try {
        console.log('Home page: useEffect triggered');
        console.log('Home page: festivals.length =', festivals.length);
        console.log('Home page: loading =', loading);
        
        // Start loading festivals immediately if we don't have any
        if (festivals.length === 0 && !loading) {
          console.log('Home page: Starting festival loading...');
          await fetchFestivals();
        }
        
        // Only fetch research data ONCE on initial load if we have festivals loaded
        if (festivals.length > 0 && !loading && !initialResearchFetchDone.current) {
          console.log('Initial load complete, fetching research data once...');
          initialResearchFetchDone.current = true;
          await fetchFestivalsWithResearch(); // Fetch research data on initial load
        }
      } catch (error) {
        console.error('Error during initial load:', error);
      }
    };

    initialLoad();

    // DISABLED: No more periodic refresh to prevent excessive API calls
    // The research data will only be fetched once on initial load
    // Users can manually refresh if needed
    
  }, [festivals.length, loading, fetchFestivals]); // Removed fetchFestivalsWithResearch from dependencies
  
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-4 hidden">Welcome to FestiFind</h1>
      
      <p className="text-lg mb-6 hidden">
        Your ultimate tool for tracking and discovering festivals around the world.
      </p>
      
      {/* Festival Loading Progress */}
      {loadingProgress && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            <Database className="h-6 w-6 text-blue-500 mr-3" />
            Loading Festival Database
          </h2>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Loading festivals...
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {loadingProgress.percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress.percentage}%` }}
                ></div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {loadingProgress.loaded.toLocaleString()} of {loadingProgress.total.toLocaleString()} festivals loaded
              </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Please wait while we load the festival database. This may take a few moments...
            </p>
          </div>
        </section>
      )}
      
      {/* Festival Statistics Dashboard */}
      {!loadingProgress && festivals.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-6">Festival Statistics</h2>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {festivals.length.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Festivals</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {(() => {
                    // Deduplicate festivals based on similar names
                    const uniqueFestivals = festivals.filter((festival, index, arr) => {
                      const festivalName = festival.name?.toLowerCase().trim() || '';
                      if (!festivalName) return true;
                      
                      // Check if there's an earlier festival with a similar name
                      return !arr.slice(0, index).some(other => {
                        const otherName = other.name?.toLowerCase().trim() || '';
                        if (!otherName) return false;
                        
                        // Simple similarity check: if names are very similar or one contains the other
                        return festivalName === otherName || 
                               festivalName.includes(otherName) || 
                               otherName.includes(festivalName);
                      });
                    });
                    return uniqueFestivals.length.toLocaleString();
                  })()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Festivals Filtered</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {festivals.filter(f => f.favorite && !f.archived).length.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Favorites</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Festivals Per Month Chart */}
      {!loadingProgress && festivals.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-6">Festivals Per Month (Deduplicated)</h2>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            {(() => {
              // Apply same deduplication logic
              const uniqueFestivals = festivals.filter((festival, index, arr) => {
                const festivalName = festival.name?.toLowerCase().trim() || '';
                if (!festivalName) return true;
                
                return !arr.slice(0, index).some(other => {
                  const otherName = other.name?.toLowerCase().trim() || '';
                  if (!otherName) return false;
                  
                  return festivalName === otherName || 
                         festivalName.includes(otherName) || 
                         otherName.includes(festivalName);
                });
              });

              // Group by month
              const monthCounts = uniqueFestivals.reduce((acc, festival) => {
                if (festival.start_date) {
                  try {
                    const date = new Date(festival.start_date);
                    const month = date.getMonth(); // 0-11
                    acc[month] = (acc[month] || 0) + 1;
                  } catch (e) {
                    // Invalid date, skip
                  }
                }
                return acc;
              }, {});

              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const maxCount = Math.max(...(Object.values(monthCounts) as number[]), 1);

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-2">
                    {months.map((month, index) => {
                      const count = monthCounts[index] || 0;
                      const height = Math.max((count / maxCount) * 100, count > 0 ? 5 : 0);
                      
                      return (
                        <div key={month} className="flex flex-col items-center space-y-2">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-t relative" style={{ height: '120px' }}>
                            <div 
                              className="absolute bottom-0 w-full bg-blue-500 dark:bg-blue-400 rounded-t transition-all duration-300"
                              style={{ height: `${height}%` }}
                            ></div>
                          </div>
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{month}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Showing {uniqueFestivals.filter(f => f.start_date).length.toLocaleString()} festivals with valid dates
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* Sales Funnel Visualization */}
      {!loadingProgress && festivals.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-6">Sales Funnel</h2>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            {(() => {
              // Sales stages in funnel order
              const salesStages = [
                { id: 'favorited', title: 'Favorited', color: 'bg-gray-500' },
                { id: 'outreach', title: 'Outreach', color: 'bg-red-500' },
                { id: 'talking', title: 'Talking', color: 'bg-orange-500' },
                { id: 'offer', title: 'Offer', color: 'bg-yellow-500' },
                { id: 'deal', title: 'Deal', color: 'bg-green-500' }
              ];

              // Count festivals in each stage
              const stageCounts = salesStages.map(stage => {
                let count = 0;
                if (stage.id === 'favorited') {
                  count = festivals.filter(f => f.favorite === true && (!f.sales_stage || f.sales_stage === 'favorited')).length;
                } else {
                  count = festivals.filter(f => f.sales_stage === stage.id).length;
                }
                return { ...stage, count };
              });

              const totalFestivals = stageCounts.reduce((sum, stage) => sum + stage.count, 0);
              const maxCount = Math.max(...stageCounts.map(s => s.count), 1);

              return (
                <div className="space-y-6">
                  <div className="space-y-4">
                    {stageCounts.map((stage, index) => {
                      const percentage = totalFestivals > 0 ? (stage.count / totalFestivals * 100) : 0;
                      const width = maxCount > 0 ? (stage.count / maxCount * 100) : 0;
                      
                      return (
                        <div key={stage.id} className="relative">
                          {/* Stage bar */}
                          <div className="flex items-center space-x-4">
                            <div className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300">
                              {stage.title}
                            </div>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-8 relative overflow-hidden">
                              <div 
                                className={`h-full ${stage.color} transition-all duration-500 rounded-full flex items-center justify-end pr-3`}
                                style={{ width: `${Math.max(width, stage.count > 0 ? 10 : 0)}%` }}
                              >
                                <span className="text-white text-sm font-medium">
                                  {stage.count}
                                </span>
                              </div>
                            </div>
                            <div className="w-16 text-sm text-gray-600 dark:text-gray-400 text-right">
                              {percentage.toFixed(1)}%
                            </div>
                          </div>
                          
                          {/* Connector line to next stage */}
                          {index < stageCounts.length - 1 && (
                            <div className="ml-12 mt-2 mb-2">
                              <div className="w-8 border-l-2 border-gray-300 dark:border-gray-600 h-4 border-dashed"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Summary */}
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {totalFestivals.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total in Pipeline</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                          {stageCounts.filter(s => ['talking', 'offer'].includes(s.id)).reduce((sum, s) => sum + s.count, 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Active Negotiations</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {stageCounts.find(s => s.id === 'deal')?.count || 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Closed Deals</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {totalFestivals > 0 ? ((stageCounts.find(s => s.id === 'deal')?.count || 0) / totalFestivals * 100).toFixed(1) : 0}%
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Conversion Rate</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* Monthly Sales State Distribution */}
      {!loadingProgress && festivals.length > 0 && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-6">Monthly Sales State Distribution</h2>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            {(() => {
              // Sales stages with colors (same as funnel)
              const salesStages = [
                { id: 'favorited', title: 'Favorited', color: 'bg-gray-500', colorClass: 'bg-gray-500' },
                { id: 'outreach', title: 'Outreach', color: 'bg-red-500', colorClass: 'bg-red-500' },
                { id: 'talking', title: 'Talking', color: 'bg-orange-500', colorClass: 'bg-orange-500' },
                { id: 'offer', title: 'Offer', color: 'bg-yellow-500', colorClass: 'bg-yellow-500' },
                { id: 'deal', title: 'Deal', color: 'bg-green-500', colorClass: 'bg-green-500' }
              ];

              // Group festivals by month and sales stage
              const monthlyData = {};
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              
              // Initialize monthlyData
              months.forEach((month, index) => {
                monthlyData[index] = {
                  month: month,
                  favorited: 0,
                  outreach: 0,
                  talking: 0,
                  offer: 0,
                  deal: 0,
                  total: 0
                };
              });

              // Count festivals by month and sales stage
              festivals.forEach(festival => {
                if (festival.start_date) {
                  try {
                    const date = new Date(festival.start_date);
                    const monthIndex = date.getMonth();
                    
                    let salesStage: string | null = null;
                    if (festival.sales_stage && festival.sales_stage !== 'favorited') {
                      // Festival is in active sales stage
                      salesStage = festival.sales_stage;
                    } else if (festival.favorite === true) {
                      // Festival is favorited but not in active sales
                      salesStage = 'favorited';
                    }
                    // If festival is not favorited and has no sales stage, don't count it
                    
                    if (salesStage && monthlyData[monthIndex]) {
                      monthlyData[monthIndex][salesStage]++;
                      monthlyData[monthIndex].total++;
                    }
                  } catch (e) {
                    // Invalid date, skip
                  }
                }
              });

              // Find the maximum total for scaling
              const maxTotal = Math.max(...Object.values(monthlyData).map((m: any) => m.total), 1);

              return (
                <div className="space-y-6">
                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-4 mb-6">
                    {salesStages.map(stage => (
                      <div key={stage.id} className="flex items-center space-x-2">
                        <div className={`w-4 h-4 ${stage.colorClass} rounded`}></div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{stage.title}</span>
                      </div>
                    ))}
                  </div>

                  {/* Stacked Bar Chart */}
                  <div className="grid grid-cols-12 gap-2">
                    {months.map((month, index) => {
                      const data = monthlyData[index];
                      const height = maxTotal > 0 ? Math.max((data.total / maxTotal) * 200, data.total > 0 ? 10 : 0) : 0;
                      
                      return (
                        <div key={month} className="flex flex-col items-center space-y-2">
                          <div 
                            className="w-full bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden flex flex-col-reverse"
                            style={{ height: '200px' }}
                          >
                            {data.total > 0 && (
                              <>
                                {/* Deal (Green) - Bottom */}
                                {data.deal > 0 && (
                                  <div 
                                    className="w-full bg-green-500 transition-all duration-300"
                                    style={{ height: `${(data.deal / data.total) * height}px` }}
                                    title={`${data.deal} Deal${data.deal !== 1 ? 's' : ''}`}
                                  ></div>
                                )}
                                
                                {/* Offer (Yellow) */}
                                {data.offer > 0 && (
                                  <div 
                                    className="w-full bg-yellow-500 transition-all duration-300"
                                    style={{ height: `${(data.offer / data.total) * height}px` }}
                                    title={`${data.offer} Offer${data.offer !== 1 ? 's' : ''}`}
                                  ></div>
                                )}
                                
                                {/* Talking (Orange) */}
                                {data.talking > 0 && (
                                  <div 
                                    className="w-full bg-orange-500 transition-all duration-300"
                                    style={{ height: `${(data.talking / data.total) * height}px` }}
                                    title={`${data.talking} Talking`}
                                  ></div>
                                )}
                                
                                {/* Outreach (Red) */}
                                {data.outreach > 0 && (
                                  <div 
                                    className="w-full bg-red-500 transition-all duration-300"
                                    style={{ height: `${(data.outreach / data.total) * height}px` }}
                                    title={`${data.outreach} Outreach`}
                                  ></div>
                                )}
                                
                                {/* Favorited (Gray) - Top */}
                                {data.favorited > 0 && (
                                  <div 
                                    className="w-full bg-gray-500 transition-all duration-300"
                                    style={{ height: `${(data.favorited / data.total) * height}px` }}
                                    title={`${data.favorited} Favorited`}
                                  ></div>
                                )}
                              </>
                            )}
                          </div>
                          
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400">{month}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">{data.total}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary Statistics */}
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Monthly breakdown of {festivals.filter(f => f.start_date).length.toLocaleString()} festivals with valid dates
                    </div>
                    
                    {/* Most active months */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      {(() => {
                        const sortedMonths = Object.entries(monthlyData)
                          .map(([index, data]: [string, any]) => ({ index: parseInt(index), ...(data as any) }))
                          .sort((a: any, b: any) => b.total - a.total)
                          .slice(0, 3);
                        
                        return sortedMonths.map((monthData: any, rank: number) => (
                          <div key={monthData.index}>
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {monthData.month}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {monthData.total} festivals
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              #{rank + 1} most active
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
              </div>
            </div>
              );
            })()}
          </div>
        </section>
      )}
      
      {/* Loading State */}
      {!loadingProgress && loading && (
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-6">Festival Statistics</h2>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
            </div>
          </div>
        </section>
      )}
      
      {/* Quick Links Section */}
      <section className="mt-12 hidden">
        <h2 className="text-2xl font-semibold mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/festivals" className="block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <Calendar className="h-6 w-6 text-blue-500 mr-3" />
              <h3 className="text-xl font-semibold">Festivals</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">Browse and manage your festival collection</p>
            {festivals.length > 0 && (
              <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                {festivals.length.toLocaleString()} festivals available
              </div>
            )}
          </Link>
          
          <Link href="/scrapers" className="block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <Wrench className="h-6 w-6 text-blue-500 mr-3" />
              <h3 className="text-xl font-semibold">Import Data</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">Manage data collection from various sources</p>
          </Link>
          
          <Link href="/settings" className="block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center mb-4">
              <Settings className="h-6 w-6 text-blue-500 mr-3" />
              <h3 className="text-xl font-semibold">Settings</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">Configure your preferences and sources</p>
          </Link>
        </div>
      </section>
    </div>
  );
} 