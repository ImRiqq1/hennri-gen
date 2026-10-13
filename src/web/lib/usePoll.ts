import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

export type PollState<T> =
  | { kind: "loading" }
  | { kind: "ok"; data: T; at: Date }
  | { kind: "error"; message: string }

/** Busca agora e repete a cada `intervalMs` enquanto a aba estiver visível. */
export function usePoll<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [state, setState] = useState<PollState<T>>({ kind: "loading" })
  const fetcherRef = useRef(fetcher)
  useLayoutEffect(() => {
    fetcherRef.current = fetcher
  })

  const run = useCallback(async () => {
    try {
      setState({ kind: "ok", data: await fetcherRef.current(), at: new Date() })
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    void run()
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void run()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [run, intervalMs])

  const refresh = useCallback(() => {
    setState({ kind: "loading" })
    void run()
  }, [run])

  return [state, refresh] as const
}
