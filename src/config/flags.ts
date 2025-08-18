/**
 * Feature Flags Configuration
 * 
 * Controls experimental features and provides safety nets
 * for the stable refresh-based workflow.
 */

export interface FeatureFlags {
  // Real-time UI improvements (default: OFF)
  realtimeUI: boolean;
  
  // Auto-start voting when suggestion phase ends (default: OFF)
  autoStartVoting: boolean;
  
  // Auto-start next round when results phase ends (default: OFF)
  autoNextRound: boolean;
  
  // Timeline blocks feature (default: OFF)
  blocksEnabled: boolean;
  
  // Connection monitoring and watchdog (default: ON for safety)
  connectionWatchdog: boolean;
  
  // Light polling fallback when realtime is off (default: ON for safety)
  lightPolling: boolean;
}

// Default configuration - all experimental features OFF
const DEFAULT_FLAGS: FeatureFlags = {
  realtimeUI: false,
  autoStartVoting: false,
  autoNextRound: false,
  blocksEnabled: false,
  connectionWatchdog: true,
  lightPolling: true,
};

/**
 * Get current feature flags configuration
 * Supports URL parameter overrides for testing (host only)
 */
export function getFeatureFlags(): FeatureFlags {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Allow URL parameter overrides for testing
  const overrides: Partial<FeatureFlags> = {};
  
  // Enable realtime UI with ?rt=1
  if (urlParams.get('rt') === '1') {
    overrides.realtimeUI = true;
  }
  
  // Enable auto voting with ?av=1
  if (urlParams.get('av') === '1') {
    overrides.autoStartVoting = true;
  }
  
  // Enable auto next round with ?ar=1
  if (urlParams.get('ar') === '1') {
    overrides.autoNextRound = true;
  }
  
  // Enable blocks with ?blocks=1
  if (urlParams.get('blocks') === '1') {
    overrides.blocksEnabled = true;
  }
  
  // Disable watchdog with ?watchdog=0 (for testing)
  if (urlParams.get('watchdog') === '0') {
    overrides.connectionWatchdog = false;
  }
  
  // Disable polling with ?polling=0 (for testing)
  if (urlParams.get('polling') === '0') {
    overrides.lightPolling = false;
  }
  
  return {
    ...DEFAULT_FLAGS,
    ...overrides,
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return getFeatureFlags()[feature];
}

/**
 * Development helper - show current flags in console
 */
export function debugFlags(): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('🚩 Feature Flags:', getFeatureFlags());
  }
}