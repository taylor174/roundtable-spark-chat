export const APP_CONFIG = {
  DEFAULT_SUGGESTION_SECONDS: 120,
  DEFAULT_VOTING_SECONDS: 60,
  MAX_SUGGESTION_LENGTH: 200,
  CODE_LENGTH: 6,
  TIMER_BUFFER_MS: 1000, // 1 second buffer for timer sync
} as const;

export const PHASES = {
  WAITING: 'waiting',
  SUGGESTIONS: 'suggestions', 
  VOTING: 'voting',
  RESULTS: 'results',
} as const;

export const TABLE_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  ENDED: 'ended',
} as const;

export const ROUND_STATUS = {
  SUGGESTIONS: 'suggestions',
  VOTING: 'voting', 
  RESULTS: 'results',
} as const;

export const MESSAGES = {
  WAITING_FOR_HOST: "Waiting for host to start the table...",
  SUGGESTION_PHASE: "Share your suggestions!",
  VOTING_PHASE: "Vote for your favorite suggestion",
  RESULTS_PHASE: "Round complete!",
  TABLE_ENDED: "Table has ended. Thanks for participating!",
  JOIN_SUCCESS: "Successfully joined the table!",
  SUGGESTION_SUBMITTED: "Suggestion submitted!",
  VOTE_SUBMITTED: "Vote submitted!",
  INVALID_CODE: "Invalid table code",
  NAME_REQUIRED: "Display name is required",
  SUGGESTION_TOO_LONG: `Suggestion must be ${APP_CONFIG.MAX_SUGGESTION_LENGTH} characters or less`,
} as const;