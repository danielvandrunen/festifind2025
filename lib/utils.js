import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * A utility function for conditionally joining class names with support for Tailwind CSS.
 * It uses clsx for conditional class joining and tailwind-merge to handle Tailwind-specific conflicts.
 * 
 * @param {...string|Object|Array} inputs - Class names or conditional objects to be merged
 * @returns {string} - The merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
} 