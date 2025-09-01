import { APP_CONFIG } from '@/constants';

/**
 * Generate a random table code
 */
export function generateTableCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < APP_CONFIG.CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a secure host token
 */
export function generateHostToken(): string {
  return crypto.randomUUID();
}

/**
 * Format time in mm:ss format
 */
export function formatTime(seconds: number): string {
  // Never show negative time - always show 00:00 when expired
  if (seconds <= 0) return '00:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate time remaining from server timestamp
 */
export function calculateTimeRemaining(endTime: string | null): number {
  if (!endTime || endTime === 'null' || endTime === '') {
    console.log('⏰ calculateTimeRemaining: No valid endTime provided:', endTime);
    return 0;
  }
  
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  
  // Validate the parsed date
  if (isNaN(end)) {
    console.warn('⏰ calculateTimeRemaining: Invalid endTime format:', endTime);
    return 0;
  }
  
  const remaining = Math.max(0, Math.floor((end - now) / 1000));
  
  if (remaining <= 0) {
    console.log('⏰ calculateTimeRemaining: Time expired:', {
      endTime,
      now: new Date(now).toISOString(),
      end: new Date(end).toISOString(),
      remaining
    });
  }
  
  return remaining;
}

/**
 * Check if current time is past the end time
 */
export function isTimeExpired(endTime: string | null): boolean {
  if (!endTime) return false;
  return new Date().getTime() > new Date(endTime).getTime();
}

/**
 * Validate table code format
 */
export function isValidTableCode(code: string): boolean {
  const pattern = new RegExp(`^[A-Z0-9]{${APP_CONFIG.CODE_LENGTH}}$`);
  return pattern.test(code);
}

/**
 * Validate display name
 */
export function isValidDisplayName(name: string): boolean {
  return name.trim().length > 0 && name.trim().length <= 50;
}

/**
 * Validate suggestion text
 */
export function isValidSuggestion(text: string): boolean {
  return text.trim().length > 0 && text.trim().length <= APP_CONFIG.MAX_SUGGESTION_LENGTH;
}

/**
 * Get the current phase based on table and round status
 * CRITICAL FIX: Handle race condition where table is 'running' but no round data exists yet
 */
export function getCurrentPhase(
  tableStatus: string,
  roundStatus: string | null,
  timeRemaining: number
): 'lobby' | 'suggest' | 'vote' | 'result' {
  console.log('🔄 [PHASE-CALC] getCurrentPhase called:', {
    tableStatus,
    roundStatus,
    timeRemaining
  });

  if (tableStatus === 'lobby') return 'lobby';
  if (tableStatus === 'closed') return 'result';
  
  // CRITICAL FIX: If table is 'running' but no round data exists yet, 
  // assume we're in the first phase (suggest) to prevent race condition
  if (tableStatus === 'running' && !roundStatus) {
    console.log('🚨 [RACE-CONDITION-FIX] Table running but no round - assuming suggest phase');
    return 'suggest';
  }
  
  if (!roundStatus) return 'lobby';
  
  // Return phases based on actual database state
  if (roundStatus === 'suggest') return 'suggest';
  if (roundStatus === 'vote') return 'vote';
  
  return 'result';
}

/**
 * Generate a host secret
 */
export function generateHostSecret(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}