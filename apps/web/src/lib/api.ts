const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : init?.body,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = typeof data.message === 'string' ? data.message : JSON.stringify(data.message ?? data);
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, options);
}

export const apiClient = {
  get: <T>(path: string, token?: string | null) => api<T>(path, { token }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    api<T>(path, { method: 'POST', body, token }),
  patch: <T>(path: string, body?: unknown, token?: string | null) =>
    api<T>(path, { method: 'PATCH', body, token }),
  del: <T>(path: string, token?: string | null) => api<T>(path, { method: 'DELETE', token }),

  /** Multipart file upload (field name "files"). */
  upload: <T>(path: string, files: File[], token?: string | null): Promise<T> => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        let message = res.statusText;
        try {
          const data = await res.json();
          message = typeof data.message === 'string' ? data.message : JSON.stringify(data.message ?? data);
        } catch {
          /* non-JSON */
        }
        throw new ApiError(message, res.status);
      }
      return (await res.json()) as T;
    });
  },
};

/** Wait until a queued job reaches DONE or FAILED. */
export async function waitForJob<T = Record<string, unknown>>(
  jobId: string,
  token?: string | null,
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ status: 'DONE' | 'FAILED'; result?: T; error?: string | null }> {
  const timeout = opts.timeoutMs ?? 120_000;
  const interval = opts.intervalMs ?? 1_000;
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const job = await apiClient.get<{
      status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
      result?: T;
      error?: string | null;
    }>(`/jobs/${jobId}`, token);
    if (job.status === 'DONE') return { status: 'DONE', result: job.result, error: null };
    if (job.status === 'FAILED') return { status: 'FAILED', error: job.error ?? 'unknown error' };
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new ApiError('Job timed out', 504);
}
