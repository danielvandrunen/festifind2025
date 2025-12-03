'use client';
import { createContext, useState, useContext, useCallback } from 'react';

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  // Deduplicate notifications and add a count for identical messages
  const addNotification = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const timestamp = Date.now();
    
    setNotifications((prev) => {
      // Check if this exact message already exists
      const existingNotification = prev.find(n => n.message === message && n.type === type);
      
      if (existingNotification) {
        // Update the count and timestamp of the existing notification
        return prev.map(n => 
          n.id === existingNotification.id 
            ? { 
                ...n, 
                count: (n.count || 1) + 1, 
                timestamp: timestamp,
                message: message // Keep the original message
              } 
            : n
        );
      } else {
        // Add new notification
        return [...prev, { id, message, type, timestamp, count: 1 }];
      }
    });
    
    // Set up auto-removal
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
    
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  // Add convenience methods for different notification types
  const showInfo = useCallback((message) => {
    return addNotification(message, 'info');
  }, [addNotification]);

  const showSuccess = useCallback((message) => {
    return addNotification(message, 'success');
  }, [addNotification]);

  const showError = useCallback((message) => {
    return addNotification(message, 'error');
  }, [addNotification]);

  const showWarning = useCallback((message) => {
    return addNotification(message, 'warning');
  }, [addNotification]);

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        addNotification, 
        removeNotification,
        showInfo,
        showSuccess,
        showError,
        showWarning
      }}
    >
      {children}
      
      {/* Render notifications - now positioned at bottom-left with smaller size */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2" style={{ maxWidth: '20%' }}>
        {notifications.map((notification) => (
          <div 
            key={notification.id} 
            className={`p-2 rounded shadow-lg text-sm ${
              notification.type === 'error' ? 'bg-red-500 text-white' :
              notification.type === 'success' ? 'bg-green-500 text-white' :
              notification.type === 'warning' ? 'bg-yellow-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex-grow">
                {notification.message}
                {notification.count > 1 && (
                  <span className="ml-1 font-bold">(×{notification.count})</span>
                )}
              </div>
              <button 
                className="ml-2 text-white" 
                onClick={() => removeNotification(notification.id)}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;
