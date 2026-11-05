import type { GroceryItem } from '../domain/item'
import { coerceRemoteItem, toRemote, type RemoteItem } from './remote'

export type SyncErrorKind = 'notConfigured' | 'invalidURL' | 'server' | 'transport' | 'unauthorized'

export class SyncError extends Error {
  constructor(
    readonly kind: SyncErrorKind,
    message: string,
  ) {
    super(message)
  }
}

export const NOT_CONFIGURED_MESSAGE = "You haven't joined a household yet."
export const SESSION_ENDED_MESSAGE = 'This device is no longer part of the household. Join again to keep syncing.'

export interface ClientConfig {
  webAppURL: string
  deviceToken: string
}

export interface HouseholdSession {
  householdId: string
  householdName: string
  memberId: string
  deviceToken: string
}

const TIMEOUT_MS = 30_000

function endpoint(webAppURL: string): URL {
  let url: URL
  try {
    url = new URL(webAppURL.trim())
  } catch {
    throw new SyncError('invalidURL', 'The server URL is not valid.')
  }
  // Credentials must never travel over plain HTTP.
  if (url.protocol !== 'https:') {
    throw new SyncError('invalidURL', 'The server URL must start with https://')
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
  if (record.error === 'unauthorized') throw new SyncError('unauthorized', SESSION_ENDED_MESSAGE)
  if (typeof record.error === 'string') throw new SyncError('server', record.error)
  return record
}

/**
 * Apps Script cannot answer CORS preflights, so every call is a POST sent as
 * text/plain ("simple" request). Nothing sensitive is ever placed in the URL.
 */
async function post(webAppURL: string, payload: object, fetchImpl: typeof fetch) {
  try {
    const response = await fetchImpl(endpoint(webAppURL), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return await readJson(response)
  } catch (error) {
    if (error instanceof SyncError) throw error
    throw new SyncError('transport', error instanceof Error ? error.message : String(error))
  }
}

export function createSheetClient(config: ClientConfig, fetchImpl: typeof fetch = fetch.bind(globalThis)) {
  const call = (payload: object) => post(config.webAppURL, { ...payload, token: config.deviceToken }, fetchImpl)

  return {
    async fetchAll(): Promise<RemoteItem[]> {
      const body = await call({ action: 'list' })
      if (!Array.isArray(body.items)) throw new SyncError('transport', 'Unexpected response from server.')
      return body.items.map(coerceRemoteItem).filter((i): i is RemoteItem => i !== null)
    },
    async upsert(item: GroceryItem): Promise<void> {
      await call({ action: 'upsert', item: toRemote(item) })
    },
    async remove(id: string): Promise<void> {
      await call({ action: 'delete', id })
    },
    async leave(): Promise<void> {
      await call({ action: 'leave' })
    },
  }
}

export type SheetClient = ReturnType<typeof createSheetClient>

function toSession(body: Record<string, unknown>): HouseholdSession {
  const { householdId, householdName, memberId, deviceToken } = body
  if (![householdId, householdName, memberId, deviceToken].every((v) => typeof v === 'string' && v !== '')) {
    throw new SyncError('transport', 'Unexpected response from server.')
  }
  return body as unknown as HouseholdSession
}

/** Calls that need no session: they exchange a household name + passcode for a device token. */
export function createHouseholdApi(webAppURL: string, fetchImpl: typeof fetch = fetch.bind(globalThis)) {
  return {
    async create(name: string, passcode: string, displayName = ''): Promise<HouseholdSession> {
      return toSession(await post(webAppURL, { action: 'createHousehold', name, passcode, displayName }, fetchImpl))
    },
    async join(name: string, passcode: string, displayName = ''): Promise<HouseholdSession> {
      return toSession(await post(webAppURL, { action: 'joinHousehold', name, passcode, displayName }, fetchImpl))
    },
  }
}

export type HouseholdApi = ReturnType<typeof createHouseholdApi>
