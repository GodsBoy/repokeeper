import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifySignature } from '../src/webhook/verify.js';

function sign(payload: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');
}

describe('verifySignature', () => {
  const secret = 'test-secret';
  const payload = '{"action":"opened"}';

  it('accepts a valid signature', () => {
    const signature = sign(payload, secret);
    expect(verifySignature(payload, signature, secret)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    expect(verifySignature(payload, 'sha256=invalid', secret)).toBe(false);
  });

  it('rejects empty signature', () => {
    expect(verifySignature(payload, '', secret)).toBe(false);
  });

  it('rejects empty secret', () => {
    const signature = sign(payload, secret);
    expect(verifySignature(payload, signature, '')).toBe(false);
  });

  it('rejects signature with wrong prefix', () => {
    const hash = createHmac('sha256', secret).update(payload).digest('hex');
    expect(verifySignature(payload, 'sha1=' + hash, secret)).toBe(false);
  });

  it('rejects signature for different payload', () => {
    const signature = sign('different payload', secret);
    expect(verifySignature(payload, signature, secret)).toBe(false);
  });
});
