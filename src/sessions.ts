export type SessionToken = string;

const TOKEN_KEY = '_wcx_st';
const EXPIRATION_KEY = '_wcx_st_exp';

// In-memory fallback when sessionStorage is unavailable
let inMemoryToken: SessionToken | null = null;
let inMemoryExpiration: Date | null = null;

export const storeSessionToken = (token: SessionToken, expiresIn: number) => {
  const expirationDate = new Date(Date.now() + expiresIn * 1000);

  try {
    // Try sessionStorage first
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EXPIRATION_KEY, expirationDate.toISOString());
  } catch (error) {
    // Fallback to in-memory storage
    console.warn('[WaveCx] sessionStorage unavailable (private browsing or blocked). Using in-memory storage - session will not persist across page reloads.', error);
    inMemoryToken = token;
    inMemoryExpiration = expirationDate;
  }
}

export const clearSessionToken = () => {
  // Clear in-memory storage
  inMemoryToken = null;
  inMemoryExpiration = null;

  try {
    // Try to clear sessionStorage
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRATION_KEY);
  } catch (error) {
    // sessionStorage not available, but in-memory already cleared
    console.warn('[WaveCx] sessionStorage unavailable, cleared in-memory session.', error);
  }
};

export const readSessionToken = (): SessionToken | null => {
  try {
    // Try sessionStorage first
    const expirationDateStr = sessionStorage.getItem(EXPIRATION_KEY);
    const expirationDate = expirationDateStr ? new Date(expirationDateStr) : new Date();

    if (expirationDate > new Date()) {
      return sessionStorage.getItem(TOKEN_KEY);
    }

    // Token expired, clear it
    clearSessionToken();
    return null;
  } catch {
    // Fallback to in-memory storage
    if (inMemoryExpiration && inMemoryExpiration > new Date()) {
      return inMemoryToken;
    }

    // Token expired or not set, clear it
    inMemoryToken = null;
    inMemoryExpiration = null;
    return null;
  }
}

export type InitiateSession = (options: {
  organizationCode: string;
  userId: string;
  userIdVerification?: string;
  userAttributes?: object
}) => Promise<{ sessionToken: string; expiresIn?: number }>;
