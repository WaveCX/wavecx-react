export type SessionToken = string;

const TOKEN_KEY = '_wcx_st';
const EXPIRATION_KEY = '_wcx_st_exp';

export const storeSessionToken = (token: SessionToken, expiresIn: number) => {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    const expirationDate = new Date(Date.now() + expiresIn * 1000);
    sessionStorage.setItem(EXPIRATION_KEY, expirationDate.toISOString());
  } catch {}
}

export const clearSessionToken = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRATION_KEY);
  } catch {}
};

export const readSessionToken = (): SessionToken | null => {
  try {
    const expirationDateStr = sessionStorage.getItem(EXPIRATION_KEY);
    const expirationDate = expirationDateStr ? new Date(expirationDateStr) : new Date();
    return expirationDate > new Date() ? sessionStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export type InitiateSession = (options: {
  organizationCode: string;
  userId: string;
  userIdVerification?: string;
  userAttributes?: object
}) => Promise<{ sessionToken: string; expiresIn?: number }>;
