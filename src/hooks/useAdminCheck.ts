import { useMemo } from 'react';
import { getOrCreateClientId } from '@/utils/clientId';
import { ADMIN_CONFIG } from '@/constants';

/**
 * Hook to check if current user is an admin
 * Uses client ID to determine admin status
 */
export function useAdminCheck() {
  const isAdmin = useMemo(() => {
    const clientId = getOrCreateClientId();
    
    // Log client ID to console for easy admin setup
    if (process.env.NODE_ENV === 'development') {
      console.log('🔑 Your client ID:', clientId);
      console.log('💡 Add this to ADMIN_CONFIG.ADMIN_CLIENT_IDS in constants/index.ts to become admin');
    }
    
    return ADMIN_CONFIG.ADMIN_CLIENT_IDS.includes(clientId);
  }, []);

  return { isAdmin };
}