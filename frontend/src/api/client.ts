import { useEffect, useState } from 'react'

// Responses are immutable for a given URL (the backend serves a fixed snapshot),
// so a promise cache makes tab switches and back/forward instant.
const cache = new Map<string, Promise<unknown>>()

function load<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined
  if (!p) {
    p = fetch(url).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => null)
        throw new Error(body?.detail ?? `${r.status} ${r.statusText}`)
      }
      return r.json() as Promise<T>
    })
    cache.set(url, p)
    p.catch(() => cache.delete(url))
  }
  return p
}

export interface ApiState<T> {
  data?: T
  error?: string
  loading: boolean
}

/** Fetches `url`; keeps the previous data while a new URL loads so charts don't flash. */
export function useApi<T>(url: string | null): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({ loading: url !== null })

  useEffect(() => {
    if (!url) return
    let alive = true
    setState((s) => ({ ...s, loading: true, error: undefined }))
    load<T>(url)
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e: Error) => alive && setState((s) => ({ ...s, error: e.message, loading: false })))
    return () => {
      alive = false
    }
  }, [url])

  return state
}

export const api = {
  meta: () => '/api/meta',
  decision: (date: string, gate: string) => `/api/decision?decision_date=${date}&gate_time=${gate}`,
  accuracy: (gate: string) => `/api/accuracy?gate_time=${gate}`,
  leadTime: () => '/api/lead-time',
  exportCsv: (gate: string) => `/api/export.csv?gate_time=${gate}`,
}
