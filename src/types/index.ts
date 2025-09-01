import { Database } from '@/integrations/supabase/types';

export type Tables = Database['public']['Tables'];

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

export type Block = Tables['blocks']['Row'] & {
  winnerName?: string;
};
export type BlockInsert = Tables['blocks']['Insert'];

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
  authorName: string;
}

export interface WinningSuggestion extends Suggestion {
  voteCount: number;
}

export type PhaseType = 'lobby' | 'suggest' | 'vote' | 'result';
export type TableStatusType = 'lobby' | 'running' | 'closed';
export type RoundStatusType = 'lobby' | 'suggest' | 'vote' | 'result';