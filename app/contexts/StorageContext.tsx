'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface StorageContextType {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const StorageContext = createContext<StorageContextType | undefined>(undefined);

export const StorageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const getItem = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`Error getting item ${key} from localStorage:`, error);
      
      // If this is a quota error, try to clear some space
      if (error instanceof Error && error.message.includes('Quota')) {
        try {
          // Find items that might be related to browser extensions
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const storageKey = localStorage.key(i);
            if (storageKey && (
              storageKey.includes('extension') || 
              storageKey.includes('jam_') ||
              storageKey.includes('_ephemeral_') ||
              storageKey.includes('host-network-events')
            )) {
              keysToRemove.push(storageKey);
            }
          }
          
          // Remove problematic items
          keysToRemove.forEach(k => {
            try {
              localStorage.removeItem(k);
              console.log(`Removed potentially problematic storage item: ${k}`);
            } catch (e) {
              console.error(`Failed to remove ${k}:`, e);
            }
          });
          
          // Try again after cleaning
          return localStorage.getItem(key);
        } catch (cleanupError) {
          console.error('Failed cleanup attempt:', cleanupError);
          return null;
        }
      }
      
      return null;
    }
  };

  const setItem = (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error setting item ${key} in localStorage:`, error);
      
      // If this is a quota error, try to clear some space
      if (error instanceof Error && error.message.includes('Quota')) {
        try {
          // Remove potentially problematic items first
          for (let i = 0; i < localStorage.length; i++) {
            const storageKey = localStorage.key(i);
            if (storageKey && (
              storageKey.includes('extension') || 
              storageKey.includes('jam_') ||
              storageKey.includes('_ephemeral_') ||
              storageKey.includes('host-network-events')
            )) {
              localStorage.removeItem(storageKey);
              console.log(`Removed potentially problematic storage item: ${storageKey}`);
            }
          }
          
          // Try again after cleaning
          localStorage.setItem(key, value);
        } catch (cleanupError) {
          console.error('Failed cleanup and retry:', cleanupError);
        }
      }
    }
  };

  const removeItem = (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing item ${key} from localStorage:`, error);
    }
  };

  const value = {
    getItem,
    setItem,
    removeItem,
  };

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
};

export const useStorage = (): StorageContextType => {
  const context = useContext(StorageContext);
  if (context === undefined) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return context;
}; 