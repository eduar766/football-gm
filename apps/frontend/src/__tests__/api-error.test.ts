import { describe, it, expect } from 'vitest';
import { ApiError } from '../api-error';

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const err = new ApiError(404, null, 'Not found');
    expect(err).toBeInstanceOf(Error);
  });

  it('exposes status and body on the instance', () => {
    const body = { message: 'Forbidden' };
    const err = new ApiError(403, body, 'Forbidden');
    expect(err.status).toBe(403);
    expect(err.body).toBe(body);
  });

  it('sets name to ApiError', () => {
    const err = new ApiError(500, null, 'Server error');
    expect(err.name).toBe('ApiError');
  });

  it('message is accessible via .message', () => {
    const err = new ApiError(400, null, 'Bad input');
    expect(err.message).toBe('Bad input');
  });
});
