import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68b82e06e82c328f0770844d", 
  requiresAuth: true // Ensure authentication is required for all operations
});
