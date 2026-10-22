import { useCallback, useEffect, useState } from 'react';

export class HttpError extends Error {
  constructor(response, body) {
    super(body?.message ?? `Request failed: ${response.status} ${response.statusText}`.trim());
    this.status = response.status;
    this.body = body;
  }
}

/** fetch() for JSON: sends `json` as the body, parses the reply, throws HttpError for non-2xx. */
export async function fetchJSON(url, { json, method, ...init } = {}) {
  const response = await fetch(url, {
    ...init,
    method: method ?? (json !== undefined ? 'POST' : 'GET'),
    headers: { Accept: 'application/json', ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const text = await response.text();
  let body = text || null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // not JSON: keep the text
  }
  if (!response.ok) throw new HttpError(response, body);
  return body;
}

/** Load JSON from `url`; refetches when the url changes, aborting the previous request. Keeps old data while loading. */
export function useFetch(url) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, error: null, loading: true }));
    fetchJSON(url, { signal: controller.signal }).then(
      (data) => setState({ data, error: null, loading: false }),
      (error) => {
        if (!controller.signal.aborted) setState((s) => ({ ...s, error, loading: false }));
      }
    );
    return () => controller.abort();
  }, [url, version]);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, refetch };
}
