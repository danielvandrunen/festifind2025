'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  Linkedin, 
  Newspaper, 
  Calendar as CalendarIcon, 
  Building2,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BookOpen,
  RefreshCw,
  Globe,
  AlertTriangle,
  Zap,
  Shield,
  TrendingUp
} from 'lucide-react';

interface ApifyResearchPanelProps {
  festivalId: string;
  festivalName: string;
  festivalUrl?: string | null;
  existingResearchData?: ResearchData | null;
  onLinkedInFound?: (url: string) => Promise<void>;
  onResearchComplete?: (data: ResearchData) => void;
  onCompanyDiscovered?: (companyName: string) => void;
  onResearchStart?: (festivalId: string, abortController: AbortController) => void;
  onResearchEnd?: (festivalId: string, data: ResearchData) => void;
}

interface CompanyDiscoveryResult {
  companyName: string | null;
  kvkNumber: string | null;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  allMatches?: Array<{ name: string; count: number; sources: string[] }>;
  discoveredHomepage?: string | null;
}

interface LinkedInPerson {
  name: string;
  title?: string;
  url: string;
  company?: string;
}

interface LinkedInCompany {
  name: string;
  url: string;
}

interface NewsArticle {
  title: string;
  url: string;
  source?: string;
  date?: string;
  summary?: string;
}

interface CalendarSource {
  name: string;
  found: boolean;
  url?: string;
  editionYear?: number | null;
  isCurrent?: boolean;
}

interface ResearchData {
  companyDiscovery?: {
    companyName: string | null;
    kvkNumber: string | null;
    confidence: 'high' | 'medium' | 'low';
    source?: string;
    allMatches?: Array<{ name: string; count: number; sources: string[] }>;
  };
  linkedin?: {
    people: LinkedInPerson[];
    companies: LinkedInCompany[];
    searchedWith?: string;
  };
  news?: {
    articles: NewsArticle[];
    lastSearched?: string;
  };
  calendarVerification?: {
    sources: CalendarSource[];
    summary?: {
      foundOn: number;
      totalSources: number;
      isActiveOnCalendars: boolean;
    };
  };
  websiteInfo?: {
    homepageUrl?: string;
    discovered?: boolean;
    lastScraped?: string;
  };
}

interface ResearchResult {
  type: 'company' | 'linkedin' | 'news' | 'calendar';
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: any;
  error?: string;
  timestamp?: string;
}

type ResearchStatus = Record<string, ResearchResult>;

// Progress event from orchestrated API
interface OrchestratedProgress {
  type: 'progress' | 'complete';
  phase?: string;
  confidence?: number;
  data?: {
    company?: any;
    linkedin?: { count: number; confidence: number } | null;
    news?: { count: number; confidence: number } | null;
    calendar?: { found: number; total: number; confidence: number } | null;
  };
  warnings?: number;
  errors?: number;
  success?: boolean;
  savedToDatabase?: boolean;
  result?: any;
}

const ApifyResearchPanel: React.FC<ApifyResearchPanelProps> = ({
  festivalId,
  festivalName,
  festivalUrl,
  existingResearchData,
  onLinkedInFound,
  onResearchComplete,
  onCompanyDiscovered,
  onResearchStart,
  onResearchEnd
}) => {
  const [results, setResults] = useState<ResearchStatus>({});
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [discoveredCompany, setDiscoveredCompany] = useState<string | null>(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [researchData, setResearchData] = useState<ResearchData | null>(existingResearchData || null);
  
  // Orchestration state
  const [useOrchestrator, setUseOrchestrator] = useState(true);
  const [orchestratorPhase, setOrchestratorPhase] = useState<string>('');
  const [overallConfidence, setOverallConfidence] = useState<number>(0);
  const [confidenceLevel, setConfidenceLevel] = useState<'high' | 'medium' | 'low'>('low');
  const [warningsCount, setWarningsCount] = useState(0);
  const [errorsCount, setErrorsCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update result for a specific research type
  const updateResult = useCallback((type: string, update: Partial<ResearchResult>) => {
    setResults(prev => ({
      ...prev,
      [type]: { ...prev[type], ...update } as ResearchResult
    }));
  }, []);

  // Save research data to Supabase
  const saveResearchData = useCallback(async (data: Partial<ResearchData>, organizingCompany?: string | null, homepageUrl?: string | null) => {
    try {
      const response = await fetch(`/api/festivals/${festivalId}/research-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          research_data: data,
          organizing_company: organizingCompany,
          homepage_url: homepageUrl,
          merge: true,
        }),
      });

      const result = await response.json();
      if (result.success) {
        console.log('Research data saved successfully');
        setResearchData(prev => ({ ...prev, ...data }));
      } else {
        console.error('Failed to save research data:', result.error);
      }
    } catch (error) {
      console.error('Error saving research data:', error);
    }
  }, [festivalId]);

  // Phase 1: Company Discovery
  const runCompanyDiscovery = useCallback(async (): Promise<CompanyDiscoveryResult | null> => {
    updateResult('company', { type: 'company', status: 'loading' });
    
    try {
      const response = await fetch('/api/research/company-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          festivalId, 
          festivalName, 
          festivalUrl: festivalUrl || undefined 
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const companyData = data.data as CompanyDiscoveryResult;
        
        updateResult('company', { 
          type: 'company', 
          status: 'success', 
          data: companyData,
          timestamp: new Date().toISOString()
        });
        
        if (companyData.companyName) {
          setDiscoveredCompany(companyData.companyName);
          onCompanyDiscovered?.(companyData.companyName);
        }

        // Save company discovery results
        await saveResearchData(
          { 
            companyDiscovery: {
              companyName: companyData.companyName,
              kvkNumber: companyData.kvkNumber,
              confidence: companyData.confidence,
              source: companyData.source,
              allMatches: companyData.allMatches,
            },
            websiteInfo: companyData.discoveredHomepage ? {
              homepageUrl: companyData.discoveredHomepage,
              discovered: true,
              lastScraped: new Date().toISOString(),
            } : undefined,
          },
          companyData.companyName,
          companyData.discoveredHomepage
        );
        
        return companyData;
      } else {
        throw new Error(data.error || 'Failed to discover company');
      }
    } catch (error: any) {
      updateResult('company', { 
        type: 'company', 
        status: 'error', 
        error: error.message 
      });
      return null;
    }
  }, [festivalId, festivalName, festivalUrl, updateResult, onCompanyDiscovered, saveResearchData]);

  // Phase 2a: LinkedIn Research (now people-focused with company info)
  const runLinkedInSearch = useCallback(async (companyName?: string | null) => {
    updateResult('linkedin', { type: 'linkedin', status: 'loading' });
    
    try {
      const response = await fetch('/api/research/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          festivalName, 
          festivalId,
          companyName: companyName || discoveredCompany || undefined,
          festivalUrl: festivalUrl || undefined,
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        updateResult('linkedin', { 
          type: 'linkedin', 
          status: 'success', 
          data: data.results,
          timestamp: data.timestamp
        });
        
        // If company LinkedIn found, offer to save it
        if (data.results.companies?.[0]?.url && onLinkedInFound) {
          await onLinkedInFound(data.results.companies[0].url);
        }

        // Save LinkedIn results
        await saveResearchData({
          linkedin: {
            people: data.results.people || [],
            companies: data.results.companies || [],
            searchedWith: companyName || discoveredCompany || festivalName,
          }
        });
      } else {
        throw new Error(data.error || 'Failed to search LinkedIn');
      }
    } catch (error: any) {
      updateResult('linkedin', { 
        type: 'linkedin', 
        status: 'error', 
        error: error.message 
      });
    }
  }, [festivalName, festivalId, festivalUrl, discoveredCompany, updateResult, onLinkedInFound, saveResearchData]);

  // Phase 2b: News Research
  const runNewsSearch = useCallback(async () => {
    updateResult('news', { type: 'news', status: 'loading' });
    
    try {
      const response = await fetch('/api/research/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          festivalName, 
          festivalId, 
          language: 'nl',
          fetchContent: true, // Enable article content fetching
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        updateResult('news', { 
          type: 'news', 
          status: 'success', 
          data: data.results,
          timestamp: data.timestamp
        });

        // Save news results
        await saveResearchData({
          news: {
            articles: data.results.all || [],
            lastSearched: new Date().toISOString(),
          }
        });
      } else {
        throw new Error(data.error || 'Failed to search news');
      }
    } catch (error: any) {
      updateResult('news', { 
        type: 'news', 
        status: 'error', 
        error: error.message 
      });
    }
  }, [festivalName, festivalId, updateResult, saveResearchData]);

  // Phase 2c: Calendar Verification
  const runCalendarVerification = useCallback(async () => {
    updateResult('calendar', { type: 'calendar', status: 'loading' });
    
    try {
      const response = await fetch('/api/research/calendar-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          festivalName, 
          festivalId, 
          sources: ['all'],
          extractYear: true, // Enable year extraction
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        updateResult('calendar', { 
          type: 'calendar', 
          status: 'success', 
          data: data.result,
          timestamp: data.result?.verifiedAt
        });

        // Save calendar results
        await saveResearchData({
          calendarVerification: {
            sources: data.result.sources || [],
            summary: data.result.summary,
          }
        });
      } else {
        throw new Error(data.error || 'Failed to verify calendars');
      }
    } catch (error: any) {
      updateResult('calendar', { 
        type: 'calendar', 
        status: 'error', 
        error: error.message 
      });
    }
  }, [festivalName, festivalId, updateResult, saveResearchData]);

  // Orchestrated research using self-healing pipeline
  const runOrchestratedResearch = useCallback(async () => {
    if (isRunningPipeline) return;
    
    setIsRunningPipeline(true);
    setOrchestratorPhase('starting');
    setWarningsCount(0);
    setErrorsCount(0);
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    
    // Notify parent that research has started
    onResearchStart?.(festivalId, abortControllerRef.current);
    
    try {
      const response = await fetch('/api/research/orchestrated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          festivalId,
          festivalName,
          festivalUrl: festivalUrl || undefined,
          options: {
            maxRetries: 3,
            enableAIValidation: true,
            parallelExecution: true,
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Research failed: ${response.statusText}`);
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data: OrchestratedProgress = JSON.parse(line.slice(6));
            
            // Update phase
            if (data.phase) {
              setOrchestratorPhase(data.phase);
            }
            
            // Update warnings/errors count
            if (data.warnings !== undefined) setWarningsCount(data.warnings);
            if (data.errors !== undefined) setErrorsCount(data.errors);
            
            // Update confidence
            if (data.confidence !== undefined) {
              setOverallConfidence(data.confidence);
            }
            
            // Update individual results based on progress
            if (data.data?.company) {
              updateResult('company', {
                type: 'company',
                status: 'success',
                data: data.data.company,
              });
              if (data.data.company.name) {
                setDiscoveredCompany(data.data.company.name);
                onCompanyDiscovered?.(data.data.company.name);
              }
            }
            
            if (data.data?.linkedin) {
              updateResult('linkedin', {
                type: 'linkedin',
                status: data.data.linkedin.count > 0 ? 'success' : 'error',
                data: { people: [], companies: [], count: data.data.linkedin.count },
              });
            }
            
            if (data.data?.news) {
              updateResult('news', {
                type: 'news',
                status: data.data.news.count > 0 ? 'success' : 'error',
                data: { articles: [], count: data.data.news.count },
              });
            }
            
            if (data.data?.calendar) {
              updateResult('calendar', {
                type: 'calendar',
                status: data.data.calendar.found > 0 ? 'success' : 'error',
                data: { found: data.data.calendar.found, total: data.data.calendar.total },
              });
            }
            
            // Handle completion
            if (data.type === 'complete' && data.result) {
              const result = data.result;
              
              // Update all results with full data
              if (result.organizingCompany) {
                updateResult('company', {
                  type: 'company',
                  status: 'success',
                  data: result.organizingCompany,
                });
              }
              
              if (result.linkedInResults) {
                updateResult('linkedin', {
                  type: 'linkedin',
                  status: result.linkedInResults.people?.length > 0 ? 'success' : 'error',
                  data: result.linkedInResults,
                });
              }
              
              if (result.newsResults) {
                updateResult('news', {
                  type: 'news',
                  status: result.newsResults.articles?.length > 0 ? 'success' : 'error',
                  data: result.newsResults,
                });
              }
              
              if (result.calendarResults) {
                updateResult('calendar', {
                  type: 'calendar',
                  status: 'success',
                  data: result.calendarResults,
                });
              }
              
              // Update confidence
              setOverallConfidence(result.overallConfidence || 0);
              setConfidenceLevel(result.confidenceLevel || 'low');
              
              // Update research data state
              const newResearchData: ResearchData = {
                companyDiscovery: result.organizingCompany ? {
                  companyName: result.organizingCompany.name,
                  kvkNumber: result.organizingCompany.kvkNumber || null,
                  confidence: result.organizingCompany.confidence >= 0.7 ? 'high' : 
                              result.organizingCompany.confidence >= 0.4 ? 'medium' : 'low',
                } : undefined,
                linkedin: result.linkedInResults ? {
                  people: result.linkedInResults.people || [],
                  companies: [],
                  searchedWith: result.linkedInResults.searchedWith,
                } : undefined,
                news: result.newsResults ? {
                  articles: result.newsResults.articles || [],
                  lastSearched: new Date().toISOString(),
                } : undefined,
                calendarVerification: result.calendarResults ? {
                  sources: result.calendarResults.sources || [],
                  summary: {
                    foundOn: result.calendarResults.sources?.filter((s: any) => s.found).length || 0,
                    totalSources: result.calendarResults.sources?.length || 0,
                    isActiveOnCalendars: result.calendarResults.sources?.some((s: any) => s.isCurrent) || false,
                  },
                } : undefined,
                websiteInfo: result.discoveredHomepage ? {
                  homepageUrl: result.discoveredHomepage,
                  discovered: true,
                  lastScraped: new Date().toISOString(),
                } : undefined,
              };
              
              setResearchData(newResearchData);
              
              // Notify completion
              if (onResearchComplete) {
                onResearchComplete(newResearchData);
              }
              
              // Notify parent that research ended
              onResearchEnd?.(festivalId, newResearchData);
              
              // Notify LinkedIn if found
              if (result.linkedInResults?.people?.[0]?.url && onLinkedInFound) {
                await onLinkedInFound(result.linkedInResults.people[0].url);
              }
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE event:', parseError);
          }
        }
      }
      
      setOrchestratorPhase('completed');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Research aborted');
        setOrchestratorPhase('aborted');
      } else {
        console.error('Orchestrated research failed:', error);
        setOrchestratorPhase('failed');
        
        // Fall back to legacy pipeline
        if (!useOrchestrator) {
          console.log('Falling back to legacy research pipeline...');
          await runLegacyPipeline();
        }
      }
      // Notify parent that research ended (with empty data on failure)
      onResearchEnd?.(festivalId, researchData || {});
    } finally {
      setIsRunningPipeline(false);
      abortControllerRef.current = null;
    }
  }, [isRunningPipeline, festivalId, festivalName, festivalUrl, updateResult, onCompanyDiscovered, onResearchComplete, onLinkedInFound, useOrchestrator, onResearchStart, onResearchEnd, researchData]);

  // Legacy pipeline (fallback)
  const runLegacyPipeline = useCallback(async () => {
    // Phase 1: Company Discovery (sequential - needed for LinkedIn)
    const companyResult = await runCompanyDiscovery();
    
    // Phase 2: Run all other research in parallel
    await Promise.allSettled([
      runLinkedInSearch(companyResult?.companyName),
      runNewsSearch(),
      runCalendarVerification(),
    ]);
    
    // Notify completion
    if (onResearchComplete) {
      onResearchComplete(researchData || {});
    }
  }, [runCompanyDiscovery, runLinkedInSearch, runNewsSearch, runCalendarVerification, onResearchComplete, researchData]);

  // Full research pipeline: Uses orchestrator if available, falls back to legacy
  const runResearchPipeline = useCallback(async () => {
    if (isRunningPipeline) return;
    
    if (useOrchestrator) {
      await runOrchestratedResearch();
    } else {
      setIsRunningPipeline(true);
      try {
        await runLegacyPipeline();
      } finally {
        setIsRunningPipeline(false);
      }
    }
  }, [isRunningPipeline, useOrchestrator, runOrchestratedResearch, runLegacyPipeline]);
  
  // Cancel ongoing research
  const cancelResearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Auto-start research when panel mounts (if no existing data)
  useEffect(() => {
    if (!hasAutoStarted && !existingResearchData) {
      setHasAutoStarted(true);
      runResearchPipeline();
    }
  }, [hasAutoStarted, existingResearchData, runResearchPipeline]);

  // Initialize from existing data
  useEffect(() => {
    if (existingResearchData) {
      setResearchData(existingResearchData);
      
      // Set results as already loaded
      if (existingResearchData.companyDiscovery) {
        setResults(prev => ({
          ...prev,
          company: { type: 'company', status: 'success', data: existingResearchData.companyDiscovery }
        }));
        if (existingResearchData.companyDiscovery.companyName) {
          setDiscoveredCompany(existingResearchData.companyDiscovery.companyName);
        }
      }
      if (existingResearchData.linkedin) {
        setResults(prev => ({
          ...prev,
          linkedin: { type: 'linkedin', status: 'success', data: existingResearchData.linkedin }
        }));
      }
      if (existingResearchData.news) {
        setResults(prev => ({
          ...prev,
          news: { type: 'news', status: 'success', data: existingResearchData.news }
        }));
      }
      if (existingResearchData.calendarVerification) {
        setResults(prev => ({
          ...prev,
          calendar: { type: 'calendar', status: 'success', data: existingResearchData.calendarVerification }
        }));
      }
    }
  }, [existingResearchData]);

  // Render status icon
  const StatusIcon: React.FC<{ status?: string }> = ({ status }) => {
    switch (status) {
      case 'loading':
        return <Loader2 size={14} className="animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle size={14} className="text-green-500" />;
      case 'error':
        return <XCircle size={14} className="text-red-500" />;
      default:
        return null;
    }
  };

  const isAnyLoading = Object.values(results).some(r => r.status === 'loading');

  // Get phase display name
  const getPhaseDisplay = (phase: string): string => {
    const phaseMap: Record<string, string> = {
      'starting': 'Starting...',
      'not_started': 'Ready',
      'discovering_website': 'Finding website...',
      'extracting_company': 'Extracting company...',
      'searching_linkedin': 'Searching LinkedIn...',
      'fetching_news': 'Fetching news...',
      'verifying_calendars': 'Verifying calendars...',
      'validating_results': 'Validating results...',
      'completed': 'Completed',
      'failed': 'Failed',
      'aborted': 'Cancelled',
    };
    return phaseMap[phase] || phase;
  };

  // Confidence badge color
  const getConfidenceColor = (level: 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'high': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Search size={18} className="text-purple-500" />
          <span className="font-medium text-sm">Research Suite</span>
          {useOrchestrator && (
            <Zap size={12} className="text-yellow-500" />
          )}
          {isAnyLoading && (
            <Loader2 size={14} className="animate-spin text-blue-500" />
          )}
          {discoveredCompany && (
            <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-0.5 rounded">
              {discoveredCompany}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {/* Confidence indicator */}
          {overallConfidence > 0 && !isRunningPipeline && (
            <div className="flex items-center space-x-1">
              <TrendingUp size={12} className="text-gray-500" />
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${getConfidenceColor(confidenceLevel)}`}>
                {Math.round(overallConfidence * 100)}%
              </span>
            </div>
          )}
          {/* Warnings/Errors */}
          {(warningsCount > 0 || errorsCount > 0) && !isRunningPipeline && (
            <div className="flex items-center space-x-1 text-[10px]">
              {warningsCount > 0 && (
                <span className="flex items-center text-yellow-600">
                  <AlertTriangle size={10} className="mr-0.5" />
                  {warningsCount}
                </span>
              )}
              {errorsCount > 0 && (
                <span className="flex items-center text-red-600">
                  <XCircle size={10} className="mr-0.5" />
                  {errorsCount}
                </span>
              )}
            </div>
          )}
          {isRunningPipeline ? (
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-gray-500">{getPhaseDisplay(orchestratorPhase)}</span>
              <button
                onClick={cancelResearch}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 flex items-center space-x-1"
              >
                <XCircle size={12} />
                <span>Cancel</span>
              </button>
            </div>
          ) : (
            <button
              onClick={runResearchPipeline}
              disabled={isRunningPipeline}
              className="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              <RefreshCw size={12} />
              <span>Re-run All</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Progress bar during research */}
      {isRunningPipeline && (
        <div className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-300">
            <div className="flex items-center space-x-2">
              <Loader2 size={12} className="animate-spin" />
              <span>{getPhaseDisplay(orchestratorPhase)}</span>
            </div>
            <div className="flex items-center space-x-2">
              {overallConfidence > 0 && (
                <span className="text-[10px] opacity-70">
                  Confidence: {Math.round(overallConfidence * 100)}%
                </span>
              )}
              <Shield size={10} className="opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Research sections */}
      <div className="p-3 space-y-4">
        {/* Company Discovery Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 size={16} className="text-indigo-500" />
              <span className="text-sm font-medium">Organizing Company</span>
              <StatusIcon status={results.company?.status} />
            </div>
            <button
              onClick={() => runCompanyDiscovery()}
              disabled={results.company?.status === 'loading'}
              className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 disabled:opacity-50"
            >
              Discover
            </button>
          </div>
          {results.company?.status === 'success' && results.company.data && (
            <div className="ml-6 text-xs space-y-1 bg-gray-50 dark:bg-gray-750 p-2 rounded">
              {results.company.data.companyName ? (
                <>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {results.company.data.companyName}
                  </div>
                  <div className="text-gray-500">
                    Confidence: {results.company.data.confidence}
                    {results.company.data.kvkNumber && ` • KvK: ${results.company.data.kvkNumber}`}
                  </div>
                  {results.company.data.allMatches?.length > 1 && (
                    <div className="text-gray-400 text-[10px]">
                      Also found: {results.company.data.allMatches.slice(1, 3).map((m: any) => m.name).join(', ')}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-gray-500">No company found on website</span>
              )}
              {results.company.data.discoveredHomepage && (
                <a 
                  href={results.company.data.discoveredHomepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-blue-600 hover:underline"
                >
                  <Globe size={10} className="mr-1" />
                  <span className="truncate max-w-[200px]">Homepage discovered</span>
                </a>
              )}
            </div>
          )}
          {results.company?.status === 'error' && (
            <div className="ml-6 text-xs text-red-500">{results.company.error}</div>
          )}
        </div>

        {/* LinkedIn Research */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Linkedin size={16} className="text-[#0A66C2]" />
              <span className="text-sm font-medium">LinkedIn Connections</span>
              <StatusIcon status={results.linkedin?.status} />
            </div>
            <button
              onClick={() => runLinkedInSearch()}
              disabled={results.linkedin?.status === 'loading'}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
            >
              Search
            </button>
          </div>
          {results.linkedin?.status === 'success' && results.linkedin.data && (
            <div className="ml-6 text-xs space-y-2">
              {/* People */}
              {results.linkedin.data.people?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-gray-500 font-medium">People ({results.linkedin.data.people.length})</div>
                  {results.linkedin.data.people.slice(0, 5).map((person: LinkedInPerson, i: number) => (
                    <a 
                      key={i}
                      href={person.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start text-blue-600 hover:underline"
                    >
                      <ExternalLink size={10} className="mr-1 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">{person.name}</span>
                        {person.title && <span className="text-gray-500 ml-1">• {person.title}</span>}
                      </div>
                    </a>
                  ))}
                </div>
              )}
              {/* Companies */}
              {results.linkedin.data.companies?.length > 0 && (
                <div className="space-y-1">
                  <div className="text-gray-500 font-medium">Companies ({results.linkedin.data.companies.length})</div>
                  {results.linkedin.data.companies.slice(0, 3).map((company: LinkedInCompany, i: number) => (
                    <a 
                      key={i}
                      href={company.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-blue-600 hover:underline"
                    >
                      <ExternalLink size={10} className="mr-1" />
                      {company.name}
                    </a>
                  ))}
                </div>
              )}
              {(!results.linkedin.data.people?.length && !results.linkedin.data.companies?.length) && (
                <span className="text-gray-500">No LinkedIn profiles found</span>
              )}
            </div>
          )}
          {results.linkedin?.status === 'error' && (
            <div className="ml-6 text-xs text-red-500">{results.linkedin.error}</div>
          )}
        </div>

        {/* News Research */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Newspaper size={16} className="text-orange-500" />
              <span className="text-sm font-medium">News & Articles</span>
              <StatusIcon status={results.news?.status} />
            </div>
            <button
              onClick={runNewsSearch}
              disabled={results.news?.status === 'loading'}
              className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
            >
              Search
            </button>
          </div>
          {results.news?.status === 'success' && results.news.data && (
            <div className="ml-6 text-xs space-y-2">
              {(results.news.data.all || results.news.data.articles)?.slice(0, 4).map((article: NewsArticle, i: number) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-750 p-2 rounded space-y-1">
                  <a 
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start text-blue-600 hover:underline font-medium"
                  >
                    <ExternalLink size={10} className="mr-1 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{article.title}</span>
                  </a>
                  {article.summary && (
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-2 pl-4">{article.summary}</p>
                  )}
                  <div className="text-gray-400 text-[10px] pl-4">
                    {article.source && <span>{article.source}</span>}
                    {article.date && <span> • {article.date}</span>}
                  </div>
                </div>
              ))}
              {(!results.news.data.all?.length && !results.news.data.articles?.length) && (
                <span className="text-gray-500">No news articles found</span>
              )}
            </div>
          )}
          {results.news?.status === 'error' && (
            <div className="ml-6 text-xs text-red-500">{results.news.error}</div>
          )}
        </div>

        {/* Calendar Verification */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CalendarIcon size={16} className="text-green-500" />
              <span className="text-sm font-medium">Calendar Sources</span>
              <StatusIcon status={results.calendar?.status} />
            </div>
            <button
              onClick={runCalendarVerification}
              disabled={results.calendar?.status === 'loading'}
              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
            >
              Verify
            </button>
          </div>
          {results.calendar?.status === 'success' && results.calendar.data && (
            <div className="ml-6 text-xs space-y-1">
              <div className="text-gray-600 dark:text-gray-400 font-medium">
                Found on {results.calendar.data.summary?.foundOn || 0}/{results.calendar.data.summary?.totalSources || 7} sources
                {results.calendar.data.summary?.isActiveOnCalendars && (
                  <span className="ml-2 text-green-600">Active</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(results.calendar.data.sources || []).map((source: CalendarSource, i: number) => (
                  <div 
                    key={i} 
                    className={`flex items-center text-[11px] ${source.found ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {source.found ? (
                      <CheckCircle size={10} className="mr-1 flex-shrink-0" />
                    ) : (
                      <XCircle size={10} className="mr-1 flex-shrink-0" />
                    )}
                    <span>{source.name}</span>
                    {source.editionYear && (
                      <span className="ml-1 text-gray-400">({source.editionYear})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {results.calendar?.status === 'error' && (
            <div className="ml-6 text-xs text-red-500">{results.calendar.error}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApifyResearchPanel;
