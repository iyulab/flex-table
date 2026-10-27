import { describe, it, expect } from 'vitest';
import { growShares } from './column-width.js';

describe('growShares', () => {
  it('divides in proportion, whole pixels, the remainder to the last growing column', () => {
    expect(growShares([0, 1, 2], 100)).toEqual([0, 33, 67]);
    expect(growShares([1, 1, 1], 100).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('gives nothing when there is no spare width or nothing grows', () => {
    expect(growShares([1, 2], 0)).toEqual([0, 0]);
    expect(growShares([1, 2], -40)).toEqual([0, 0]);
    expect(growShares([0, 0], 100)).toEqual([0, 0]);
  });
  it('drops a fraction of a pixel rather than open a scrollbar', () => {
    expect(growShares([1], 99.6)).toEqual([99]);
  });
});
