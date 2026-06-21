import { TOKEN_STORAGE_KEY } from '../components/AuthContext';

export class HttpResponseError extends Error {
  status: number;
  bodyText: string;

  constructor(message: string, status: number, bodyText = '') {
    super(message);
    this.name = 'HttpResponseError';
    this.status = status;
    this.bodyText = bodyText;
  }
}

export function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function handleUnauthorized(response: Response) {
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.location.reload();
  }
}

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<body') ||
    trimmed.includes('<head')
  );
}

function extractErrorText(body: unknown): string | null {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed || looksLikeHtml(trimmed)) {
      return null;
    }
    return trimmed.replace(/\s+/g, ' ');
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string' &&
    body.error.trim()
  ) {
    return body.error.trim();
  }

  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string' &&
    body.message.trim()
  ) {
    return body.message.trim();
  }

  return null;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (response.status === 401) {
    handleUnauthorized(response);
    throw new Error('Session expired. Please log in again.');
  }

  const rawText = await response.text().catch(() => '');
  let data: unknown = {};

  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      if (response.ok) {
        throw new HttpResponseError('Invalid JSON response', response.status, rawText);
      }
      data = rawText;
    }
  }

  if (!response.ok) {
    const errorMessage = extractErrorText(data) ?? `HTTP ${response.status}`;
    throw new HttpResponseError(errorMessage, response.status, rawText);
  }

  return data as T;
}
