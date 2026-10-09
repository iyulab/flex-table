import { describe, it, expect } from 'vitest';
import { readFailedResponse } from './source-error';

// The example error response of OData JSON Format v4.01 §21 — code · message · target · details · innererror.
// `@iyulab/enterprise` reads the same example in its conformance test; the two parsers keep one rule.
const specExample = {
  error: {
    code: 'err123',
    message: 'Unsupported functionality',
    target: 'query',
    details: [{ code: 'forty-two', target: '$search', message: '$search query option not supported' }],
    innererror: { trace: [], context: {} },
  },
};

const respond = (body: unknown, status: number) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('readFailedResponse — OData JSON Format §21', () => {
  it('reads message, code and each detail (code · message · target)', async () => {
    const failure = await readFailedResponse(respond(specExample, 501));
    expect(failure.status).toBe(501);
    expect(failure.message).toBe('Unsupported functionality');
    expect(failure.code).toBe('err123');
    expect(failure.details).toEqual([{ code: 'forty-two', target: '$search', message: '$search query option not supported' }]);
  });

  it('keeps the whole body, innererror included, only as the raw body', async () => {
    const failure = await readFailedResponse(respond(specExample, 501));
    expect(failure.body).toEqual(specExample);
    expect(Object.keys(failure)).not.toContain('innererror');
  });

  it('drops a detail without a string code and message — and leaves details out when none remain', async () => {
    const failure = await readFailedResponse(respond({ error: { code: 'x', message: 'bad', details: [{ message: 'no code' }] } }, 400));
    expect(failure.details).toBeUndefined();
  });

  it('keeps a non-JSON body as text', async () => {
    const failure = await readFailedResponse(respond('upstream timeout', 502));
    expect(failure.body).toBe('upstream timeout');
    expect(failure.status).toBe(502);
  });
});
