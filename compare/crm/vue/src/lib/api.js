import { ref, shallowRef, toValue, watch } from 'vue';

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

/** Load JSON from `url` (a string, ref or getter); refetches when it changes, aborting the old request. Keeps old data while loading. */
export function useFetch(url) {
  const data = shallowRef(undefined);
  const error = shallowRef(null);
  const loading = ref(true);
  const version = ref(0);

  watch([() => toValue(url), version], (_now, _before, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    loading.value = true;
    error.value = null;
    fetchJSON(toValue(url), { signal: controller.signal }).then(
      (value) => {
        data.value = value;
        loading.value = false;
      },
      (err) => {
        if (controller.signal.aborted) return;
        error.value = err;
        loading.value = false;
      }
    );
  }, { immediate: true });

  return { data, error, loading, refetch: () => version.value++ };
}
