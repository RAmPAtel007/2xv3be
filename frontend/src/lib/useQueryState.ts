import { useCallback, useEffect, useState } from 'react'

/** App state lives in the URL (?tab=&date=&gate=) so every view is shareable and bookmarkable. */
export function useQueryState() {
  const [params, setParams] = useState(() => new URLSearchParams(window.location.search))

  useEffect(() => {
    const onPop = () => setParams(new URLSearchParams(window.location.search))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const update = useCallback((patch: Record<string, string | null>, push = false) => {
    const next = new URLSearchParams(window.location.search)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    const url = `${window.location.pathname}?${next.toString()}`
    if (push) window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
    setParams(next)
  }, [])

  return [params, update] as const
}
