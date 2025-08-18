# Feature Flags & Safety Net System

This system provides a comprehensive safety net to protect the current stable refresh-based workflow while allowing gradual testing of realtime improvements.

## Feature Flags Location

**Main Configuration:** `src/config/flags.ts`

All experimental features are **OFF by default** to ensure stability.

## Available Flags

| Flag | Default | Description |
|------|---------|-------------|
| `realtimeUI` | `false` | Enable real-time UI updates via Supabase subscriptions |
| `autoStartVoting` | `false` | Auto-advance from suggestions to voting phase |
| `autoNextRound` | `false` | Auto-advance to next round after results |
| `blocksEnabled` | `false` | Enable timeline blocks feature |
| `connectionWatchdog` | `true` | Monitor connection health and provide recovery |
| `lightPolling` | `true` | Fallback polling when realtime is disabled |

## URL Parameter Testing (Host Only)

You can temporarily override flags for testing by adding URL parameters:

```
# Enable realtime UI
/t/ABC123?rt=1

# Enable auto voting
/t/ABC123?av=1

# Enable auto next round  
/t/ABC123?ar=1

# Enable blocks feature
/t/ABC123?blocks=1

# Disable watchdog (for testing)
/t/ABC123?watchdog=0

# Disable polling (for testing)
/t/ABC123?polling=0

# Combine multiple flags
/t/ABC123?rt=1&av=1&blocks=1
```

## Safety Net Features

### 1. Connection Watchdog
- **Monitors:** Real-time update health during active phases
- **Stale Threshold:** 10 seconds without updates → automatic refresh
- **Panic Threshold:** 30 seconds → show panic controls
- **Auto-Recovery:** Attempts lightweight refresh when stale

### 2. Panic Controls (Host Only)
- **Panic Refresh Button:** Appears when connection is critically stale
- **Hard Reload:** `window.location.reload()` for complete reset
- **Visual Indicators:** Clear warnings when connection issues detected

### 3. Light Polling Fallback
- **When Active:** `realtimeUI` is `false` (default state)
- **Interval:** Every 15 seconds during active phases
- **Purpose:** Keeps legacy refresh path working independently

### 4. Dual Path Architecture
- **Legacy Path:** Manual refresh + polling (always available)
- **Realtime Path:** WebSocket subscriptions (opt-in via flags)
- **No Conflicts:** Paths are cleanly separated

## Usage Guidelines

### Current Stable State (All Flags OFF)
```typescript
// All flags default to false - identical to current behavior
realtimeUI: false,
autoStartVoting: false, 
autoNextRound: false,
blocksEnabled: false
```

### Testing New Features
1. **Host opens table with URL params:** `/t/ABC123?rt=1`
2. **Feature activates for that session only**
3. **Other participants see stable behavior**
4. **Safety nets remain active**

### Recovery Scenarios

**Scenario 1: Realtime Stalls**
- Watchdog detects no updates for 10s
- Automatic refresh attempt
- If still stale after 30s → panic button shown

**Scenario 2: Total Connection Loss**
- Host clicks "Panic Refresh" button
- Page performs hard reload
- Returns to stable state

**Scenario 3: Feature Flag Issues**
- Remove URL parameters
- Features automatically revert to OFF
- Legacy path continues working

## Development

### Adding New Flags
1. Add to `FeatureFlags` interface in `flags.ts`
2. Set default value in `DEFAULT_FLAGS`
3. Add URL parameter support if needed
4. Wrap feature code with flag checks

### Flag Usage in Code
```typescript
import { getFeatureFlags, isFeatureEnabled } from '@/config/flags';

// Get all flags
const flags = getFeatureFlags();

// Check specific feature
if (isFeatureEnabled('realtimeUI')) {
  // Realtime feature code
} else {
  // Legacy fallback code
}
```

### Debug Information
In development mode, current flags are displayed in Host Controls panel and console:

```typescript
// Show flags in console (dev only)
import { debugFlags } from '@/config/flags';
debugFlags();
```

## Safety Guarantees

1. **No Breaking Changes:** With all flags OFF, behavior is identical to current stable version
2. **Isolated Testing:** URL params only affect the specific session
3. **Automatic Recovery:** Watchdog ensures system recovers within 10-30 seconds
4. **Manual Override:** Panic button provides immediate escape route
5. **Dual Path Integrity:** Legacy and realtime paths never interfere

## Rollback Plan

If any issues arise:

1. **Immediate:** Remove URL parameters → flags revert to OFF
2. **Session-wide:** Host uses panic refresh button → hard reload
3. **System-wide:** Flags default to OFF, so new sessions are unaffected

This system ensures that experimental features can be safely tested while maintaining the stability of the core refresh-based workflow.