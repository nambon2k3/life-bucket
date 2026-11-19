import { useCallback, useEffect, useState } from "react"

import { api } from "@/lib/api"

export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setData(await api<T>(path))
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, error, loading, reload }
}
