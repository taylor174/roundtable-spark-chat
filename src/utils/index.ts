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
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate time remaining from server timestamp
 */
export function calculateTimeRemaining(endTime: string): number {
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  const remaining = Math.max(0, Math.floor((end - now) / 1000));
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
 */
export function getCurrentPhase(
  tableStatus: string,
  roundStatus: string | null,
  timeRemaining: number
): 'waiting' | 'suggestions' | 'voting' | 'results' {
  if (tableStatus === 'waiting') return 'waiting';
  if (tableStatus === 'ended') return 'results';
  
  if (!roundStatus) return 'waiting';
  
  if (roundStatus === 'suggestions') return timeRemaining > 0 ? 'suggestions' : 'voting';
  if (roundStatus === 'voting') return timeRemaining > 0 ? 'voting' : 'results';
  
  return 'results';
}