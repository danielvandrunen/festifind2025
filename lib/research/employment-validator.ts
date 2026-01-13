/**
 * Employment Validator Service
 * 
 * Validates LinkedIn profiles against company names to verify
 * actual employment connections.
 */

export interface EmploymentVerification {
  isVerified: boolean;
  confidence: number;
  matchType: 'explicit_employment' | 'title_match' | 'company_mention' | 'unverified';
  evidence: string[];
}

export interface LinkedInConnection {
  name: string;
  title?: string;
  url: string;
  company?: string;
  role: 'decision_maker' | 'manager' | 'team_member' | 'unknown';
  employmentVerified: boolean;
  verification?: EmploymentVerification;
  discoveredVia: 'company_employee_search' | 'festival_search' | 'general_search';
}

/**
 * Employment verification patterns ordered by strength
 */
const EMPLOYMENT_PATTERNS = [
  { pattern: /works at/i, type: 'explicit_employment' as const, weight: 1.0 },
  { pattern: /employee at/i, type: 'explicit_employment' as const, weight: 1.0 },
  { pattern: /employed by/i, type: 'explicit_employment' as const, weight: 1.0 },
  { pattern: /director at/i, type: 'explicit_employment' as const, weight: 0.95 },
  { pattern: /ceo at/i, type: 'explicit_employment' as const, weight: 0.95 },
  { pattern: /founder of/i, type: 'explicit_employment' as const, weight: 0.95 },
  { pattern: /owner of/i, type: 'explicit_employment' as const, weight: 0.95 },
  { pattern: /manager at/i, type: 'explicit_employment' as const, weight: 0.9 },
  { pattern: /head of.*at/i, type: 'explicit_employment' as const, weight: 0.9 },
  { pattern: /\bat\b/i, type: 'title_match' as const, weight: 0.7 },
  { pattern: /\bbij\b/i, type: 'title_match' as const, weight: 0.7 }, // Dutch "at"
  { pattern: /\bvan\b/i, type: 'title_match' as const, weight: 0.6 }, // Dutch "of"
];

/**
 * Role determination patterns
 */
const DECISION_MAKER_PATTERNS = [
  /\b(ceo|founder|owner|eigenaar|directeur|director|managing director|general manager|oprichter|bestuurder|mede-oprichter|co-founder)\b/i,
];

const MANAGER_PATTERNS = [
  /\b(manager|head|lead|hoofd|coordinator|producer|programmer|chef)\b/i,
];

const TEAM_MEMBER_PATTERNS = [
  /\b(festival|event|booking|marketing|production|operations|artist relations|pr|communications)\b/i,
];

/**
 * Verify employment connection for a LinkedIn profile
 */
export function verifyEmployment(
  profileTitle: string,
  profileSnippet: string,
  companyName: string
): EmploymentVerification {
  const evidence: string[] = [];
  const companyLower = companyName.toLowerCase();
  const text = `${profileTitle} ${profileSnippet}`;
  const textLower = text.toLowerCase();
  
  // Check if company name is mentioned at all
  if (!textLower.includes(companyLower)) {
    return {
      isVerified: false,
      confidence: 0,
      matchType: 'unverified',
      evidence: ['Company name not found in profile'],
    };
  }
  
  evidence.push(`Company name "${companyName}" found in profile`);
  
  let bestMatch: { type: EmploymentVerification['matchType']; weight: number } | null = null;
  
  // Check employment patterns with company context
  for (const { pattern, type, weight } of EMPLOYMENT_PATTERNS) {
    // Create a pattern that looks for the employment phrase near the company name
    const employmentPhrase = text.match(pattern);
    if (employmentPhrase) {
      // Check if company name is mentioned within reasonable proximity
      const patternIndex = textLower.indexOf(employmentPhrase[0].toLowerCase());
      const companyIndex = textLower.indexOf(companyLower);
      const distance = Math.abs(patternIndex - companyIndex);
      
      // If company is mentioned within 50 characters of employment phrase
      if (distance < 50) {
        evidence.push(`Matched: "${employmentPhrase[0]}" near company name`);
        if (!bestMatch || weight > bestMatch.weight) {
          bestMatch = { type, weight };
        }
      }
    }
  }
  
  // Fallback: if company is mentioned but no clear employment pattern
  if (!bestMatch && textLower.includes(companyLower)) {
    return {
      isVerified: false,
      confidence: 0.4,
      matchType: 'company_mention',
      evidence: [...evidence, 'Company mentioned but no clear employment indicator'],
    };
  }
  
  if (bestMatch) {
    return {
      isVerified: bestMatch.weight >= 0.7,
      confidence: bestMatch.weight,
      matchType: bestMatch.type,
      evidence,
    };
  }
  
  return {
    isVerified: false,
    confidence: 0,
    matchType: 'unverified',
    evidence: ['No employment patterns matched'],
  };
}

/**
 * Determine role based on job title
 */
export function determineRole(jobTitle?: string): LinkedInConnection['role'] {
  if (!jobTitle) return 'unknown';
  
  // Check decision makers first (highest priority)
  for (const pattern of DECISION_MAKER_PATTERNS) {
    if (pattern.test(jobTitle)) {
      return 'decision_maker';
    }
  }
  
  // Check managers
  for (const pattern of MANAGER_PATTERNS) {
    if (pattern.test(jobTitle)) {
      return 'manager';
    }
  }
  
  // Check team members
  for (const pattern of TEAM_MEMBER_PATTERNS) {
    if (pattern.test(jobTitle)) {
      return 'team_member';
    }
  }
  
  return 'unknown';
}

/**
 * Parse LinkedIn profile from search result
 */
export function parseLinkedInProfile(
  url: string,
  title: string,
  snippet: string,
  companyName?: string
): Omit<LinkedInConnection, 'discoveredVia'> | null {
  if (!url?.includes('linkedin.com/in/')) return null;
  
  // Parse name from title (format: "Name - Title | LinkedIn")
  const nameMatch = title.match(/^([^-–|]+)/);
  const name = nameMatch ? nameMatch[1].trim() : '';
  if (!name) return null;
  
  // Parse job title
  const titleMatch = title.match(/[-–|]\s*(.+?)(?:\s*[-–|]|$)/);
  const jobTitle = titleMatch ? titleMatch[1].trim().replace(/ \| LinkedIn$/, '') : undefined;
  
  // Verify employment if company name provided
  let verification: EmploymentVerification | undefined;
  let employmentVerified = false;
  
  if (companyName) {
    verification = verifyEmployment(title, snippet, companyName);
    employmentVerified = verification.isVerified;
  }
  
  return {
    name,
    title: jobTitle,
    url,
    company: companyName,
    role: determineRole(jobTitle),
    employmentVerified,
    verification,
  };
}

/**
 * Sort LinkedIn connections by relevance
 */
export function sortConnectionsByRelevance(connections: LinkedInConnection[]): LinkedInConnection[] {
  const roleOrder = { decision_maker: 0, manager: 1, team_member: 2, unknown: 3 };
  
  return [...connections].sort((a, b) => {
    // Verified employees first
    if (a.employmentVerified && !b.employmentVerified) return -1;
    if (!a.employmentVerified && b.employmentVerified) return 1;
    
    // Then by role priority
    const roleComparison = roleOrder[a.role] - roleOrder[b.role];
    if (roleComparison !== 0) return roleComparison;
    
    // Then by verification confidence
    const confA = a.verification?.confidence || 0;
    const confB = b.verification?.confidence || 0;
    return confB - confA;
  });
}

/**
 * Filter connections to only verified ones
 */
export function getVerifiedConnections(connections: LinkedInConnection[]): LinkedInConnection[] {
  return connections.filter(c => c.employmentVerified);
}

/**
 * Group connections by role
 */
export function groupConnectionsByRole(connections: LinkedInConnection[]): {
  decisionMakers: LinkedInConnection[];
  managers: LinkedInConnection[];
  teamMembers: LinkedInConnection[];
  other: LinkedInConnection[];
} {
  return {
    decisionMakers: connections.filter(c => c.role === 'decision_maker'),
    managers: connections.filter(c => c.role === 'manager'),
    teamMembers: connections.filter(c => c.role === 'team_member'),
    other: connections.filter(c => c.role === 'unknown'),
  };
}
