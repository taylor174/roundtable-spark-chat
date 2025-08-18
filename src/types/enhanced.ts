// Enhanced TypeScript interfaces for better type safety and documentation

import { Database } from '@/integrations/supabase/types';

export type Tables = Database['public']['Tables'];

// Core table types
export type Table = Tables['tables']['Row'];
export type TableInsert = Tables['tables']['Insert'];
export type TableUpdate = Tables['tables']['Update'];

export type Participant = Tables['participants']['Row'];
export type ParticipantInsert = Tables['participants']['Insert'];

export type Round = Tables['rounds']['Row'];
export type RoundInsert = Tables['rounds']['Insert'];
export type RoundUpdate = Tables['rounds']['Update'];

export type Suggestion = Tables['suggestions']['Row'];
export type SuggestionInsert = Tables['suggestions']['Insert'];

export type Vote = Tables['votes']['Row'];
export type VoteInsert = Tables['votes']['Insert'];

export type Block = Tables['blocks']['Row'];
export type BlockInsert = Tables['blocks']['Insert'];

// Enhanced interfaces with computed properties
export interface TableState {
  table: Table | null;
  participants: Participant[];
  currentRound: Round | null;
  suggestions: Suggestion[];
  votes: Vote[];
  blocks: Block[];
  currentParticipant: Participant | null;
  clientId: string;
  isHost: boolean;
  timeRemaining: number;
  loading: boolean;
  error: string | null;
}

export interface SuggestionWithVotes extends Suggestion {
  voteCount: number;
  hasUserVoted: boolean;
  voters?: string[]; // Display names of voters
}

export interface WinningSuggestion extends Suggestion {
  voteCount: number;
  percentage?: number;
}

// Phase and status types with better constraints
export type PhaseType = 'lobby' | 'suggest' | 'vote' | 'result';
export type TableStatusType = 'lobby' | 'running' | 'closed';
export type RoundStatusType = 'lobby' | 'suggest' | 'vote' | 'result';

// Real-time subscription types
export interface RealtimePayload<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  errors: string[] | null;
}

// Error handling types
export interface ErrorContext {
  operation?: string;
  component?: string;
  userMessage?: string;
  data?: Record<string, any>;
}

export interface AsyncOperationResult<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}

// Form and validation types
export interface TableFormData {
  title: string;
  description?: string;
  defaultSuggestSec: number;
  defaultVoteSec: number;
  autoAdvance: boolean;
}

export interface JoinFormData {
  displayName: string;
  tableCode: string;
}

// Performance and caching types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Analytics and monitoring types
export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  apiCalls: number;
  errorCount: number;
}

export interface UserSession {
  sessionId: string;
  userId: string;
  startTime: number;
  lastActivity: number;
  isActive: boolean;
}

// Hook configuration types
export interface UseTableStateOptions {
  enableRealtime?: boolean;
  refreshInterval?: number;
  maxRetries?: number;
  enableCaching?: boolean;
}

export interface UseDebounceOptions {
  delay: number;
  maxWait?: number;
  leading?: boolean;
  trailing?: boolean;
}

// Component prop types for better consistency
export interface BaseComponentProps {
  className?: string;
  'data-testid'?: string;
}

export interface TableComponentProps extends BaseComponentProps {
  table: Table;
  participants: Participant[];
  currentRound: Round | null;
  isHost: boolean;
}

export interface RoundComponentProps extends BaseComponentProps {
  round: Round;
  suggestions: SuggestionWithVotes[];
  votes: Vote[];
  currentPhase: PhaseType;
  timeRemaining: number;
}

// Utility function types
export type TableCodeValidator = (code: string) => boolean;
export type DisplayNameValidator = (name: string) => boolean;
export type TimeFormatter = (seconds: number) => string;

// Database operation types
export interface DatabaseOperationOptions {
  retryCount?: number;
  timeout?: number;
  useOptimisticUpdate?: boolean;
}

export interface BatchOperationResult<T> {
  successful: T[];
  failed: Array<{ item: T; error: Error }>;
  totalProcessed: number;
}

// Security and access control types
export interface AccessControlContext {
  userId?: string;
  tableId: string;
  isHost: boolean;
  isParticipant: boolean;
}

export interface SecurityValidationResult {
  isValid: boolean;
  reason?: string;
  requiredRole?: string;
}

// Configuration types
export interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  realtime: {
    enableHeartbeat: boolean;
    heartbeatInterval: number;
    reconnectInterval: number;
  };
  performance: {
    cacheSize: number;
    debounceDelay: number;
    maxRetries: number;
  };
}