import React, { createContext, useContext, useState } from 'react';
import Notification from '../components/ui/Notification.js';

// Create context
const NotificationContext = createContext(null);

// Custom hook to use the notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Provider component
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  // Add a new notification
  const showNotification = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
    return id;
  };

  // Remove a notification by id
  const hideNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  // Convenience methods
  const showSuccess = (message, duration) => showNotification(message, 'success', duration);
  const showError = (message, duration) => showNotification(message, 'error', duration);
  const showInfo = (message, duration) => showNotification(message, 'info', duration);
  const showWarning = (message, duration) => showNotification(message, 'warning', duration);

  return (
    <NotificationContext.Provider 
      value={{ 
        showNotification, 
        hideNotification, 
        showSuccess, 
        showError, 
        showInfo,
        showWarning 
      }}
    >
      {children}
      {/* Render all active notifications */}
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          message={notification.message}
          type={notification.type}
          duration={notification.duration}
          onClose={() => hideNotification(notification.id)}
        />
      ))}
    </NotificationContext.Provider>
  );
} 