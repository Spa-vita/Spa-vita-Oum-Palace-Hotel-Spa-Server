import { createHash } from 'crypto';

const SENSITIVE_PARAM_KEYS = new Set([
  'HASH',
  'hash',
  'storekey',
  'storeKey',
  'CMI_STORE_KEY',
  'email',
  'BillToName',
  'cardholder',
  'MaskedPan',
  'maskedPan',
  'md',
  'cavv',
  'eci',
  'xid',
]);

/** Safe subset for debug logs — never log store key, HASH, email, or card data */
export function redactCmiParamsForLog(
  params: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const lower = key.toLowerCase();
    if (
      SENSITIVE_PARAM_KEYS.has(key) ||
      lower.includes('card') ||
      lower.includes('pan')
    ) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** CMI ver3: sort params, join values with |, append storeKey, SHA512 → base64 */
export function generateCmiHash(
  params: Record<string, string>,
  storeKey: string,
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== 'HASH' && k !== 'encoding' && k !== 'storekey')
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  let hashval = '';
  for (const key of sortedKeys) {
    hashval += `${params[key]}|`;
  }
  hashval += storeKey;

  const digest = createHash('sha512').update(hashval, 'utf8').digest('hex');
  return Buffer.from(digest, 'hex').toString('base64');
}

export function verifyCmiHash(
  params: Record<string, string>,
  storeKey: string,
): boolean {
  const received = params.HASH ?? '';
  if (!received) {
    return false;
  }
  return generateCmiHash(params, storeKey) === received;
}

export function toStringParams(
  body: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) {
      out[key] = String(value);
    }
  }
  return out;
}
