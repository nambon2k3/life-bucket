export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? ""

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  const text = await response.text()
  const data = text ? (JSON.parse(text) as { detail?: unknown }) : null
  if (!response.ok) {
    const detail = data?.detail
    const message = typeof detail === "string" ? detail : text || response.statusText
    throw new ApiError(response.status, message)
  }
  return data as T
}
