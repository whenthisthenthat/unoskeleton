/**
 * Jest mock for react-native-quick-crypto
 * Uses Node.js built-in crypto module for testing
 */
import { Buffer as NodeBuffer } from "buffer";
import crypto from "crypto";

export const pbkdf2Sync = crypto.pbkdf2Sync;
export const createDecipheriv = crypto.createDecipheriv;
export const createHmac = crypto.createHmac;
export const createHash = crypto.createHash;
export const createCipheriv = crypto.createCipheriv;
export const randomBytes = crypto.randomBytes;
export const Buffer = NodeBuffer;

// Export all crypto functions that might be needed
export default {
  pbkdf2Sync,
  createDecipheriv,
  createHmac,
  createHash,
  createCipheriv,
  randomBytes,
  Buffer,
};
