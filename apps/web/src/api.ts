// Cliente HTTP: token en el header, ETag para consultas cacheables.
import type { ErrorCode } from '@portlight/shared';

export class ApiError extends Error {
  constructor(public code: ErrorCode | 'network' | 'internal') { super(code); }
}

const TOKEN_KEY = 'pl.token';
let token: string | null = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch { /* sin almacenamiento */ }

export const hasToken = () => !!token;
export const setToken = (t: string | null) => {
  token = t;
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* idem */ }
};

const etags = new Map<string, { etag: string; data: unknown }>();

export const api = async <T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> => {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const cached = method === 'GET' ? etags.get(path) : undefined;
  if (cached) headers['if-none-match'] = cached.etag;
  let r: Response;
  try {
    r = await fetch('/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('network');
  }
  if (r.status === 304 && cached) return cached.data as T;
  const data = await r.json().catch(() => ({ error: 'internal' }));
  if (!r.ok) throw new ApiError((data as { error?: ErrorCode }).error ?? 'internal');
  const etag = r.headers.get('etag');
  if (method === 'GET' && etag) etags.set(path, { etag, data });
  return data as T;
};
