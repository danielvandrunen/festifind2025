import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names with tailwind-specific merging
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
