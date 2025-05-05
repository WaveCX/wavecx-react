export type SessionToken = string;

export const storeSessionToken = (token: SessionToken) => {
  try {
    sessionStorage.setItem('_wcx_st', token);
  } catch {}
}

export const clearSessionToken = () => {
  try {
    sessionStorage.removeItem('_wcx_st');
  } catch {}
};

export const readSessionToken = (): SessionToken | null => {
  try {
    return sessionStorage.getItem('_wcx_st');
  } catch {
    return null;
  }
}

export type InitiateSession = (options: {
  organizationCode: string;
  userId: string;
  userIdVerification?: string;
  userAttributes?: object
}) => Promise<{ sessionToken: string }>;
