import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;

  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');

  if (expected.length !== signature.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
