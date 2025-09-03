export const APP_CONFIG = {
  DEFAULT_SUGGEST_SEC: 120,
  DEFAULT_VOTE_SEC: 60,
  MAX_SUGGESTION_LENGTH: 1000, // Increased from 200
  CODE_LENGTH: 6,
  TIMER_BUFFER_MS: 1000, // 1 second buffer for timer sync
} as const;

export const PHASES = {
  LOBBY: 'lobby',
  SUGGEST: 'suggest', 
  VOTE: 'vote',
  RESULT: 'result',
} as const;

export const TABLE_STATUS = {
  LOBBY: 'lobby',
  RUNNING: 'running',
  CLOSED: 'closed',
} as const;

export const ROUND_STATUS = {
  LOBBY: 'lobby',
  SUGGEST: 'suggest',
  VOTE: 'vote', 
  RESULT: 'result',
} as const;

// Admin configuration - hardcoded client IDs for admin access
export const ADMIN_CONFIG = {
  ADMIN_CLIENT_IDS: [
    // Add your admin client IDs here - these will be generated on first visit
    // You can find your client ID in browser localStorage under 'table_client_id'
  ] as string[],
} as const;

export const MESSAGES = {
  WAITING_FOR_HOST: "Waiting for host to start the table...",
  SUGGEST_PHASE: "Share your suggestions!",
  VOTE_PHASE: "Vote for your favorite suggestion",
  RESULT_PHASE: "Round complete!",
  TABLE_CLOSED: "Table has ended. Thanks for participating!",
  JOIN_SUCCESS: "Successfully joined the table!",
  SUGGESTION_SUBMITTED: "Suggestion submitted!",
  VOTE_SUBMITTED: "Vote submitted!",
  INVALID_CODE: "Invalid table code",
  NAME_REQUIRED: "Display name is required",
  SUGGESTION_TOO_LONG: `Suggestion must be ${APP_CONFIG.MAX_SUGGESTION_LENGTH} characters or less`,
} as const;