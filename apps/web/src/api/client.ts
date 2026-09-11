import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true,
  xsrfCookieName: 'csrf_token',
  xsrfHeaderName: 'X-CSRF-Token',
  timeout: 30_000,
});

let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config;
  if (error.response?.status !== 401 || !original || original.url?.includes('/auth/refresh') || original.url?.includes('/auth/login') || (original as { _retried?: boolean })._retried) {
    throw error;
  }
  (original as { _retried?: boolean })._retried = true;
  refreshPromise ??= api.post('/auth/refresh').then(() => undefined).finally(() => { refreshPromise = null; });
  await refreshPromise;
  return api.request(original);
});

export async function ensureCsrf(): Promise<void> { await api.get('/auth/csrf'); }

export function apiMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    return message ?? (error.code === 'ECONNABORTED' ? 'Die Anfrage hat zu lange gedauert.' : 'Die Anfrage ist fehlgeschlagen.');
  }
  return error instanceof Error ? error.message : 'Ein unerwarteter Fehler ist aufgetreten.';
}

export async function download(url: string, filename: string, method: 'get' | 'post' = 'get', data?: unknown): Promise<void> {
  const response = await api.request<Blob>({ url, method, data, responseType: 'blob', timeout: 120_000 });
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
