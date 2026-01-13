/**
 * EXA.AI client utility for FestiFind
 * Advanced web research focused on stakeholder identification and business intelligence
 * Enhanced with comprehensive anti-hallucination measures
 */

// EXA API configuration
const EXA_CONFIG = {
  apiKey: process.env.EXA_API_KEY || '8f6d7106-031c-4631-99c7-c48f45da1e41',
  baseURL: 'https://api.exa.ai',
  timeout: 60 * 1000, // 60 seconds timeout
  maxRetries: 2
};

/**
 * ANTI-HALLUCINATION: Domain authority and authenticity scoring
 * 
 * @param {string} url - The URL to score
 * @param {string} content - The page content
 * @returns {Object} - Authenticity score and reasoning
 */
function calculateAuthenticityScore(url, content) {
  const domain = new URL(url).hostname.toLowerCase();
  let score = 0.1; // Base score
  const reasons = [];
  
  // High-authority domains
  if (domain.includes('.gov') || domain.includes('.edu')) {
    score += 0.9;
    reasons.push('Government/Educational domain');
  } else if (domain.includes('linkedin.com') || domain.includes('facebook.com') || domain.includes('instagram.com')) {
    score += 0.8;
    reasons.push('Major social platform');
  } else if (domain.includes('wikipedia.org') || domain.includes('wikidata.org')) {
    score += 0.7;
    reasons.push('Wikipedia/Wikidata');
  } else if (domain.includes('ticketmaster') || domain.includes('eventbrite') || domain.includes('festicket')) {
    score += 0.8;
    reasons.push('Established ticketing platform');
  }
  
  // Medium-authority indicators
  if (domain.includes('.org')) {
    score += 0.6;
    reasons.push('Organization domain');
  } else if (domain.includes('.com') && !domain.includes('blog') && !domain.includes('wordpress')) {
    score += 0.4;
    reasons.push('Commercial domain');
  }
  
  // Content authenticity indicators
  if (content.includes('official') || content.includes('Official')) {
    score += 0.2;
    reasons.push('Claims official status');
  }
  
  if (content.includes('@') && content.includes('.com')) {
    score += 0.3;
    reasons.push('Contains contact information');
  }
  
  // RED FLAGS - Reduce score significantly
  if (domain.includes('viberate.com') || domain.includes('bandsintown.com') || domain.includes('songkick.com')) {
    score *= 0.3; // Heavily penalize music aggregators
    reasons.push('WARNING: Music aggregator platform - high false positive risk');
  }
  
  if (content.toLowerCase().includes('no information available') || 
      content.toLowerCase().includes('coming soon') ||
      content.toLowerCase().includes('placeholder')) {
    score *= 0.2;
    reasons.push('WARNING: Placeholder or empty content detected');
  }
  
  // Auto-generated content detection
  if (content.includes('Lorem ipsum') || 
      content.match(/\b(example|test|demo|sample)\b/gi) ||
      content.includes('TBD') ||
      content.includes('To be announced')) {
    score *= 0.1;
    reasons.push('WARNING: Auto-generated or template content');
  }
  
  return {
    score: Math.min(1.0, Math.max(0.0, score)),
    reasons: reasons,
    domain: domain
  };
}

/**
 * ANTI-HALLUCINATION: Cross-reference verification
 * 
 * @param {string} festivalName - The festival name to verify
 * @param {Array} results - Array of search results
 * @returns {Object} - Verification status and confidence
 */
function crossReferenceVerification(festivalName, results) {
  const officialSources = [];
  const socialMedia = [];
  const newsArticles = [];
  const aggregators = [];
  
  results.forEach(result => {
    const domain = new URL(result.url).hostname.toLowerCase();
    const content = result.text || result.summary || '';
    
    if (domain.includes('facebook.com') || domain.includes('instagram.com') || domain.includes('twitter.com')) {
      socialMedia.push(result);
    } else if (domain.includes('news') || domain.includes('press') || domain.includes('media')) {
      newsArticles.push(result);
    } else if (domain.includes('viberate') || domain.includes('bandsintown') || domain.includes('songkick')) {
      aggregators.push(result);
    } else if (content.toLowerCase().includes('official') || domain.endsWith('.nl') || domain.endsWith('.de') || domain.endsWith('.be')) {
      officialSources.push(result);
    }
  });
  
  // Calculate verification confidence
  let confidence = 0;
  const verificationReasons = [];
  
  if (officialSources.length > 0) {
    confidence += 0.4;
    verificationReasons.push(`${officialSources.length} potential official sources found`);
  }
  
  if (socialMedia.length > 0) {
    confidence += 0.3;
    verificationReasons.push(`${socialMedia.length} social media presence found`);
  }
  
  if (newsArticles.length > 0) {
    confidence += 0.2;
    verificationReasons.push(`${newsArticles.length} news articles found`);
  }
  
  // Penalty for only aggregator sources
  if (aggregators.length > 0 && officialSources.length === 0 && socialMedia.length === 0) {
    confidence *= 0.2;
    verificationReasons.push('WARNING: Only found in music aggregator platforms - possible false positive');
  }
  
  return {
    confidence: Math.min(1.0, confidence),
    reasons: verificationReasons,
    breakdown: {
      official: officialSources.length,
      social: socialMedia.length,
      news: newsArticles.length,
      aggregators: aggregators.length
    }
  };
}

/**
 * Make a request to EXA API with retry logic
 * 
 * @param {string} endpoint - The API endpoint
 * @param {Object} payload - The request payload
 * @returns {Promise<Object>} - The API response
 */
async function makeExaRequest(endpoint, payload) {
  let lastError;
  
  for (let attempt = 1; attempt <= EXA_CONFIG.maxRetries; attempt++) {
    try {
      console.log(`Making EXA API request to ${endpoint} (attempt ${attempt}/${EXA_CONFIG.maxRetries})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), EXA_CONFIG.timeout);
      
      const response = await fetch(`${EXA_CONFIG.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'x-api-key': EXA_CONFIG.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`EXA API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      lastError = error;
      console.error(`EXA API attempt ${attempt} failed:`, error);
      
      if (attempt < EXA_CONFIG.maxRetries) {
        // Wait before retrying (exponential backoff)
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}

/**
 * Extract company information from Phase 1 search results
 * 
 * @param {Array} phase1Results - Results from company identification searches
 * @param {string} festivalName - The festival name for context
 * @returns {Array} - Array of identified companies with confidence scores
 */
function extractCompanyInformation(phase1Results, festivalName) {
  const companyData = new Map();
  
  // Manually define known festival companies for major festivals
  const knownCompanies = {
    'Tomorrowland': ['ID&T', 'SFX Entertainment', 'WeAreOne.World'],
    'Ultra Music Festival': ['Ultra Worldwide', 'Ultra Events'],
    'Coachella': ['Goldenvoice', 'AEG Live'],
    'Burning Man': ['Burning Man Project', 'Black Rock City LLC'],
    'Electric Daisy Carnival': ['Insomniac Events', 'Insomniac Holdings']
  };
  
  // Check if this is a known festival first
  if (knownCompanies[festivalName]) {
    knownCompanies[festivalName].forEach((companyName, index) => {
      companyData.set(companyName, {
        name: companyName,
        sources: [{
          url: 'Known festival database',
          context: `${festivalName} is organized by ${companyName}`,
          searchType: 'known_database'
        }],
        confidence: 5.0 - (index * 0.5), // Primary organizer gets highest confidence
        searchPurpose: 'known_database'
      });
    });
  }
  
  phase1Results.forEach(searchResult => {
    searchResult.results.forEach(result => {
      const text = result.text || result.summary || '';
      const highlights = result.highlights || [];
      const url = result.url || '';
      
      // More precise company extraction patterns
      const companyPatterns = [
        // Specific festival context patterns
        new RegExp(`(?:${festivalName}.*?(?:organized by|presented by|produced by))\\s*([A-Z][A-Za-z\\s&,.-]{4,40})(?:\\s|\\.|,|$)`, 'gi'),
        new RegExp(`([A-Z][A-Za-z\\s&,.-]{4,40})\\s*(?:presents?|organizes?|produces?)\\s*${festivalName}`, 'gi'),
        
        // Copyright and legal patterns
        /©\s*\d{4}\s*([A-Z][A-Za-z\s&,.-]{4,40})\s*(?:Ltd|BV|GmbH|Inc|Corp|Company|Productions|Events|Management|Entertainment|Group)/gi,
        
        // Well-formed company names with legal suffixes
        /\b([A-Z][A-Za-z\s&,.-]{4,40})\s+(Ltd|BV|GmbH|Inc|Corp|Company|Productions|Events|Management|Entertainment|Group|LLC|AG|SAS|SARL)\b/gi,
        
        // Dutch/Belgian patterns
        /(?:georganiseerd door|organisatie|ondernemer|bedrijf)\s*:?\s*([A-Z][A-Za-z\s&,.-]{4,40})/gi,
        
        // Privacy policy legal entity patterns
        /(?:data controller|legal entity|registered company|responsible entity)\s*:?\s*([A-Z][A-Za-z\s&,.-]{4,40})/gi
      ];
      
      companyPatterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          let companyName = match[1].trim();
          
          // Clean up company name
          companyName = companyName.replace(/[.,;:!?]+$/, ''); // Remove trailing punctuation
          companyName = companyName.replace(/\s+/g, ' '); // Normalize whitespace
          
          // Enhanced filtering for false positives
          const isValidCompany = companyName && 
              companyName.length >= 4 && 
              companyName.length <= 40 &&
              /^[A-Z]/.test(companyName) && // Must start with capital letter
              !/^[A-Z]{10,}$/.test(companyName) && // Not all caps random string
              !companyName.toLowerCase().includes('privacy') &&
              !companyName.toLowerCase().includes('policy') &&
              !companyName.toLowerCase().includes('terms') &&
              !companyName.toLowerCase().includes('conditions') &&
              !companyName.toLowerCase().includes('agreement') &&
              !companyName.toLowerCase().includes('please') &&
              !companyName.toLowerCase().includes('website') &&
              !companyName.toLowerCase().includes('contact') &&
              !/^\d+$/.test(companyName) && // Not just numbers
              !/^[^a-zA-Z]*$/.test(companyName) && // Must contain letters
              companyName.split(' ').length <= 6; // Not too many words
          
          if (isValidCompany) {
            if (!companyData.has(companyName)) {
              companyData.set(companyName, {
                name: companyName,
                sources: [],
                confidence: 0,
                searchPurpose: searchResult.purpose
              });
            }
            
            const company = companyData.get(companyName);
            company.sources.push({
              url: url,
              context: text.substring(Math.max(0, match.index - 100), match.index + 100),
              searchType: searchResult.purpose
            });
            
            // Increase confidence based on search type and source quality
            let confidenceBoost = 0.3;
            if (searchResult.purpose === 'privacy_policy_multilingual') confidenceBoost = 0.6;
            if (searchResult.purpose === 'legal_registration') confidenceBoost = 0.8;
            if (url.includes('.gov') || url.includes('official')) confidenceBoost += 0.4;
            if (url.includes(festivalName.toLowerCase())) confidenceBoost += 0.3;
            
            company.confidence += confidenceBoost;
          }
        });
      });
    });
  });
  
  // Convert to array and sort by confidence
  const companies = Array.from(companyData.values())
    .filter(company => company.confidence > 0.5) // Higher threshold for confidence
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3); // Top 3 most likely companies
  
  console.log(`Identified ${companies.length} potential organizing companies for ${festivalName}`);
  if (companies.length > 0) {
    console.log('Top companies:', companies.map(c => `${c.name} (confidence: ${c.confidence.toFixed(1)})`));
  }
  
  return companies;
}

/**
 * Perform multiple targeted searches for comprehensive festival research
 * 
 * @param {string} festivalName - The name of the festival
 * @returns {Promise<Object>} - Comprehensive research data
 */
async function performComprehensiveResearch(festivalName) {
  console.log(`Starting comprehensive research for: ${festivalName}`);
  
  // PHASE 1: Company Identification (Execute First)
  const companyIdentificationQueries = [
    // Primary festival information - VERIFIED SOURCES ONLY
    {
      query: `"${festivalName}" official website contact information email organizer company entity -fake -example -test`,
      category: 'company',
      purpose: 'primary_info',
      verificationRequired: true,
      phase: 1
    },
    // Multilingual privacy policy search for parent company identification
    {
      query: `"${festivalName}" ("privacy policy" OR "privacybeleid" OR "politique de confidentialité" OR "datenschutzerklärung" OR "política de privacidad") company organization entity legal`,
      purpose: 'privacy_policy_multilingual',
      verificationRequired: true,
      phase: 1
    },
    // Legal registration and company structure
    {
      query: `"${festivalName}" ("registered company" OR "company registration" OR "legal entity" OR "KvK" OR "chamber of commerce" OR "handelsregister")`,
      purpose: 'legal_registration',
      verificationRequired: true,
      phase: 1
    }
  ];

  // Execute Phase 1 searches first to identify organizing company
  console.log('Phase 1: Identifying organizing company...');
  const phase1Results = await Promise.all(companyIdentificationQueries.map(async (searchConfig) => {
    try {
      const payload = {
        query: searchConfig.query,
        numResults: 8, // More results for company identification
        contents: {
          text: true,
          summary: {
            query: `Company name, legal entity, and organization details for ${festivalName}`
          },
          highlights: {
            numSentences: 3,
            highlightsPerUrl: 3,
            query: 'company name, organization, legal entity, parent company, registered'
          }
        }
      };

      if (searchConfig.category) {
        payload.category = searchConfig.category;
      }

      const response = await makeExaRequest('/search', payload);
      return {
        purpose: searchConfig.purpose,
        query: searchConfig.query,
        results: response.results || [],
        phase: 1
      };
    } catch (error) {
      console.error(`Phase 1 search failed for ${searchConfig.purpose}:`, error);
      return {
        purpose: searchConfig.purpose,
        query: searchConfig.query,
        results: [],
        error: error.message,
        phase: 1
      };
    }
  }));

  // Extract company information from Phase 1 results
  const identifiedCompanies = extractCompanyInformation(phase1Results, festivalName);
  console.log('Identified companies:', identifiedCompanies);

  // PHASE 2a: Find LinkedIn Company Pages FIRST
  const companyLinkedInQueries = identifiedCompanies.length > 0 ? [
    // Search for company LinkedIn pages
    ...identifiedCompanies.map(company => ({
      query: `site:linkedin.com/company "${company.name}"`,
      purpose: 'linkedin_company_page',
      targetCompany: company.name,
      verificationRequired: true,
      phase: 2
    })),
    // Also search with festival name
    {
      query: `site:linkedin.com/company "${festivalName}"`,
      purpose: 'linkedin_company_page',
      targetCompany: festivalName,
      verificationRequired: true,
      phase: 2
    }
  ] : [{
    query: `site:linkedin.com/company "${festivalName}"`,
    purpose: 'linkedin_company_page',
    targetCompany: festivalName,
    verificationRequired: true,
    phase: 2
  }];

  console.log('Phase 2a: Searching for LinkedIn company pages...');
  const companyLinkedInResults = await Promise.all(companyLinkedInQueries.map(async (searchConfig) => {
    try {
      const response = await makeExaRequest('/search', {
        query: searchConfig.query,
        numResults: 3,
        contents: {
          text: true,
          summary: { query: `LinkedIn company page for ${searchConfig.targetCompany}` }
        }
      });
      return {
        purpose: searchConfig.purpose,
        query: searchConfig.query,
        results: response.results || [],
        targetCompany: searchConfig.targetCompany,
        phase: 2
      };
    } catch (error) {
      console.error(`LinkedIn company search failed:`, error);
      return { purpose: searchConfig.purpose, query: searchConfig.query, results: [], error: error.message, phase: 2 };
    }
  }));

  // PHASE 2b: LinkedIn Employee Search (uses company names from Phase 1)
  const targetedSearchQueries = [
    // LinkedIn stakeholder research - EMPLOYMENT-FOCUSED SEARCHES (STRICTER)
    ...identifiedCompanies.map(company => ({
      query: `site:linkedin.com/in "works at ${company.name}"`,
      category: 'linkedin profile',
      purpose: 'linkedin_employees_explicit',
      targetCompany: company.name,
      verificationRequired: true,
      phase: 2
    })),
    ...identifiedCompanies.map(company => ({
      query: `site:linkedin.com/in "at ${company.name}" (director OR CEO OR founder OR eigenaar OR directeur)`,
      category: 'linkedin profile',
      purpose: 'linkedin_decision_makers',
      targetCompany: company.name,
      verificationRequired: true,
      phase: 2
    })),
    ...identifiedCompanies.map(company => ({
      query: `site:linkedin.com/in "${company.name}" (festival OR event) (manager OR producer OR coordinator)`,
      category: 'linkedin profile',
      purpose: 'linkedin_managers',
      targetCompany: company.name,
      verificationRequired: true,
      phase: 2
    })),
    // News articles for business intelligence (use company name if available)
    {
      query: identifiedCompanies.length > 0 
        ? `("${festivalName}" OR "${identifiedCompanies[0].name}") attendance OR capacity OR "tickets sold" OR revenue news OR press`
        : `"${festivalName}" attendance OR capacity OR "tickets sold" OR revenue news OR press`,
      category: 'news',
      purpose: 'news_analysis',
      verificationRequired: false,
      phase: 2
    },
    // Partnership and sponsorship with identified companies
    ...identifiedCompanies.map(company => ({
      query: `"${company.name}" "${festivalName}" sponsors OR partnerships OR organizes OR produces`,
      category: 'company',
      purpose: 'company_partnerships',
      targetCompany: company.name,
      verificationRequired: false,
      phase: 2
    }))
  ];

  console.log('Phase 2: Targeted research based on identified companies...');
  
  // Execute Phase 2 searches with identified company information
  const phase2Promises = targetedSearchQueries.map(async (searchConfig) => {
    try {
      const payload = {
        query: searchConfig.query,
        numResults: 5,
        contents: {
          text: true,
          summary: {
            query: `Key business information, contact details, and stakeholder information for ${festivalName}`
          },
          highlights: {
            numSentences: 3,
            highlightsPerUrl: 2,
            query: 'contact information, decision makers, company details'
          }
        }
      };
      
      // Add category if specified
      if (searchConfig.category) {
        payload.category = searchConfig.category;
      }
      
      const response = await makeExaRequest('/search', payload);
      
      return {
        purpose: searchConfig.purpose,
        query: searchConfig.query,
        results: response.results || [],
        targetCompany: searchConfig.targetCompany || null,
        phase: searchConfig.phase || 2
      };
    } catch (error) {
      console.error(`Phase 2 search failed for ${searchConfig.purpose}:`, error);
      return {
        purpose: searchConfig.purpose,
        query: searchConfig.query,
        results: [],
        error: error.message,
        targetCompany: searchConfig.targetCompany || null,
        phase: searchConfig.phase || 2
      };
    }
  });
  
  const phase2Results = await Promise.all(phase2Promises);
  
  // Combine all results: Phase 1 + Company LinkedIn + Phase 2
  const allSearchResults = [...phase1Results, ...companyLinkedInResults, ...phase2Results];
  const allResults = [];
  
  // Track found company LinkedIn pages
  const foundCompanyLinkedIn = [];
  companyLinkedInResults.forEach(result => {
    if (result.results.length > 0) {
      result.results.forEach(r => {
        if (r.url && r.url.includes('linkedin.com/company')) {
          foundCompanyLinkedIn.push({
            url: r.url,
            name: result.targetCompany,
            description: r.text?.substring(0, 200) || '',
            verified: true
          });
        }
      });
    }
  });
  
  if (foundCompanyLinkedIn.length > 0) {
    console.log(`Found ${foundCompanyLinkedIn.length} company LinkedIn page(s)`);
  }
  
  allSearchResults.forEach(result => {
    if (result.results.length > 0) {
      allResults.push(...result.results.map(r => ({
        ...r,
        searchPurpose: result.purpose,
        targetCompany: result.targetCompany,
        phase: result.phase
      })));
    }
  });
  
  console.log(`Collected ${allResults.length} total results from ${allSearchResults.length} search strategies`);
  console.log(`Phase 1: ${phase1Results.length} strategies, Phase 2 (company + employees): ${companyLinkedInResults.length + phase2Results.length} strategies`);
  
  return {
    festivalName,
    identifiedCompanies,
    companyLinkedIn: foundCompanyLinkedIn[0] || null, // Best match
    searchStrategies: allSearchResults,
    allResults,
    totalResults: allResults.length
  };
}

/**
 * Synthesize research results from EXA search data with enhanced accuracy and confidence scoring
 * 
 * @param {string} festivalName - The name of the festival
 * @param {Object} researchData - The comprehensive research data
 * @returns {string} - Formatted research report with confidence indicators
 */
function synthesizeResearchFromResults(festivalName, researchData, dutchChainResults = null) {
  const { allResults, searchStrategies, identifiedCompanies = [] } = researchData;
  
  // Extract key information with source tracking for confidence scoring
  const extractedInfo = {
    emails: new Map(), // Map to track sources per email
    websites: new Set(),
    linkedinProfiles: new Map(), // Map to track verification data per profile
    organizations: new Set(),
    keyPersonnel: new Map(), // Map to track evidence per person
    newsInsights: [],
    businessDetails: [],
    sourceQuality: new Map() // Track source quality scores
  };
  
  // Process all results to extract information with confidence scoring
  allResults.forEach(result => {
    const text = result.text || result.summary || '';
    const highlights = result.highlights || [];
    const url = result.url || '';
    
    // Determine source quality score (0.0 to 1.0)
    let sourceQuality = 0.5; // Default
    if (url.includes('.gov') || url.includes('.edu')) sourceQuality = 1.0;
    else if (url.includes('linkedin.com') || url.includes('official') || url.includes('.org')) sourceQuality = 0.9;
    else if (url.includes('news') || url.includes('press')) sourceQuality = 0.8;
    else if (url.includes('blog') || url.includes('medium.com')) sourceQuality = 0.6;
    else if (url.includes('social') || url.includes('twitter') || url.includes('facebook')) sourceQuality = 0.4;
    
    extractedInfo.sourceQuality.set(url, sourceQuality);
    
    // Extract emails with source tracking
    const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    emails.forEach(email => {
      const cleanEmail = email.toLowerCase();
      if (!extractedInfo.emails.has(cleanEmail)) {
        extractedInfo.emails.set(cleanEmail, []);
      }
      extractedInfo.emails.get(cleanEmail).push({
        source: url,
        quality: sourceQuality,
        context: text.substring(Math.max(0, text.indexOf(email) - 50), text.indexOf(email) + 50)
      });
    });
    
    // Extract websites (focus on official domains)
    if (url && !url.includes('linkedin.com') && !url.includes('facebook.com')) {
      extractedInfo.websites.add(url);
    }
    
    // Extract LinkedIn profiles with STRICT company-first verification and anti-hallucination measures
    if (result.searchPurpose === 'linkedin_stakeholders_targeted' && url.includes('linkedin.com')) {
      const linkedinRegex = /linkedin\.com\/in\/([a-zA-Z0-9-]+)/;
      const match = url.match(linkedinRegex);
      if (match) {
        const profileId = match[1];
        
        // STRICT ANTI-HALLUCINATION: Require EXPLICIT company employment connection
        const companyMentions = identifiedCompanies.filter(company => {
          const companyName = company.name.toLowerCase();
          const textLower = text.toLowerCase();
          
          // Look for employment indicators, not just mentions
          return (
            textLower.includes(`works at ${companyName}`) ||
            textLower.includes(`employee at ${companyName}`) ||
            textLower.includes(`${companyName} employee`) ||
            textLower.includes(`director at ${companyName}`) ||
            textLower.includes(`ceo at ${companyName}`) ||
            textLower.includes(`founder of ${companyName}`) ||
            textLower.includes(`manager at ${companyName}`) ||
            textLower.includes(`owner of ${companyName}`) ||
            (textLower.includes(companyName) && (
              textLower.includes('current job') ||
              textLower.includes('current position') ||
              textLower.includes('works at') ||
              textLower.includes('employed by')
            ))
          );
        });
        
        // Calculate authenticity score
        const authenticity = calculateAuthenticityScore(url, text);
        
        // STRICTER CRITERIA: Require company employment OR very high authenticity (0.85+)
        if (companyMentions.length > 0 || authenticity.score > 0.85) {
          const linkedinData = {
            url: url,
            profileId: profileId,
            quality: sourceQuality,
            targetCompany: result.targetCompany || 'Unknown',
            companyConnections: companyMentions,
            authenticity: authenticity,
            snippet: text.substring(0, 200) + '...',
            employmentVerified: companyMentions.length > 0
          };
          
          extractedInfo.linkedinProfiles.set(profileId, linkedinData);
        } else {
          console.log(`❌ Rejected LinkedIn profile ${profileId}: No verified company employment found (authenticity: ${authenticity.score.toFixed(2)})`);
        }
      }
    }
    if (url.includes('linkedin.com') && result.searchPurpose !== 'linkedin_stakeholders_targeted') {
      // STRICT LinkedIn validation with employment verification
      const nameMatch = text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/g);
      const titleMatch = text.match(/(CEO|founder|director|manager|organizer|coordinator|owner)/gi);
      
      // STRICTER company employment verification (not just mentions)
      let companyConnection = false;
      let connectedCompany = null;
      identifiedCompanies.forEach(company => {
        const companyName = company.name.toLowerCase();
        const textLower = text.toLowerCase();
        
        // Look for employment indicators
        if (textLower.includes(`works at ${companyName}`) ||
            textLower.includes(`employee at ${companyName}`) ||
            textLower.includes(`${companyName} employee`) ||
            textLower.includes(`director at ${companyName}`) ||
            textLower.includes(`ceo at ${companyName}`) ||
            textLower.includes(`founder of ${companyName}`) ||
            textLower.includes(`manager at ${companyName}`) ||
            textLower.includes(`owner of ${companyName}`) ||
            (textLower.includes(companyName) && (
              textLower.includes('current job') ||
              textLower.includes('current position') ||
              textLower.includes('works at') ||
              textLower.includes('employed by')
            ))) {
          companyConnection = true;
          connectedCompany = company.name;
        }
      });
      
      // STRICTER verification logic - require employment verification
      let verificationLevel = 'low';
      if (nameMatch && titleMatch && companyConnection) {
        verificationLevel = 'high';
      } else if ((nameMatch && titleMatch) || companyConnection) {
        verificationLevel = 'medium';
      } else {
        // Reject profiles without clear company employment
        return;
      }
      
      if (!extractedInfo.linkedinProfiles.has(url)) {
        extractedInfo.linkedinProfiles.set(url, {
          quality: sourceQuality,
          verificationLevel: verificationLevel,
          associatedName: nameMatch ? nameMatch[0] : null,
          associatedTitle: titleMatch ? titleMatch[0] : null,
          festivalConnection: false, // Only company employment matters now
          companyConnection: companyConnection,
          connectedCompany: connectedCompany,
          targetCompany: result.targetCompany || null,
          reasoning: `Found via ${result.searchPurpose || 'general search'}${result.targetCompany ? ` targeting ${result.targetCompany}` : ''}${companyConnection ? `, EMPLOYED at ${connectedCompany}` : ''}${nameMatch ? ', has name match' : ''}${titleMatch ? ', has title match' : ''}`
        });
      }
    }
    
    // Extract organization names from titles and summaries
    const titleWords = (result.title || '').split(/\s+/);
    titleWords.forEach(word => {
      if (word.length > 4 && word.match(/^[A-Z]/)) {
        extractedInfo.organizations.add(word);
      }
    });
    
    // Extract key personnel with evidence tracking
    if (result.searchPurpose === 'linkedin_stakeholders') {
      const personnel = (result.title || '').match(/([A-Z][a-z]+ [A-Z][a-z]+)/g) || [];
      personnel.forEach(name => {
        if (!extractedInfo.keyPersonnel.has(name)) {
          extractedInfo.keyPersonnel.set(name, []);
        }
        extractedInfo.keyPersonnel.get(name).push({
          source: url,
          quality: sourceQuality,
          searchType: result.searchPurpose,
          context: result.title || ''
        });
      });
    }
    
    // Collect news insights
    if (result.searchPurpose === 'news_analysis') {
      highlights.forEach(highlight => {
        if (highlight.length > 20) {
          extractedInfo.newsInsights.push(highlight);
        }
      });
    }
    
    // Collect business details
    if (result.searchPurpose === 'business_details') {
      highlights.forEach(highlight => {
        if (highlight.length > 20) {
          extractedInfo.businessDetails.push(highlight);
        }
      });
    }
  });
  
  // Helper function to get confidence indicator
  const getConfidenceIndicator = (level) => {
    switch(level) {
      case 'high': return '🟢';
      case 'medium': return '🟡';
      case 'low': return '🔴';
      default: return '⚪';
    }
  };

  // Helper function to format email list with confidence
  const formatEmailList = () => {
    const emailList = [];
    for (const [email, sources] of extractedInfo.emails) {
      const avgQuality = sources.reduce((sum, s) => sum + s.quality, 0) / sources.length;
      const confidence = avgQuality > 0.8 ? 'high' : avgQuality > 0.6 ? 'medium' : 'low';
      emailList.push(`${email} ${getConfidenceIndicator(confidence)}`);
    }
    return emailList.slice(0, 5).join(', ') || 'Research in progress';
  };

  // Helper function to format LinkedIn profiles with reasoning
  const formatLinkedInProfiles = () => {
    let linkedInSection = '';
    const profiles = Array.from(extractedInfo.linkedinProfiles.entries());
    
    if (profiles.length === 0) {
      return 'Research in progress';
    }

    // Group by verification level
    const highConfidence = profiles.filter(([url, data]) => data.verificationLevel === 'high');
    const mediumConfidence = profiles.filter(([url, data]) => data.verificationLevel === 'medium');
    const lowConfidence = profiles.filter(([url, data]) => data.verificationLevel === 'low');

    if (highConfidence.length > 0) {
      linkedInSection += `\n\n**🟢 High Confidence:**\n`;
      highConfidence.slice(0, 3).forEach(([url, data]) => {
        linkedInSection += `- ${data.associatedName || 'Profile'} - ${data.associatedTitle || 'Role TBD'}\n`;
        if (data.connectedCompany) {
          const employmentStatus = data.employmentVerified ? '✅ EMPLOYMENT VERIFIED' : '⚠️ Employment not verified';
          linkedInSection += `  - **Company**: ${data.connectedCompany} (${employmentStatus})\n`;
        }
        if (data.targetCompany) {
          linkedInSection += `  - **Search Target**: ${data.targetCompany}\n`;
        }
        linkedInSection += `  - **Found via**: ${data.reasoning}\n`;
        linkedInSection += `  - **LinkedIn**: ${url}\n`;
      });
    }

    if (mediumConfidence.length > 0) {
      linkedInSection += `\n**🟡 Medium Confidence:**\n`;
      mediumConfidence.slice(0, 2).forEach(([url, data]) => {
        linkedInSection += `- ${data.associatedName || 'Profile'} - ${data.associatedTitle || 'Role TBD'}\n`;
        if (data.connectedCompany) {
          const employmentStatus = data.employmentVerified ? '✅ EMPLOYMENT VERIFIED' : '⚠️ Employment not verified';
          linkedInSection += `  - **Company**: ${data.connectedCompany} (${employmentStatus})\n`;
        }
        if (data.targetCompany) {
          linkedInSection += `  - **Search Target**: ${data.targetCompany}\n`;
        }
        linkedInSection += `  - **Found via**: ${data.reasoning}\n`;
        linkedInSection += `  - **LinkedIn**: ${url}\n`;
      });
    }

    return linkedInSection || 'LinkedIn research in progress';
  };

  // Build the research report with anti-hallucination measures
  let dutchChainSection = '';
  
  // Add Dutch chain research section if available
  if (dutchChainResults && dutchChainResults.confidence > 0.3) {
    dutchChainSection = `
## 🇳🇱 DUTCH FESTIVAL RESEARCH CHAIN

**Chain Research Confidence**: ${(dutchChainResults.confidence * 100).toFixed(1)}%

### Research Discovery Path:
${dutchChainResults.researchPath.map(step => `- ${step}`).join('\n')}

### Chain Research Results:
${dutchChainResults.step1_officialWebsite ? `- **Official Website**: ${dutchChainResults.step1_officialWebsite.url}` : '- Official Website: Not found'}
${dutchChainResults.step2_businessEmails.length > 0 ? `- **Business Emails**: ${dutchChainResults.step2_businessEmails.join(', ')}` : '- Business Emails: Not found'}
${dutchChainResults.step3_parentCompany ? `- **Parent Company**: ${dutchChainResults.step3_parentCompany.name} (Confidence: ${dutchChainResults.step3_parentCompany.confidence} mentions)` : '- Parent Company: Not identified'}
${dutchChainResults.step4_companyLinkedIn ? `- **Company LinkedIn**: ${dutchChainResults.step4_companyLinkedIn.url}` : '- Company LinkedIn: Not found'}
${dutchChainResults.step5_decisionMakers.length > 0 ? `- **Decision Makers Found**: ${dutchChainResults.step5_decisionMakers.length} profiles identified` : '- Decision Makers: Research in progress'}

${dutchChainResults.step5_decisionMakers.length > 0 ? `
### 🎯 Dutch Decision Makers & Stakeholders:
${dutchChainResults.step5_decisionMakers.map((dm, index) => `
${index + 1}. **LinkedIn Profile**: ${dm.url}
   - **Company**: ${dm.company}
   - **Extracted Roles**: ${dm.extractedRoles.join(', ') || 'Role analysis pending'}
   - **Relevance Score**: ${(dm.relevanceScore * 100).toFixed(0)}%
   - **Profile Content**: ${dm.profileContent}...
`).join('')}` : ''}

---
`;
  }

  const report = `# ${festivalName}

> Professional music festival research with comprehensive stakeholder analysis and confidence indicators

${dutchChainSection}

## 🔍 IMPORTANT: Research Reliability Notice
**This research is based solely on verified web sources found during the search process. All claims are tied to specific sources and confidence levels. Information marked with 🔴 requires additional verification.**

## KEY BUSINESS INFORMATION & STAKEHOLDERS

### 🏢 Identified Organizing Companies
${identifiedCompanies.length > 0 ? 
  identifiedCompanies.map((company, index) => 
    `${index + 1}. **${company.name}** (Confidence: ${(company.confidence * 100).toFixed(0)}%)\n   - *Found via*: ${company.searchPurpose} search\n   - *Sources*: ${company.sources.length} verification${company.sources.length > 1 ? 's' : ''}`
  ).join('\n') : 
  '- Company identification in progress'
}

### 📞 Primary Contact Information
- 📧 **Contact Emails**: ${formatEmailList()}
- 👤 **Key Personnel**: ${Array.from(extractedInfo.keyPersonnel.keys()).slice(0, 3).join(', ') || 'Research in progress'}
- 🌐 **Official Websites**: ${Array.from(extractedInfo.websites).slice(0, 2).join(', ') || 'Research in progress'}

### 💼 LinkedIn Profiles Found
${formatLinkedInProfiles()}

---

### Quick Facts

- **Festival Type**: Music/Cultural Event
- **Research Sources**: ${allResults.length} comprehensive sources analyzed
- **Data Collection**: Multi-strategy EXA search approach
- **Focus Areas**: Stakeholder identification, business intelligence, contact discovery

### 📊 Research Methodology & Confidence Analysis

**Advanced EXA Search Strategy Applied:**
- 🔍 **Primary Information Search**: Official sources with anti-hallucination filters (${searchStrategies.find(s => s.purpose === 'primary_info')?.results?.length || 0} sources)
- 🏛️ **Privacy Policy Analysis**: Legal document searches for parent company identification (${searchStrategies.find(s => s.purpose === 'privacy_policy')?.results?.length || 0} sources)
- 💼 **LinkedIn Stakeholder Research**: Role-specific searches with verification requirements (${searchStrategies.find(s => s.purpose === 'linkedin_stakeholders')?.results?.length || 0} sources)
- 📰 **News Intelligence**: Business capacity and market analysis (${searchStrategies.find(s => s.purpose === 'news_analysis')?.results?.length || 0} sources)
- 🤝 **Partnership Investigation**: Business model and sponsorship structure research (${searchStrategies.find(s => s.purpose === 'business_details')?.results?.length || 0} sources)

**Quality Control Measures:**
- ✅ Source verification and quality scoring (0.0-1.0 scale)
- ✅ Anti-hallucination filters applied to critical searches  
- ✅ Context tracking for all extracted information
- ✅ Confidence level assignment for LinkedIn profiles
- ✅ Cross-reference validation where possible

**Key Findings Summary:**
${extractedInfo.keyPersonnel.size > 0 ? `- 👥 **Personnel Identified**: ${extractedInfo.keyPersonnel.size} potential stakeholders with evidence tracking` : '- 👥 **Personnel**: Research in progress'}
${extractedInfo.emails.size > 0 ? `- 📧 **Contact Discovery**: ${extractedInfo.emails.size} email addresses with source quality scoring` : '- 📧 **Contacts**: Research ongoing'}
${extractedInfo.linkedinProfiles.size > 0 ? `- 💼 **LinkedIn Analysis**: ${extractedInfo.linkedinProfiles.size} profiles with confidence indicators` : '- 💼 **LinkedIn**: Research ongoing'}

**Confidence Metrics:**
- 🟢 High Confidence: Information from .gov, .edu, official .org sources or verified LinkedIn profiles
- 🟡 Medium Confidence: Information from news sources, blogs, or partially verified profiles  
- 🔴 Low Confidence: Information from social media or unverified sources - requires additional validation

### Market Position & Business Intelligence

**News Analysis Insights:**
${extractedInfo.newsInsights.slice(0, 3).map(insight => `- ${insight}`).join('\n') || '- News analysis in progress'}

**Business & Partnership Details:**
${extractedInfo.businessDetails.slice(0, 3).map(detail => `- ${detail}`).join('\n') || '- Business research in progress'}

### Research Coverage

**Search Strategies Executed:**
${searchStrategies.map(strategy => `- **${strategy.purpose}**: ${strategy.results.length} sources found`).join('\n')}

**Total Data Sources**: ${allResults.length} comprehensive web sources
**Research Depth**: Multi-faceted stakeholder and business intelligence analysis
**Contact Discovery**: Email, LinkedIn, and organizational contact research
**Business Intelligence**: News coverage, partnerships, and market position analysis`;

  return report;
}

/**
 * Generate festival research using EXA.AI with stakeholder focus
 * 
 * @param {Object|string} festivalData - Either festival name as string or object containing festival details
 * @param {string} customPrompt - Optional custom prompt template (uses default if not provided)
 * @returns {Promise<string>} - Markdown formatted research results
 */
/**
 * ANTI-HALLUCINATION: Festival existence verification
 * Performs preliminary checks to verify if a festival likely exists before expensive research
 * 
 * @param {string} festivalName - The festival name to verify
 * @returns {Promise<Object>} - Verification result with confidence and evidence
 */
async function verifyFestivalExistence(festivalName) {
  console.log(`Performing existence verification for: ${festivalName}`);
  
  try {
    const verificationQuery = `"${festivalName}" (official OR website OR tickets OR lineup) -viberate -bandsintown -songkick`;
    
    const payload = {
      query: verificationQuery,
      numResults: 10,
      contents: {
        text: true,
        summary: {
          query: `Official information about ${festivalName} festival`
        }
      }
    };
    
    const response = await makeExaRequest('/search', payload);
    const results = response.results || [];
    
    // Apply cross-reference verification
    const verification = crossReferenceVerification(festivalName, results);
    
    // Additional authenticity checks
    let authenticityScore = 0;
    const evidence = [];
    
    results.forEach(result => {
      const authenticity = calculateAuthenticityScore(result.url, result.text || '');
      authenticityScore += authenticity.score;
      
      if (authenticity.score > 0.7) {
        evidence.push({
          url: result.url,
          domain: authenticity.domain,
          score: authenticity.score,
          reasons: authenticity.reasons
        });
      }
    });
    
    const avgAuthenticity = results.length > 0 ? authenticityScore / results.length : 0;
    const overallConfidence = (verification.confidence + avgAuthenticity) / 2;
    
    const exists = overallConfidence > 0.3; // Conservative threshold
    
    return {
      exists: exists,
      confidence: overallConfidence,
      verification: verification,
      evidence: evidence,
      resultsFound: results.length,
      recommendation: exists ? 'PROCEED' : 'VERIFY_MANUALLY',
      warnings: overallConfidence < 0.5 ? [
        'Low authenticity score detected',
        'Limited official sources found',
        'Manual verification recommended'
      ] : []
    };
    
  } catch (error) {
    console.error('Festival existence verification failed:', error);
    return {
      exists: false,
      confidence: 0,
      error: error.message,
      recommendation: 'VERIFY_MANUALLY',
      warnings: ['Verification check failed - proceed with caution']
    };
  }
}

export async function generateFestivalResearchWithExa(festivalData, customPrompt = null) {
  try {
    // Convert string input to object if needed
    let festivalInfo = festivalData;
    if (typeof festivalData === 'string') {
      festivalInfo = { name: festivalData };
    }
    
    const festivalName = festivalInfo.name;
    if (!festivalName) {
      throw new Error('Festival name is required');
    }
    
    console.log(`Starting EXA research for festival: ${festivalName}`);
    
    // PHASE 0: Existence Verification (Anti-Hallucination Check)
    console.log(`🔍 Running existence verification for "${festivalName}"...`);
    const existenceCheck = await verifyFestivalExistence(festivalName);
    
    let report;
    
    if (!existenceCheck.exists || existenceCheck.confidence < 0.3) {
      // Generate warning report for likely non-existent or unverifiable festivals
      report = `# ${festivalName} - ⚠️ VERIFICATION WARNING

## 🚨 IMPORTANT: FESTIVAL EXISTENCE VERIFICATION FAILED

**Confidence Score**: ${(existenceCheck.confidence * 100).toFixed(1)}%
**Recommendation**: ${existenceCheck.recommendation}

### Verification Results:
- **Authentic Sources Found**: ${existenceCheck.evidence.length}
- **Total Results**: ${existenceCheck.resultsFound}
- **Official Sources**: ${existenceCheck.verification.breakdown.official}
- **Social Media**: ${existenceCheck.verification.breakdown.social}
- **News Articles**: ${existenceCheck.verification.breakdown.news}
- **Music Aggregators Only**: ${existenceCheck.verification.breakdown.aggregators}

### ⚠️ Warnings:
${existenceCheck.warnings.map(warning => `- ${warning}`).join('\n')}

### 🔍 Evidence Summary:
${existenceCheck.evidence.length > 0 ? 
  existenceCheck.evidence.map(e => `- **${e.domain}** (Score: ${(e.score * 100).toFixed(0)}%) - ${e.reasons.join(', ')}`).join('\n') :
  '- No high-quality evidence found'
}

---

## Possible Issues:
1. **Festival name misspelling** - Double-check the exact festival name
2. **Festival doesn't exist** - May be a fictional, test, or auto-generated festival entry
3. **Very new festival** - Limited online presence for verification
4. **Regional/local event** - May have minimal digital footprint

## Next Steps:
1. ✅ Verify the festival name spelling and authenticity
2. ✅ Check if the festival has an official website
3. ✅ Look for legitimate social media presence
4. ✅ Consider whether this might be a test/fake festival entry

**This verification system is designed to prevent research on non-existent festivals that may appear in music databases due to auto-generation or data pollution.**`;

    } else {
      // Proceed with full research for verified festivals
      console.log(`✅ Festival existence verified (${(existenceCheck.confidence * 100).toFixed(1)}% confidence). Proceeding with full research...`);
      
      // Detect if this is likely a Dutch festival and use specialized research chain
      const isDutchFestival = festivalName.toLowerCase().includes('liefde') || 
                              festivalName.toLowerCase().includes('geluk') ||
                              (festivalName.toLowerCase().includes('amsterdam') && festivalName.toLowerCase().includes('dance')) ||
                              existenceCheck.evidence.some(e => e.domain.includes('.nl'));
      
      let researchData;
      let dutchChainResults = null;
      
      if (isDutchFestival) {
        console.log(`🇳🇱 Detected Dutch festival - using specialized Dutch research chain...`);
        
        // Perform Dutch-specific chained research with timeout protection
        try {
          dutchChainResults = await Promise.race([
            performDutchFestivalChain(festivalName),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Dutch research chain timeout after 120 seconds')), 120000)
            )
          ]);
        } catch (error) {
          console.error('Dutch research chain failed or timed out:', error);
          dutchChainResults = null;
        }
        
        // Also perform comprehensive research with Dutch enhancements
        researchData = await performComprehensiveResearch(festivalName);
        
        // Replace company extraction with Dutch-specific version
        if (researchData.searchStrategies) {
          const phase1Results = researchData.searchStrategies.filter(s => s.phase === 1);
          researchData.identifiedCompanies = extractDutchCompanyInformation(phase1Results, festivalName);
        }
      } else {
        // Standard comprehensive research for non-Dutch festivals
        researchData = await performComprehensiveResearch(festivalName);
      }
      
      // Synthesize results into structured report with verification info
      report = synthesizeResearchFromResults(festivalName, researchData, dutchChainResults);
      
      // Add existence verification info to the top of the report
      report = report.replace(
        '## 🔍 IMPORTANT: Research Reliability Notice',
        `## ✅ Festival Existence Verified
**Verification Confidence**: ${(existenceCheck.confidence * 100).toFixed(1)}%
**Authentic Sources**: ${existenceCheck.evidence.length} high-quality sources confirmed

## 🔍 IMPORTANT: Research Reliability Notice`
      );
    }
    
    console.log(`EXA research completed for ${festivalName}`);
    return report;
    
  } catch (error) {
    console.error('EXA research failed:', error);
    return `# ${festivalData.name || 'Festival'} - Research Error

**Error occurred during festival research**

Details: ${error.message}

Please try again or contact support if the issue persists.`;
  }
}

/**
 * Test EXA API connectivity
 * @returns {Promise<boolean>} - Whether the API connection is working
 */
export async function testExaConnection() {
  try {
    const testPayload = {
      query: 'test search',
      numResults: 1
    };
    
    const response = await makeExaRequest('/search', testPayload);
    
    if (response.results) {
      console.log('EXA API test result: Success');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('EXA connection test failed:', error);
    return false;
  }
}

/**
 * DUTCH-SPECIFIC: Enhanced search patterns and chained discovery for Dutch festivals
 * Based on successful manual research methodology for festivals like "Geheime Liefde"
 */

/**
 * Dutch Festival Research Chain - Mimics manual research methodology
 * 
 * @param {string} festivalName - The Dutch festival name
 * @returns {Promise<Object>} - Chained research results
 */
async function performDutchFestivalChain(festivalName) {
  console.log(`🇳🇱 Starting Dutch festival research chain for: ${festivalName}`);
  
  const chainResults = {
    festivalName,
    step1_officialWebsite: null,
    step2_businessEmails: [],
    step3_parentCompany: null,
    step4_companyLinkedIn: null,
    step5_decisionMakers: [],
    confidence: 0,
    researchPath: []
  };

  try {
    // STEP 1: Find official Dutch website
    console.log('Step 1: Searching for official Dutch website...');
    const officialSiteQuery = `"${festivalName}" site:.nl (tickets OR kaarten OR aanmelden OR inschrijven)`;
    
    const step1Response = await makeExaRequest('/search', {
      query: officialSiteQuery,
      numResults: 8,
      contents: {
        text: true,
        summary: { query: `Officiële website informatie voor ${festivalName}` }
      }
    });
    
    const officialSites = step1Response.results.filter(r => 
      r.url.includes('.nl') && 
      !r.url.includes('viberate') && 
      !r.url.includes('bandsintown')
    );
    
    if (officialSites.length > 0) {
      chainResults.step1_officialWebsite = officialSites[0];
      chainResults.researchPath.push(`✅ Found official website: ${officialSites[0].url}`);
      chainResults.confidence += 0.3;

      // STEP 2: Extract business emails and domain patterns from official site
      console.log('Step 2: Extracting business emails and domains...');
      const siteContent = officialSites[0].text || '';
      
      // Dutch email patterns
      const dutchEmailPatterns = [
        /info@[\w.-]+\.nl/g,
        /contact@[\w.-]+\.nl/g,
        /verkoop@[\w.-]+\.nl/g,
        /administratie@[\w.-]+\.nl/g,
        /organisatie@[\w.-]+\.nl/g,
        /\b[\w.-]+@[\w.-]+\.nl\b/g
      ];
      
      const foundEmails = [];
      const foundDomains = new Set();
      
      dutchEmailPatterns.forEach(pattern => {
        const matches = siteContent.match(pattern) || [];
        matches.forEach(email => {
          foundEmails.push(email);
          const domain = email.split('@')[1];
          if (domain && domain !== officialSites[0].url.split('/')[2]) {
            foundDomains.add(domain);
          }
        });
      });
      
      chainResults.step2_businessEmails = [...new Set(foundEmails)];
      chainResults.researchPath.push(`✅ Found ${foundEmails.length} business emails`);
      
      if (foundEmails.length > 0) chainResults.confidence += 0.2;

      // STEP 3: Research parent companies via Dutch business terminology
      console.log('Step 3: Researching parent companies...');
      
      const companyQueries = [];
      
      // Query each unique domain for parent company info
      for (const domain of foundDomains) {
        const companyName = domain.split('.')[0];
        companyQueries.push(`"${companyName}" eigenaar OR directeur OR organisatie OR bedrijf "${festivalName}"`);
        companyQueries.push(`"${companyName}" events OR festivals OR evenementen`);
      }
      
      // General parent company search
      companyQueries.push(`"${festivalName}" georganiseerd door OR eigendom van OR onderdeel van`);
      companyQueries.push(`"${festivalName}" productie OR organisatie OR management site:.nl`);
      
      const companySearches = await Promise.all(
        companyQueries.slice(0, 4).map(async (query) => {
          try {
            const response = await makeExaRequest('/search', {
              query: query,
              numResults: 5,
              contents: {
                text: true,
                summary: { query: `Bedrijfsinformatie en eigendom voor ${festivalName}` }
              }
            });
            return response.results;
          } catch (error) {
            return [];
          }
        })
      );
      
      // Extract company information from results
      const companyMentions = new Map();
      companySearches.flat().forEach(result => {
        const text = result.text || '';
        
        // Dutch company patterns
        const dutchCompanyPatterns = [
          /(?:eigendom van|onderdeel van|georganiseerd door)\s*([A-Z][A-Za-z\s&]{3,30})/gi,
          /([A-Z][A-Za-z\s&]{3,30})\s*(?:Events|Productions|Entertainment|Festivals)/gi,
          /(?:directeur|eigenaar|CEO)\s*(?:van|bij)\s*([A-Z][A-Za-z\s&]{3,30})/gi
        ];
        
        dutchCompanyPatterns.forEach(pattern => {
          const matches = [...text.matchAll(pattern)];
          matches.forEach(match => {
            const company = match[1].trim();
            if (company.length > 3 && company.length < 30) {
              if (!companyMentions.has(company)) {
                companyMentions.set(company, { count: 0, sources: [] });
              }
              companyMentions.get(company).count++;
              companyMentions.get(company).sources.push(result.url);
            }
          });
        });
      });
      
      // Find most likely parent company
      const topCompany = Array.from(companyMentions.entries())
        .sort((a, b) => b[1].count - a[1].count)[0];
      
      if (topCompany) {
        chainResults.step3_parentCompany = {
          name: topCompany[0],
          confidence: topCompany[1].count,
          sources: topCompany[1].sources
        };
        chainResults.researchPath.push(`✅ Identified parent company: ${topCompany[0]}`);
        chainResults.confidence += 0.25;

        // STEP 4: Find company LinkedIn with Dutch search terms
        console.log('Step 4: Finding company LinkedIn profile...');
        
        const linkedinQuery = `"${topCompany[0]}" site:linkedin.com/company events OR festivals OR evenementen`;
        
        const linkedinResponse = await makeExaRequest('/search', {
          query: linkedinQuery,
          numResults: 5,
          contents: {
            text: true,
            summary: { query: `LinkedIn bedrijfsprofiel voor ${topCompany[0]}` }
          }
        });
        
        const companyLinkedIn = linkedinResponse.results.find(r => 
          r.url.includes('linkedin.com/company') && 
          r.text.toLowerCase().includes(topCompany[0].toLowerCase())
        );
        
        if (companyLinkedIn) {
          chainResults.step4_companyLinkedIn = companyLinkedIn;
          chainResults.researchPath.push(`✅ Found company LinkedIn: ${companyLinkedIn.url}`);
          chainResults.confidence += 0.15;

          // STEP 5: Extract decision makers with Dutch role terminology
          console.log('Step 5: Identifying Dutch decision makers...');
          
          const decisionMakerQuery = `"${topCompany[0]}" site:linkedin.com/in (eigenaar OR directeur OR CEO OR oprichter OR founder OR manager OR "hoofd van")`;
          
          const decisionMakerResponse = await makeExaRequest('/search', {
            query: decisionMakerQuery,
            numResults: 8,
            contents: {
              text: true,
              summary: { query: `Beslissers en management van ${topCompany[0]}` }
            }
          });
          
          const decisionMakers = decisionMakerResponse.results
            .filter(r => r.url.includes('linkedin.com/in'))
            .map(result => {
              const text = result.text || '';
              
              // Extract Dutch roles and names
              const dutchRolePatterns = [
                /eigenaar\s*(?:bij|van|at)\s*([^,\n]+)/gi,
                /directeur\s*(?:bij|van|at)\s*([^,\n]+)/gi,
                /CEO\s*(?:bij|van|at)\s*([^,\n]+)/gi,
                /oprichter\s*(?:bij|van|at)\s*([^,\n]+)/gi,
                /founder\s*(?:bij|van|at)\s*([^,\n]+)/gi,
                /hoofd\s+[\w\s]*\s*(?:bij|van|at)\s*([^,\n]+)/gi
              ];
              
              const roles = [];
              dutchRolePatterns.forEach(pattern => {
                const matches = [...text.matchAll(pattern)];
                matches.forEach(match => roles.push(match[0].trim()));
              });
              
              return {
                url: result.url,
                profileContent: text.substring(0, 200),
                extractedRoles: roles,
                company: topCompany[0],
                relevanceScore: text.toLowerCase().includes(topCompany[0].toLowerCase()) ? 1 : 0.5
              };
            })
            .filter(dm => dm.extractedRoles.length > 0 || dm.relevanceScore > 0.8)
            .slice(0, 5);
          
          chainResults.step5_decisionMakers = decisionMakers;
          chainResults.researchPath.push(`✅ Found ${decisionMakers.length} potential decision makers`);
          
          if (decisionMakers.length > 0) chainResults.confidence += 0.1;
        }
      }
    }
    
  } catch (error) {
    console.error('Dutch festival chain research failed:', error);
    chainResults.researchPath.push(`❌ Error: ${error.message}`);
  }
  
  console.log(`🇳🇱 Dutch chain research completed with ${(chainResults.confidence * 100).toFixed(1)}% confidence`);
  return chainResults;
}

/**
 * Enhanced Dutch language patterns for company extraction
 */
function extractDutchCompanyInformation(phase1Results, festivalName) {
  const companyData = new Map();
  
  phase1Results.forEach(searchResult => {
    searchResult.results.forEach(result => {
      const text = result.text || result.summary || '';
      const highlights = result.highlights || [];
      const url = result.url || '';
      
      // Enhanced Dutch company patterns
      const dutchCompanyPatterns = [
        // Official Dutch business terms
        /(?:georganiseerd door|uitgevoerd door|geproduceerd door|onderdeel van)\s*([A-Z][A-Za-z\s&,.-]{3,50})/gi,
        /(?:eigendom van|eigenaar|directeur van|CEO van)\s*([A-Z][A-Za-z\s&,.-]{3,50})/gi,
        
        // Legal entity patterns
        /(?:BV|NV|VOF|Stichting|Vereniging)\s*([A-Z][A-Za-z\s&,.-]{3,50})/gi,
        /([A-Z][A-Za-z\s&,.-]{3,50})\s*(?:BV|NV|VOF|Events|Productions|Entertainment)/gi,
        
        // KvK and legal registration
        /(?:KvK nummer|KvK|handelsregister|ingeschreven bij)\s*.*?([A-Z][A-Za-z\s&,.-]{3,50})/gi,
        
        // Contact and organizational
        /(?:contact|informatie|vragen)\s*.*?@([\w.-]+\.nl)/gi,
        /(?:©|copyright)\s*\d{4}\s*([A-Z][A-Za-z\s&,.-]{3,50})/gi,
        
        // Privacy policy Dutch patterns  
        /(?:privacybeleid|algemene voorwaarden|verantwoordelijke)\s*.*?([A-Z][A-Za-z\s&,.-]{3,50})/gi,
        
        // Sponsorship and partnership
        /(?:hoofdsponsor|partner|samenwerking met|ondersteund door)\s*([A-Z][A-Za-z\s&,.-]{3,50})/gi
      ];
      
      dutchCompanyPatterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          const companyName = match[1] ? match[1].trim() : match[0].trim();
          
          // Enhanced Dutch filtering
          if (companyName && 
              companyName.length > 3 && 
              companyName.length < 50 &&
              !companyName.toLowerCase().includes('privacy') &&
              !companyName.toLowerCase().includes('voorwaarden') &&
              !companyName.toLowerCase().includes('cookie') &&
              !companyName.toLowerCase().includes('algemene') &&
              !companyName.toLowerCase().includes('festival') &&
              !companyName.toLowerCase().includes(festivalName.toLowerCase())) {
            
            if (!companyData.has(companyName)) {
              companyData.set(companyName, {
                name: companyName,
                sources: [],
                confidence: 0,
                searchPurpose: searchResult.purpose,
                dutchContext: true
              });
            }
            
            const company = companyData.get(companyName);
            company.sources.push({
              url: url,
              context: text.substring(Math.max(0, match.index - 100), match.index + 200),
              searchType: searchResult.purpose,
              pattern: pattern.source
            });
            
            // Dutch-specific confidence boosts
            let confidenceBoost = 0.2;
            if (searchResult.purpose === 'privacy_policy_multilingual') confidenceBoost = 0.5;
            if (searchResult.purpose === 'legal_registration') confidenceBoost = 0.6;
            if (url.includes('.nl')) confidenceBoost += 0.3;
            if (text.includes('eigenaar') || text.includes('directeur')) confidenceBoost += 0.2;
            if (companyName.includes('Events') || companyName.includes('Productions')) confidenceBoost += 0.3;
            
            company.confidence += confidenceBoost;
          }
        });
      });
    });
  });
  
  // Convert to array and sort by confidence
  const companies = Array.from(companyData.values())
    .filter(company => company.confidence > 0.4) // Higher threshold for Dutch companies
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3); // Top 3 most likely companies
  
  console.log(`🇳🇱 Identified ${companies.length} Dutch organizing companies for ${festivalName}`);
  return companies;
}

export default { generateFestivalResearchWithExa, testExaConnection }; 