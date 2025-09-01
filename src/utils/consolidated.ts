// Consolidated utility functions for better maintainability and performance

import { APP_CONFIG } from '@/constants';

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

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
 * Validate table code format
 */
export function isValidTableCode(code: string): boolean {
  if (!code) return false;
  const pattern = new RegExp(`^[A-Z0-9]{${APP_CONFIG.CODE_LENGTH}}$`);
  return pattern.test(code);
}

/**
 * Validate display name
 */
export function isValidDisplayName(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 50;
}

/**
 * Validate suggestion text
 */
export function isValidSuggestion(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= APP_CONFIG.MAX_SUGGESTION_LENGTH;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// =============================================================================
// TIME UTILITIES
// =============================================================================

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
  if (!endTime) return 0;
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  const remaining = Math.floor((end - now) / 1000);
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
 * Format duration in human readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours}h ${minutes}m ${secs}s`;
}

/**
 * Get relative time string (e.g., "2 minutes ago")
 */
export function getRelativeTime(timestamp: string): string {
  const now = new Date().getTime();
  const time = new Date(timestamp).getTime();
  const diffInSeconds = Math.floor((now - time) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// =============================================================================
// PHASE AND STATUS UTILITIES
// =============================================================================

/**
 * Get the current phase based on table and round status
 */
export function getCurrentPhase(
  tableStatus: string,
  roundStatus: string | null,
  timeRemaining: number
): 'lobby' | 'suggest' | 'vote' | 'result' {
  if (tableStatus === 'lobby') return 'lobby';
  if (tableStatus === 'closed') return 'result';
  
  if (!roundStatus) return 'lobby';
  
  // Only return phases based on actual database state, don't predict based on timer
  if (roundStatus === 'suggest') return 'suggest';
  if (roundStatus === 'vote') return 'vote';
  
  return 'result';
}

/**
 * Check if phase can be advanced
 */
export function canAdvancePhase(
  currentPhase: string,
  timeRemaining: number,
  isHost: boolean
): boolean {
  if (currentPhase === 'lobby' || currentPhase === 'result') return false;
  if (timeRemaining > 0 && !isHost) return false;
  
  return true;
}

// =============================================================================
// STRING UTILITIES
// =============================================================================

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Generate a slug from text
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Escape HTML characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// =============================================================================
// ARRAY UTILITIES
// =============================================================================

/**
 * Remove duplicates from array
 */
export function removeDuplicates<T>(array: T[], keyFn?: (item: T) => any): T[] {
  if (!keyFn) {
    return [...new Set(array)];
  }
  
  const seen = new Set();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Shuffle array randomly
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Group array by key function
 */
export function groupBy<T, K extends string | number>(
  array: T[], 
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    (groups[key] = groups[key] || []).push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

// =============================================================================
// SECURITY UTILITIES
// =============================================================================

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a host secret
 */
export function generateHostSecret(): string {
  return generateSecureToken(16);
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return escapeHtml(input.trim());
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// =============================================================================
// CONSTANTS
// =============================================================================

export const VALIDATION_MESSAGES = {
  INVALID_CODE: 'Invalid table code format',
  NAME_REQUIRED: 'Display name is required',
  NAME_TOO_LONG: 'Display name must be 50 characters or less',
  SUGGESTION_REQUIRED: 'Suggestion text is required',
  SUGGESTION_TOO_LONG: `Suggestion must be ${APP_CONFIG.MAX_SUGGESTION_LENGTH} characters or less`,
  INVALID_EMAIL: 'Please enter a valid email address'
} as const;

export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000
} as const;