'use client';

import { useEffect } from 'react';

export default function StagewiseToolbarWrapper() {
  useEffect(() => {
    // Only load in development mode
    if (process.env.NODE_ENV === 'development') {
      // Dynamic import to avoid SSR issues
      import('@stagewise/toolbar-next').then(({ StagewiseToolbar }) => {
        import('@stagewise-plugins/react').then(({ ReactPlugin }) => {
          import('react').then((React) => {
            import('react-dom/client').then(({ createRoot }) => {
              // Create container for the toolbar
              const toolbarContainer = document.createElement('div');
              toolbarContainer.id = 'stagewise-toolbar-root';
              document.body.appendChild(toolbarContainer);
              
              // Render the toolbar
              const root = createRoot(toolbarContainer);
              root.render(
                React.createElement(StagewiseToolbar, {
                  config: {
                    plugins: [ReactPlugin]
                  }
                })
              );
            });
          });
        });
      }).catch(err => {
        console.warn('Failed to load stagewise toolbar:', err);
      });
    }
  }, []);

  return null; // This component doesn't render anything visible
} 