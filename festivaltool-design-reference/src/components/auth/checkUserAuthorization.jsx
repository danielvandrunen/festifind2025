import { base44 } from "@/api/base44Client";

/**
 * Checks if the current user is authenticated AND is a registered team member
 * @returns {Promise<{isAuthorized: boolean, user: object|null, error: string|null}>}
 */
export async function checkUserAuthorization() {
  try {
    console.log('🔐 Checking user authorization...');
    
    // First check if authenticated with timeout
    const isAuthenticatedPromise = base44.auth.isAuthenticated();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Authentication check timeout')), 10000)
    );
    
    const isAuthenticated = await Promise.race([isAuthenticatedPromise, timeoutPromise]);
    console.log('🔐 Is authenticated:', isAuthenticated);
    
    if (!isAuthenticated) {
      return { isAuthorized: false, user: null, error: 'not_authenticated' };
    }

    // Get current authenticated user with timeout
    const currentUserPromise = base44.auth.me();
    const currentUser = await Promise.race([currentUserPromise, timeoutPromise]);
    console.log('🔐 Current user:', currentUser?.email, 'role:', currentUser?.role);
    
    if (!currentUser || !currentUser.email) {
      console.log('❌ No user email found');
      return { isAuthorized: false, user: currentUser, error: 'not_team_member' };
    }

    // Check if user is in the TeamMember list
    console.log('🔐 Checking if user is a registered team member...');
    try {
      const allTeamMembers = await base44.entities.TeamMember.list();
      
      console.log('🔐 Total team members found:', allTeamMembers?.length || 0);
      console.log('🔐 Looking for email:', currentUser.email);
      
      // Find matching active team member
      const matchingMember = allTeamMembers?.find(member => 
        member.email?.toLowerCase() === currentUser.email?.toLowerCase() && 
        member.is_active === true
      );
      
      console.log('🔐 Matching member found:', !!matchingMember);
      
      if (!matchingMember) {
        console.log('❌ User not found in active team members list');
        return { isAuthorized: false, user: currentUser, error: 'not_team_member' };
      }
      
      // User is authenticated AND is an active team member
      console.log('✅ User is authorized team member');
      return { isAuthorized: true, user: currentUser, error: null };
      
    } catch (teamMemberError) {
      console.error('❌ Failed to check team membership:', teamMemberError);
      return { isAuthorized: false, user: currentUser, error: 'team_check_failed' };
    }
    
  } catch (error) {
    console.error("❌ Authorization check failed:", error);
    
    // Check if it's a network error
    if (error.message === 'Network Error' || error.message === 'Authentication check timeout') {
      return { isAuthorized: false, user: null, error: 'network_error' };
    }
    
    // Try to get basic auth info
    try {
      const isAuthenticated = await base44.auth.isAuthenticated();
      if (isAuthenticated) {
        const user = await base44.auth.me();
        return { isAuthorized: false, user: user, error: 'not_team_member' };
      }
    } catch (e) {
      // Ignore
    }
    
    return { isAuthorized: false, user: null, error: 'check_failed' };
  }
}