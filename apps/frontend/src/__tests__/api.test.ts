import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api';
import { TOKEN_KEY } from '../constants';
import { ApiError } from '../api-error';

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.location.href = '';
});

describe('api.req — 401 handling', () => {
  it('redirects to /login and throws ApiError on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 401, statusText: 'Unauthorized' }),
    );
    localStorage.setItem(TOKEN_KEY, 'old-token');

    await expect(api.listGames()).rejects.toThrow(ApiError);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.location.href).toBe('/login');
  });
});

describe('api.req — 4xx/5xx errors', () => {
  it('throws ApiError with status 400 on bad request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Bad Request', { status: 400, statusText: 'Bad Request' }),
    );

    try {
      await api.listGames();
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(400);
    }
  });

  it('throws ApiError with status 500 on server error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    );

    try {
      await api.listGames();
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(500);
    }
  });
});

describe('api.req — successful response', () => {
  it('returns parsed JSON on 200', async () => {
    const mockData = [{ id: 1, name: 'Test Game' }];
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200, statusText: 'OK' }),
    );

    const result = await api.listGames();
    expect(result).toEqual(mockData);
  });

  it('sends Authorization header when token exists', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token-123');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await api.listGames();
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-token-123');
  });
});
