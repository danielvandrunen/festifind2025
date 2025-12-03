'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from '../app/utils/navigation';

interface SafeLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * A wrapper around Next.js Link component that adds error handling
 * for browser extension issues during navigation
 */
const SafeLink: React.FC<SafeLinkProps> = ({ 
  href, 
  children, 
  className, 
  onClick,
  ...props 
}) => {
  const router = useRouter();
  
  const handleClick = (e: React.MouseEvent) => {
    // Allow custom onClick to run first if provided
    if (onClick) {
      onClick(e);
    }
    
    // If it's not an external link, handle navigation ourselves
    if (href.startsWith('/')) {
      e.preventDefault();
      try {
        router.push(href);
      } catch (error) {
        console.error('Navigation error handled by SafeLink:', error);
        // Fallback to traditional navigation if Next.js router fails
        window.location.href = href;
      }
    }
    // External links will work normally
  };
  
  return (
    <Link 
      href={href} 
      className={className} 
      onClick={handleClick}
      {...props}
    >
      {children}
    </Link>
  );
};

export default SafeLink; 