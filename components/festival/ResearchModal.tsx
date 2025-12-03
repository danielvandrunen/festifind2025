import React, { useEffect, useState } from 'react';
import { X, Printer, RefreshCw, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useFestival } from '../../app/contexts/FestivalContext';

interface ResearchModalProps {
  festivalId: string;
  festivalName: string;
  isOpen: boolean;
  onClose: () => void;
}

const ResearchModal: React.FC<ResearchModalProps> = ({
  festivalId,
  festivalName,
  isOpen,
  onClose
}) => {
  const { updateEmails } = useFestival();
  const [researchData, setResearchData] = useState<{
    research_log: string;
    status: 'pending' | 'complete' | 'failed';
    updated_at?: string;
    created_at?: string;
    id?: string;
    ai_service?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasExtractedEmails, setHasExtractedEmails] = useState(false);
  
  useEffect(() => {
    if (isOpen && festivalId) {
      fetchResearchData();
    } else {
      // Reset state when modal closes
      setResearchData(null);
      setIsLoading(true);
      setError(null);
      setHasExtractedEmails(false);
    }
  }, [isOpen, festivalId]);
  
  // Extract email addresses from research content
  const extractEmailsFromResearch = (researchContent: string): string[] => {
    const emails: string[] = [];
    
    try {
      // Look for email pattern in the KEY BUSINESS INFORMATION section
      const emailRegex = /(?:📧|email).*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
      let match;
      
      while ((match = emailRegex.exec(researchContent)) !== null) {
        const email = match[1].toLowerCase().trim();
        if (email && !emails.includes(email)) {
          emails.push(email);
        }
      }
      
      // Also look for standalone email patterns in the content
      const standaloneEmailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
      let standaloneMatch;
      
      while ((standaloneMatch = standaloneEmailRegex.exec(researchContent)) !== null) {
        const email = standaloneMatch[0].toLowerCase().trim();
        if (email && !emails.includes(email)) {
          emails.push(email);
        }
      }
      
      console.log('Extracted emails from research:', emails);
      return emails;
    } catch (error) {
      console.error('Error extracting emails:', error);
      return [];
    }
  };

  // Auto-populate emails from research content
  const autoPopulateEmails = async (emails: string[]) => {
    if (emails.length === 0) return;
    
    try {
      console.log(`🔄 Auto-populating ${emails.length} emails for festival ${festivalId}:`, emails);
      
      for (const email of emails) {
        try {
          // Use the context's updateEmails function for immediate UI update
          await updateEmails(festivalId, email);
          console.log(`✅ Successfully added email via context: ${email}`);
        } catch (error) {
          console.error(`❌ Error adding email ${email}:`, error);
        }
      }
      
      console.log(`🎉 Completed auto-populating emails for ${festivalName}`);
    } catch (error) {
      console.error('Error auto-populating emails:', error);
    }
  };

  const fetchResearchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/festivals/${festivalId}/research`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch research: ${response.statusText}`);
      }
      
      const data = await response.json();
      setResearchData(data);
      
      // Auto-extract and populate emails if research is complete and we haven't done it yet
      if (data.status === 'complete' && data.research_log && !hasExtractedEmails) {
        const extractedEmails = extractEmailsFromResearch(data.research_log);
        if (extractedEmails.length > 0) {
          await autoPopulateEmails(extractedEmails);
          setHasExtractedEmails(true);
        }
      }
    } catch (error) {
      console.error('Error fetching research data:', error);
      setError('Failed to load research data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePrint = () => {
    if (!researchData?.research_log) return;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    // Create formatted HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Festival Research: ${festivalName}</title>
          <style>
            @media print {
              @page {
                size: A4;
                margin: 1.5cm;
              }
              
              h1 { 
                page-break-after: avoid; 
                margin-top: 0;
                padding-top: 0;
              }
              h2 { page-break-after: avoid; }
              h3, h4 { page-break-after: avoid; }
              ul, ol, table { page-break-inside: avoid; }
              img { max-width: 100%; page-break-inside: avoid; }
              hr { page-break-after: avoid; }
              blockquote { page-break-inside: avoid; }
              .key-business-info { page-break-inside: avoid; }
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              color: #333;
              background-color: #fff;
              font-size: 16px;
            }
            
            h1 { 
              font-size: 2.5rem; 
              font-weight: 700;
              margin-bottom: 0.5rem; 
              color: #111;
              text-align: center;
              letter-spacing: -0.03em;
              line-height: 1.2;
            }
            
            h2 { 
              font-size: 1.5rem; 
              font-weight: 700;
              margin-top: 2rem; 
              margin-bottom: 1rem; 
              color: #111;
              letter-spacing: -0.02em;
            }
            
            h3 { 
              font-size: 1.25rem; 
              font-weight: 600;
              margin-top: 1.5rem;
              margin-bottom: 0.75rem;
              color: #111; 
              letter-spacing: -0.01em;
            }
            
            p { 
              margin-bottom: 1rem; 
              line-height: 1.6;
            }
            
            ul, ol { 
              margin-bottom: 1.5rem;
              padding-left: 1.5rem;
            }
            
            li { 
              margin-bottom: 0.5rem;
              line-height: 1.6;
            }
            
            strong {
              font-weight: 600;
              color: #111;
            }
            
            .header { 
              margin-bottom: 2rem;
              text-align: center;
            }
            
            .footer { 
              margin-top: 3rem; 
              font-size: 0.875rem; 
              color: #888; 
              text-align: center;
              padding-top: 1rem;
              border-top: 1px solid #eee;
            }
            
            a {
              color: #3182ce;
              text-decoration: none;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 1.5rem 0;
              font-size: 0.95rem;
            }
            
            th, td {
              padding: 0.75rem;
              border: 1px solid #e2e8f0;
            }
            
            th {
              background-color: #f7fafc;
              font-weight: 600;
              text-align: left;
            }
            
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            
            blockquote {
              border-left: 3px solid #e2e8f0;
              padding: 0.75rem 1.25rem;
              margin: 1.5rem 0;
              background-color: #f8f9fa;
              border-radius: 0.25rem;
              font-style: italic;
              color: #4a5568;
            }
            
            hr {
              border: none;
              border-top: 1px solid #e2e8f0;
              margin: 2rem 0;
            }
            
            .key-business-info {
              background-color: #f0f6ff;
              border: 1px solid #bee3f8;
              border-radius: 0.5rem;
              padding: 1.5rem;
              margin: 1.5rem 0;
              box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            }
            
            .key-business-info h2 {
              margin-top: 0;
              color: #2b6cb0;
              border-bottom: 1px solid #bee3f8;
              padding-bottom: 0.75rem;
              margin-bottom: 1rem;
            }
            
            .key-business-info ul {
              list-style-type: none;
              padding-left: 0.5rem;
              margin-top: 1rem;
            }
            
            .key-business-info li {
              margin-bottom: 0.75rem;
              font-size: 1rem;
            }
            
            .key-business-info li strong {
              color: #2c5282;
            }
            
            .metadata {
              font-size: 0.875rem;
              color: #718096;
              margin-bottom: 2rem;
              border: 1px solid #e2e8f0;
              padding: 0.75rem 1rem;
              background-color: #f8fafc;
              border-radius: 0.25rem;
            }
            
            .quick-facts {
              background-color: #f9f9f9;
              border-radius: 0.5rem;
              padding: 1.25rem 1.5rem;
              margin: 1.5rem 0;
              border: 1px solid #edf2f7;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Festival Research: ${festivalName}</h1>
            <div class="metadata">
              <p>Generated on ${new Date().toLocaleDateString()} by FestiFind AI Research</p>
            </div>
          </div>
          
          <div class="content">
            <!-- Content will be inserted by the markdown parser -->
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} FestiFind AI Research</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    
    // Add the marked library to parse markdown
    printWindow.document.write(`
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      <script>
        // Set marked options for better rendering
        marked.setOptions({
          breaks: true,
          gfm: true,
          headerIds: true
        });
        
        // Process content with custom styling for blockquotes and key information
        let content = \`${researchData.research_log.replace(/`/g, '\\`')}\`;
        
        // Parse the markdown to HTML
        let parsedContent = marked.parse(content);
        
        // Apply special styling to the key business information section
        parsedContent = parsedContent.replace(
          /<h2 id="key-business-information">KEY BUSINESS INFORMATION<\\/h2>[\\s\\S]*?(?=<hr>)/,
          match => '<div class="key-business-info">' + match + '</div>'
        );
        
        // Apply special styling to the Quick Facts section
        parsedContent = parsedContent.replace(
          /<h3 id="quick-facts">Quick Facts<\\/h3>[\\s\\S]*?(?=<h3)/,
          match => '<div class="quick-facts">' + match + '</div>'
        );
        
        // Insert the processed content
        document.querySelector('.content').innerHTML = parsedContent;
      </script>
    `);
    
    printWindow.document.close();
    
    // Print the window
    setTimeout(() => {
      printWindow.print();
    }, 1000);
  };
  
  const handleExport = () => {
    if (!researchData?.research_log) return;
    
    // Create a blob with the markdown content
    const blob = new Blob([researchData.research_log], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    // Create a link element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = `${festivalName.replace(/\s+/g, '-').toLowerCase()}-research.md`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // If modal is not open, don't render anything
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal content */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-purple-50 dark:bg-purple-900">
          <div>
            <h2 className="text-xl font-semibold text-purple-800 dark:text-purple-200">
              Research: {festivalName}
            </h2>
            {researchData?.ai_service && (
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                Generated by {
                  researchData.ai_service === 'perplexity' ? 'Perplexity AI' : 
                  researchData.ai_service === 'exa' ? 'EXA.AI' : 
                  'OpenAI'
                }
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {!isLoading && researchData?.status === 'complete' && (
              <>
                <button
                  onClick={handlePrint}
                  title="Print research"
                  className="p-2 text-purple-600 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-100 hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full"
                >
                  <Printer size={20} />
                </button>
                <button
                  onClick={handleExport}
                  title="Export as markdown"
                  className="p-2 text-purple-600 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-100 hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={fetchResearchData}
                  title="Refresh research"
                  className="p-2 text-purple-600 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-100 hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full"
                >
                  <RefreshCw size={20} />
                </button>
              </>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : error ? (
            <div className="text-red-500 text-center py-8">
              <p>{error}</p>
              <button 
                onClick={fetchResearchData}
                className="mt-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200"
              >
                Try Again
              </button>
            </div>
          ) : researchData?.status === 'pending' ? (
            <div className="text-amber-500 text-center py-8">
              <p>Research is still in progress. Please check back later.</p>
              <div className="mt-4 animate-pulse rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500 mx-auto"></div>
              <button 
                onClick={fetchResearchData}
                className="mt-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200"
              >
                Refresh
              </button>
            </div>
          ) : researchData?.status === 'failed' ? (
            <div className="text-red-500 text-center py-8">
              <p>Research generation failed. Please try again.</p>
              <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                {researchData.research_log}
              </p>
            </div>
          ) : (
            <div className="prose prose-sm md:prose-base lg:prose-lg dark:prose-invert max-w-none 
              prose-h1:text-4xl prose-h1:text-center prose-h1:font-bold prose-h1:text-gray-900 prose-h1:mb-3 prose-h1:mt-0 prose-h1:leading-tight dark:prose-h1:text-gray-100
              prose-h2:text-2xl prose-h2:font-bold prose-h2:text-gray-800 prose-h2:mt-8 prose-h2:mb-4 dark:prose-h2:text-gray-200
              prose-h3:text-xl prose-h3:font-semibold prose-h3:text-gray-800 prose-h3:mt-6 prose-h3:mb-3 dark:prose-h3:text-gray-300
              prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
              prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline 
              prose-li:my-1 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-li:leading-relaxed
              prose-strong:text-gray-900 dark:prose-strong:text-gray-200 prose-strong:font-semibold
              prose-hr:border-gray-200 dark:prose-hr:border-gray-700 prose-hr:my-8
              prose-blockquote:bg-gray-50 dark:prose-blockquote:bg-gray-800/50 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:my-5 prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300 prose-blockquote:rounded-sm prose-blockquote:italic"
            >
              {/* Apply special styling to the sections */}
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => {
                    return (
                      <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 text-center mb-3 mt-0 leading-tight" {...props} />
                    );
                  },
                  blockquote: ({node, ...props}) => {
                    return (
                      <blockquote className="bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 my-5 text-gray-700 dark:text-gray-300 italic rounded-sm" {...props} />
                    );
                  },
                  h2: ({ node, ...props }) => {
                    // Special styling for KEY BUSINESS INFORMATION section
                    if (props.children && props.children.toString() === 'KEY BUSINESS INFORMATION') {
                      return (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5 my-6 shadow-sm">
                          <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800 pb-2 mb-4" {...props} />
                        </div>
                      );
                    }
                    return <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-8 mb-4" {...props} />;
                  },
                  h3: ({ node, ...props }) => {
                    // Special styling for Quick Facts section
                    if (props.children && props.children.toString() === 'Quick Facts') {
                      return (
                        <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg p-4 my-6">
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2 mb-3" {...props} />
                        </div>
                      );
                    }
                    return <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-300 mt-6 mb-3" {...props} />;
                  },
                  ul: ({ node, className, ...props }) => {
                    // Check if this list is part of the KEY BUSINESS INFORMATION section
                    const parentText = node && 
                      (node as any).parent?.children?.[0]?.children?.[0]?.value;
                    if (parentText === 'KEY BUSINESS INFORMATION') {
                      return (
                        <ul className="list-none pl-1 space-y-3 mt-4" {...props} />
                      );
                    }
                    
                    // Check if this list is part of the Quick Facts section
                    const quickFactsHeading = node && 
                      (node as any).parent?.children?.[0]?.children?.[0]?.value;
                    if (quickFactsHeading === 'Quick Facts') {
                      return (
                        <ul className="list-none pl-1 space-y-2 mt-3" {...props} />
                      );
                    }
                    
                    return <ul className="pl-5 space-y-2 my-4" {...props} />;
                  },
                  li: ({ node, ...props }) => {
                    // Style list items differently based on their parent section
                    const parentSection = node && 
                      (node as any).parent?.parent?.children?.[0]?.children?.[0]?.value;
                    
                    if (parentSection === 'KEY BUSINESS INFORMATION') {
                      return <li className="flex items-start my-2 text-gray-800 dark:text-gray-200" {...props} />;
                    }
                    
                    if (parentSection === 'Quick Facts') {
                      return <li className="my-1.5 text-gray-700 dark:text-gray-300" {...props} />;
                    }
                    
                    return <li className="my-2" {...props} />;
                  }
                }}
              >
                {researchData?.research_log || ''}
              </ReactMarkdown>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-between p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {!isLoading && researchData?.status === 'complete' && researchData?.updated_at && (
              <span>Last updated: {new Date(researchData.updated_at).toLocaleString()}</span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResearchModal; 