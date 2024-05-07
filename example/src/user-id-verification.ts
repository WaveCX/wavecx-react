// User ID hashing is performed client-side in this example for simplicity.
// In production, user IDs should be hashed server side and sent to the client.
// The signing secret should never be sent to or stored on the client.

import crypto from 'crypto-js';

const signingSecret = import.meta.env.VITE_HASH_SECRET;

export const createUserIdVerification = (userId: string): string | undefined =>
  signingSecret
    ? crypto.HmacSHA256(userId, signingSecret).toString()
    : undefined;
