// Web Crypto replacements for bcrypt + Node crypto
// Works natively in Cloudflare Workers (no native modules needed)

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_HASH = 'SHA-256';

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
  const hashHex = bufToHex(new Uint8Array(derived));
  const saltHex = bufToHex(salt);
  return `pbkdf2$${saltHex}$${hashHex}`;
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  // Support legacy bcrypt hashes too (starts with $2b$) — those can't be verified
  // in Workers; if you have existing users you'll need a migration path.
  // For a fresh deployment this is fine.
  if (!stored.startsWith('pbkdf2$')) {
    // If someone migrated existing bcrypt hashes, they won't work in Workers.
    // Throw a clear error rather than silently failing.
    throw new Error('LEGACY_HASH_UNSUPPORTED');
  }
  const [, saltHex, hashHex] = stored.split('$');
  const salt = hexToBuf(saltHex);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
  return bufToHex(new Uint8Array(derived)) === hashHex;
}

export function generateSecureToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bufToHex(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(new Uint8Array(hashBuf));
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g)!;
  return new Uint8Array(pairs.map(b => parseInt(b, 16)));
}
