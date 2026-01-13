/**
 * Research Quality Metrics
 * 
 * Provides quality scoring and tracking for research results
 */

import type { LinkedInConnection } from './employment-validator';

export interface ResearchQualityScore {
  overall: number; // 0-100
  companyDiscovery: {
    found: boolean;
    confidence: number;
    hasKvK: boolean;
    score: number;
  };
  linkedinConnections: {
    total: number;
    verified: number;
    decisionMakers: number;
    hasCompanyPage: boolean;
    score: number;
  };
  dataCompleteness: {
    hasHomepage: boolean;
    hasCompany: boolean;
    hasLinkedInCompany: boolean;
    hasVerifiedContacts: boolean;
    hasNewsArticles: boolean;
    hasCalendarSources: boolean;
    score: number;
  };
  newsQuality: {
    articleCount: number;
    recentArticles: number;
    score: number;
  };
}

export interface QualityIndicator {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  color: string;
  label: string;
  description: string;
}

/**
 * Calculate comprehensive research quality score
 */
export function calculateQualityScore(data: {
  hasHomepage?: boolean;
  companyName?: string | null;
  companyConfidence?: number;
  hasKvK?: boolean;
  linkedInConnections?: LinkedInConnection[];
  hasCompanyLinkedIn?: boolean;
  newsArticles?: number;
  recentNewsArticles?: number;
  calendarSourcesFound?: number;
}): ResearchQualityScore {
  // Company discovery scoring
  const companyFound = !!data.companyName;
  const companyConfidence = data.companyConfidence || 0;
  const hasKvK = !!data.hasKvK;
  const companyScore = Math.round(
    (companyFound ? 40 : 0) +
    (companyConfidence * 40) +
    (hasKvK ? 20 : 0)
  );

  // LinkedIn connections scoring
  const connections = data.linkedInConnections || [];
  const verifiedCount = connections.filter(c => c.employmentVerified).length;
  const decisionMakerCount = connections.filter(c => c.role === 'decision_maker').length;
  const hasCompanyPage = !!data.hasCompanyLinkedIn;
  
  const linkedinScore = Math.min(100, Math.round(
    (hasCompanyPage ? 20 : 0) +
    (verifiedCount > 0 ? 30 : 0) +
    (decisionMakerCount > 0 ? 25 : 0) +
    (Math.min(connections.length, 10) * 2.5)
  ));

  // Data completeness scoring
  const hasHomepage = !!data.hasHomepage;
  const hasCompany = companyFound;
  const hasLinkedInCompany = hasCompanyPage;
  const hasVerifiedContacts = verifiedCount > 0;
  const hasNewsArticles = (data.newsArticles || 0) > 0;
  const hasCalendarSources = (data.calendarSourcesFound || 0) > 0;
  
  const completenessItems = [
    hasHomepage,
    hasCompany,
    hasLinkedInCompany,
    hasVerifiedContacts,
    hasNewsArticles,
    hasCalendarSources
  ];
  const completenessScore = Math.round(
    (completenessItems.filter(Boolean).length / completenessItems.length) * 100
  );

  // News quality scoring
  const newsArticleCount = data.newsArticles || 0;
  const recentNewsCount = data.recentNewsArticles || 0;
  const newsScore = Math.min(100, Math.round(
    (Math.min(newsArticleCount, 5) * 10) +
    (recentNewsCount > 0 ? 30 : 0) +
    (newsArticleCount > 3 ? 20 : 0)
  ));

  // Calculate overall score with weights
  const weights = {
    company: 0.25,
    linkedin: 0.35,
    completeness: 0.25,
    news: 0.15
  };
  
  const overall = Math.round(
    (companyScore * weights.company) +
    (linkedinScore * weights.linkedin) +
    (completenessScore * weights.completeness) +
    (newsScore * weights.news)
  );

  return {
    overall,
    companyDiscovery: {
      found: companyFound,
      confidence: companyConfidence,
      hasKvK,
      score: companyScore,
    },
    linkedinConnections: {
      total: connections.length,
      verified: verifiedCount,
      decisionMakers: decisionMakerCount,
      hasCompanyPage,
      score: linkedinScore,
    },
    dataCompleteness: {
      hasHomepage,
      hasCompany,
      hasLinkedInCompany,
      hasVerifiedContacts,
      hasNewsArticles,
      hasCalendarSources,
      score: completenessScore,
    },
    newsQuality: {
      articleCount: newsArticleCount,
      recentArticles: recentNewsCount,
      score: newsScore,
    },
  };
}

/**
 * Get quality indicator based on score
 */
export function getQualityIndicator(score: number): QualityIndicator {
  if (score >= 80) {
    return {
      level: 'excellent',
      color: 'text-green-600 bg-green-100',
      label: 'Excellent',
      description: 'High quality research with verified contacts',
    };
  }
  if (score >= 60) {
    return {
      level: 'good',
      color: 'text-blue-600 bg-blue-100',
      label: 'Good',
      description: 'Good research quality with some verified data',
    };
  }
  if (score >= 40) {
    return {
      level: 'fair',
      color: 'text-yellow-600 bg-yellow-100',
      label: 'Fair',
      description: 'Partial data available, needs more research',
    };
  }
  return {
    level: 'poor',
    color: 'text-red-600 bg-red-100',
    label: 'Poor',
    description: 'Limited data, manual verification needed',
  };
}

/**
 * Get improvement suggestions based on quality score
 */
export function getImprovementSuggestions(score: ResearchQualityScore): string[] {
  const suggestions: string[] = [];
  
  if (!score.companyDiscovery.found) {
    suggestions.push('Zoek de organiserende entiteit via privacy policy of KvK');
  } else if (score.companyDiscovery.score < 60) {
    suggestions.push('Verifieer bedrijfsnaam via officiële bronnen');
  }
  
  if (!score.linkedinConnections.hasCompanyPage) {
    suggestions.push('Zoek de LinkedIn bedrijfspagina voor meer contacten');
  }
  
  if (score.linkedinConnections.verified === 0) {
    suggestions.push('Zoek naar medewerkers die expliciet bij het bedrijf werken');
  }
  
  if (score.linkedinConnections.decisionMakers === 0) {
    suggestions.push('Zoek naar directeuren, eigenaren of founders');
  }
  
  if (!score.dataCompleteness.hasNewsArticles) {
    suggestions.push('Zoek recente nieuwsartikelen voor context');
  }
  
  if (!score.dataCompleteness.hasCalendarSources) {
    suggestions.push('Verifieer aanwezigheid op festival kalenders');
  }
  
  return suggestions.slice(0, 3); // Max 3 suggestions
}

/**
 * Format quality score for display
 */
export function formatQualityScoreForDisplay(score: ResearchQualityScore): {
  badge: string;
  details: Array<{ label: string; value: string; score: number }>;
  suggestions: string[];
} {
  const indicator = getQualityIndicator(score.overall);
  const suggestions = getImprovementSuggestions(score);
  
  return {
    badge: `${score.overall}% - ${indicator.label}`,
    details: [
      {
        label: 'Company Discovery',
        value: score.companyDiscovery.found 
          ? `Found (${Math.round(score.companyDiscovery.confidence * 100)}% confidence)`
          : 'Not found',
        score: score.companyDiscovery.score,
      },
      {
        label: 'LinkedIn Connections',
        value: `${score.linkedinConnections.verified}/${score.linkedinConnections.total} verified`,
        score: score.linkedinConnections.score,
      },
      {
        label: 'Data Completeness',
        value: `${Math.round(score.dataCompleteness.score)}%`,
        score: score.dataCompleteness.score,
      },
      {
        label: 'News Coverage',
        value: `${score.newsQuality.articleCount} articles`,
        score: score.newsQuality.score,
      },
    ],
    suggestions,
  };
}
