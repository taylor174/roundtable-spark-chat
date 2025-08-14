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

export type Proposal = Tables['proposals']['Row'];
export type ProposalInsert = Tables['proposals']['Insert'];

export type Vote = Tables['votes']['Row'];
export type VoteInsert = Tables['votes']['Insert'];

export type Block = Tables['blocks']['Row'];
export type BlockInsert = Tables['blocks']['Insert'];

export interface TableState {
  table: Table | null;
  participants: Participant[];
  currentRound: Round | null;
  proposals: Proposal[];
  votes: Vote[];
  blocks: Block[];
  currentParticipant: Participant | null;
  isHost: boolean;
  timeRemaining: number;
  loading: boolean;
  error: string | null;
}

export interface ProposalWithVotes extends Proposal {
  voteCount: number;
  hasUserVoted: boolean;
}

export interface WinningProposal extends Proposal {
  voteCount: number;
}

export type PhaseType = 'waiting' | 'suggestions' | 'voting' | 'results';
export type TableStatusType = 'waiting' | 'active' | 'ended';
export type RoundStatusType = 'suggestions' | 'voting' | 'results';