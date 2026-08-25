import type { AsyncStorageStatic } from "@react-native-async-storage/async-storage"

export const REACTOTRON_ASYNC_CLIENT_ID = "@REACTOTRON/clientId"

/**
 * The clientId held in memory.
 *
 * AsyncStorage is the durable home for the id, but its writes are async. A
 * reconnect that races a pending write would read back null and re-introduce
 * the client with no id, so the server would mint a fresh GUID and treat the
 * reconnect as a brand new client. Holding the id here keeps it available the
 * moment it is assigned, before storage settles.
 */
let cachedClientId: string | null = null

export async function getClientIdWithFallback(
  asyncStorageHandler: AsyncStorageStatic | undefined,
  buildFallbackId: () => string
): Promise<string> {
  if (asyncStorageHandler) {
    const storedClientId = await asyncStorageHandler.getItem(REACTOTRON_ASYNC_CLIENT_ID)
    if (storedClientId) {
      cachedClientId = storedClientId
      return storedClientId
    }
  }

  // an assigned id whose write has not settled yet still identifies this client
  if (cachedClientId) return cachedClientId

  cachedClientId = buildFallbackId()
  return cachedClientId
}

export async function setClientIdWithStorage(
  asyncStorageHandler: AsyncStorageStatic | undefined,
  clientId: string
): Promise<void> {
  // cache first so a reconnect before the write settles still reports this id
  cachedClientId = clientId

  if (asyncStorageHandler) {
    await asyncStorageHandler.setItem(REACTOTRON_ASYNC_CLIENT_ID, clientId)
  }
}

/** @internal test seam - the module-level cache would otherwise leak between tests */
export function __resetClientIdForTests(): void {
  cachedClientId = null
}
