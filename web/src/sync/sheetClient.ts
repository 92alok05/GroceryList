import type { GroceryItem } from '../domain/item'
import { coerceRemoteItem, toRemote, type RemoteItem } from './remote'

export type SyncErrorKind = 'notConfigured' | 'invalidURL' | 'server' | 'transport'

export class SyncError extends Error {
  constructor(
    readonly kind: SyncErrorKind,
    message: string,
  ) {
    super(message)
  }
}

export const NOT_CONFIGURED_MESSAGE =
  "Sync isn't configured yet. Enter your Web App URL and secret in Settings."

export interface ClientConfig {
  webAppURL: string
  sharedSecret: string
}

const TIMEOUT_MS = 30_000

function endpoint(config: ClientConfig): URL {
  let url: URL
  try {
    url = new URL(config.webAppURL.trim())
  } catch {
    throw new SyncError('invalidURL', 'The Web App URL is not valid.')
  }
  // The shared secret must never travel over plain HTTP.
  if (url.protocol !== 'https:') {
    throw new SyncError('invalidURL', 'The Web App URL must start with https://')
  }
  return url
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw new SyncError('transport', error instanceof Error ? error.message : 'Invalid response')
  }
  if (typeof body !== 'object' || body === null) {
    throw new SyncError('transport', 'Unexpected response from server.')
  }
  const record = body as Record<string, unknown>
  if (typeof record.error === 'string') throw new SyncError('server', `Server error: ${record.error}`)
  return record
}

async function request(input: URL, init: RequestInit | undefined, fetchImpl: typeof fetch) {
  try {
    return await readJson(await fetchImpl(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }))
  } catch (error) {
    if (error instanceof SyncError) throw error
    throw new SyncError('transport', error instanceof Error ? error.message : String(error))
  }
}

export function createSheetClient(config: ClientConfig, fetchImpl: typeof fetch = fetch.bind(globalThis)) {
  // Apps Script cannot answer CORS preflights, so POSTs are sent as text/plain
  // ("simple" requests). The script still parses the body as JSON.
  const post = (payload: object) =>
    request(
      endpoint(config),
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, token: config.sharedSecret }),
        redirect: 'follow',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      },
      fetchImpl,
    )

  return {
    async fetchAll(): Promise<RemoteItem[]> {
      const url = endpoint(config)
      url.searchParams.set('action', 'list')
      url.searchParams.set('token', config.sharedSecret)
      const body = await request(
        url,
        { credentials: 'omit', referrerPolicy: 'no-referrer' },
        fetchImpl,
      )
      if (!Array.isArray(body.items)) throw new SyncError('transport', 'Unexpected response from server.')
      return body.items.map(coerceRemoteItem).filter((i): i is RemoteItem => i !== null)
    },
    async upsert(item: GroceryItem): Promise<void> {
      await post({ action: 'upsert', item: toRemote(item) })
    },
    async remove(id: string): Promise<void> {
      await post({ action: 'delete', id })
    },
  }
}

export type SheetClient = ReturnType<typeof createSheetClient>
