// User ID hashing is performed client-side in this example for simplicity.
// In production, user IDs should be hashed server side and sent to the client.
// The signing secret should never be sent to or stored on the client.

import crypto from 'crypto-js';

const signingSecret = 'fake-signing-secret'; // would be a real secret stored SERVER-SIDE in production

export const createUserIdVerification = (userId: string): string | undefined =>
  signingSecret
    ? crypto.HmacSHA256(userId, signingSecret).toString()
    : undefined;
