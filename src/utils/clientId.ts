/**
 * Generate or retrieve a persistent client ID for this browser session
 */
export function getOrCreateClientId(): string {
  const STORAGE_KEY = 'table_client_id';
  
  // Try to get existing client ID from localStorage
  let clientId = localStorage.getItem(STORAGE_KEY);
  
  if (!clientId) {
    // Generate new UUID for this client
    clientId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, clientId);
  }
  
  return clientId;
}

/**
 * Store host secret in localStorage for this table
 */
export function storeHostSecret(tableCode: string, hostSecret: string): void {
  localStorage.setItem(`host_secret_${tableCode}`, hostSecret);
}

/**
 * Get host secret from localStorage for this table
 */
export function getHostSecret(tableCode: string): string | null {
  return localStorage.getItem(`host_secret_${tableCode}`);
}

/**
 * Remove host secret from localStorage for this table
 */
export function removeHostSecret(tableCode: string): void {
  localStorage.removeItem(`host_secret_${tableCode}`);
}

/**
 * Check if current user is host for this table
 */
export function isHost(tableCode: string): boolean {
  return getHostSecret(tableCode) !== null;
}