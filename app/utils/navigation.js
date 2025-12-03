'use client';

import { useRouter as useNextRouter } from 'next/navigation';

/**
 * A wrapper around Next.js navigation that adds error handling for browser extension issues
 * Specifically handles "Quota exceeded" errors from browser extensions like the one with ID iohjgamcilhbgmhbnllfolmkmmekfmci
 */
export function useRouter() {
  const router = useNextRouter();
  
  const safeNavigate = (path) => {
    try {
      router.push(path);
    } catch (error) {
      // If we get a quota exceeded error or other browser extension error
      if (error.message && error.message.includes('Quota exceeded')) {
        console.warn('Browser extension storage quota exceeded. Falling back to window.location');
        // Fallback to traditional navigation
        window.location.href = path;
      } else {
        // For other errors, either log them or rethrow based on your needs
        console.error('Navigation error:', error);
        // Optional: window.location.href = path; // Ultimate fallback
      }
    }
  };
  
  return {
    ...router,
    push: safeNavigate
  };
} 