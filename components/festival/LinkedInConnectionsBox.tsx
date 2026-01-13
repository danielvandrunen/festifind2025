'use client';

import React from 'react';
import { 
  Linkedin, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  User,
  Building2,
  Crown,
  Users,
  UserCircle,
  Shield,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export interface LinkedInConnection {
  name: string;
  title?: string;
  url: string;
  company?: string;
  role: 'decision_maker' | 'manager' | 'team_member' | 'unknown';
  employmentVerified: boolean;
  verification?: {
    isVerified: boolean;
    confidence: number;
    matchType: 'explicit_employment' | 'title_match' | 'company_mention' | 'unverified';
    evidence: string[];
  };
  discoveredVia?: 'company_employee_search' | 'festival_search' | 'general_search';
  validated?: boolean;
}

export interface CompanyLinkedIn {
  url: string;
  name: string;
  description?: string;
  employeeCount?: number;
  verified: boolean;
}

interface LinkedInConnectionsBoxProps {
  connections: LinkedInConnection[];
  companyLinkedIn?: CompanyLinkedIn | null;
  companyName?: string | null;
  isLoading?: boolean;
  onConnectionClick?: (connection: LinkedInConnection) => void;
}

const LinkedInConnectionsBox: React.FC<LinkedInConnectionsBoxProps> = ({
  connections,
  companyLinkedIn,
  companyName,
  isLoading = false,
  onConnectionClick
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [showAll, setShowAll] = React.useState(false);

  // Group connections by role
  const groupedConnections = React.useMemo(() => {
    const groups = {
      decisionMakers: connections.filter(c => c.role === 'decision_maker'),
      managers: connections.filter(c => c.role === 'manager'),
      teamMembers: connections.filter(c => c.role === 'team_member'),
      other: connections.filter(c => c.role === 'unknown'),
    };
    return groups;
  }, [connections]);

  // Count verified connections
  const verifiedCount = connections.filter(c => c.employmentVerified).length;
  const decisionMakerCount = groupedConnections.decisionMakers.length;

  // Get confidence color
  const getConfidenceColor = (connection: LinkedInConnection) => {
    if (!connection.verification) return 'text-gray-400';
    const confidence = connection.verification.confidence;
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-orange-500';
  };

  // Get confidence badge
  const getConfidenceBadge = (connection: LinkedInConnection) => {
    if (!connection.verification) return null;
    const confidence = connection.verification.confidence;
    
    if (confidence >= 0.8) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          <Shield size={10} className="mr-0.5" />
          Verified
        </span>
      );
    }
    if (confidence >= 0.6) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
          Likely
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        Unverified
      </span>
    );
  };

  // Get role icon
  const getRoleIcon = (role: LinkedInConnection['role']) => {
    switch (role) {
      case 'decision_maker':
        return <Crown size={14} className="text-amber-500" />;
      case 'manager':
        return <Users size={14} className="text-blue-500" />;
      case 'team_member':
        return <User size={14} className="text-purple-500" />;
      default:
        return <UserCircle size={14} className="text-gray-400" />;
    }
  };

  // Get role label
  const getRoleLabel = (role: LinkedInConnection['role']) => {
    switch (role) {
      case 'decision_maker': return 'Decision Maker';
      case 'manager': return 'Manager';
      case 'team_member': return 'Team Member';
      default: return 'Contact';
    }
  };

  // Render connection card
  const ConnectionCard: React.FC<{ connection: LinkedInConnection }> = ({ connection }) => (
    <div 
      className="flex items-start space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      onClick={() => onConnectionClick?.(connection)}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getRoleIcon(connection.role)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <a 
            href={connection.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {connection.name}
          </a>
          {connection.employmentVerified && (
            <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
          )}
        </div>
        {connection.title && (
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {connection.title}
          </p>
        )}
        <div className="flex items-center space-x-2 mt-1">
          {getConfidenceBadge(connection)}
          {connection.company && (
            <span className="text-[10px] text-gray-500 truncate">
              @ {connection.company}
            </span>
          )}
        </div>
      </div>
      <a 
        href={connection.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 p-1 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink size={14} className="text-gray-400 hover:text-blue-500" />
      </a>
    </div>
  );

  // Render connection group
  const ConnectionGroup: React.FC<{ 
    title: string; 
    connections: LinkedInConnection[];
    icon: React.ReactNode;
    defaultShow?: number;
  }> = ({ title, connections: groupConnections, icon, defaultShow = 3 }) => {
    if (groupConnections.length === 0) return null;
    
    const displayConnections = showAll ? groupConnections : groupConnections.slice(0, defaultShow);
    const hasMore = groupConnections.length > defaultShow;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          {icon}
          <span>{title}</span>
          <span className="text-gray-400">({groupConnections.length})</span>
        </div>
        <div className="space-y-1.5">
          {displayConnections.map((conn, idx) => (
            <ConnectionCard key={`${conn.url}-${idx}`} connection={conn} />
          ))}
        </div>
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            +{groupConnections.length - defaultShow} more
          </button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-2">
          <Linkedin size={18} className="text-[#0A66C2]" />
          <span className="font-medium text-sm">LinkedIn Connections</span>
        </div>
        <div className="mt-3 flex items-center justify-center py-4">
          <div className="animate-pulse flex space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <Linkedin size={18} className="text-[#0A66C2]" />
          <span className="font-medium text-sm">LinkedIn Connections</span>
          {connections.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full">
              {connections.length}
            </span>
          )}
          {verifiedCount > 0 && (
            <span className="flex items-center text-xs text-green-600">
              <CheckCircle size={12} className="mr-0.5" />
              {verifiedCount} verified
            </span>
          )}
        </div>
        <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Company LinkedIn */}
          {companyLinkedIn && (
            <div className="flex items-center space-x-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Building2 size={16} className="text-blue-600" />
              <div className="flex-1">
                <a 
                  href={companyLinkedIn.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  {companyLinkedIn.name}
                </a>
                {companyLinkedIn.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                    {companyLinkedIn.description}
                  </p>
                )}
              </div>
              {companyLinkedIn.verified && (
                <CheckCircle size={14} className="text-green-500" />
              )}
              <a 
                href={companyLinkedIn.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"
              >
                <ExternalLink size={14} className="text-blue-600" />
              </a>
            </div>
          )}

          {/* No connections message */}
          {connections.length === 0 && !companyLinkedIn && (
            <div className="flex flex-col items-center justify-center py-6 text-gray-500">
              <AlertCircle size={24} className="mb-2 opacity-50" />
              <p className="text-sm">No LinkedIn connections found</p>
              {companyName && (
                <p className="text-xs text-gray-400 mt-1">
                  Searched for employees of: {companyName}
                </p>
              )}
            </div>
          )}

          {/* Decision Makers */}
          <ConnectionGroup
            title="Decision Makers"
            connections={groupedConnections.decisionMakers}
            icon={<Crown size={14} className="text-amber-500" />}
            defaultShow={3}
          />

          {/* Managers */}
          <ConnectionGroup
            title="Managers"
            connections={groupedConnections.managers}
            icon={<Users size={14} className="text-blue-500" />}
            defaultShow={3}
          />

          {/* Team Members */}
          <ConnectionGroup
            title="Team Members"
            connections={groupedConnections.teamMembers}
            icon={<User size={14} className="text-purple-500" />}
            defaultShow={2}
          />

          {/* Other Contacts */}
          <ConnectionGroup
            title="Other Contacts"
            connections={groupedConnections.other}
            icon={<UserCircle size={14} className="text-gray-400" />}
            defaultShow={2}
          />

          {/* Show less button */}
          {showAll && connections.length > 5 && (
            <button
              onClick={() => setShowAll(false)}
              className="text-xs text-gray-500 hover:text-blue-600"
            >
              Show less
            </button>
          )}

          {/* Quality summary */}
          {connections.length > 0 && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Quality Score</span>
                <div className="flex items-center space-x-2">
                  {decisionMakerCount > 0 && (
                    <span className="text-amber-600">{decisionMakerCount} decision makers</span>
                  )}
                  <span className={verifiedCount > 0 ? 'text-green-600' : 'text-gray-400'}>
                    {verifiedCount}/{connections.length} verified
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LinkedInConnectionsBox;
