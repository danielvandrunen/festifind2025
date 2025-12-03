import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Notification component that shows a floating message
 * @param {Object} props - The component props
 * @param {string} props.message - The notification message
 * @param {string} props.type - The notification type (success, error, info)
 * @param {Function} props.onClose - Function to call when notification is closed
 * @param {number} props.duration - Duration in ms before auto-close (default: 3000)
 */
export default function Notification({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    // Auto-close after duration
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  // Determine background color based on type
  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg text-white ${getBgColor()} max-w-md flex items-center justify-between`}>
      <span>{message}</span>
      <button 
        onClick={onClose} 
        className="ml-4 p-1 hover:bg-white hover:bg-opacity-20 rounded-full"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
} 