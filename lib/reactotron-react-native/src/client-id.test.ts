/**
 * The RN client persists its clientId through AsyncStorage. setClientId only
 * wrote to storage, so a reconnect that raced the pending write read back null
 * and re-introduced itself with no id - the server then minted a fresh GUID
 * every time and never recognised the reconnect as the same client.
 */
import {
  getClientIdWithFallback,
  setClientIdWithStorage,
  __resetClientIdForTests,
} from "./client-id"

const buildFallbackId = () => "device-derived-id"

const getClientId = (asyncStorage: any, _name = "") =>
  getClientIdWithFallback(asyncStorage, buildFallbackId)
const setClientId = (asyncStorage: any, clientId: string) =>
  setClientIdWithStorage(asyncStorage, clientId)

function buildAsyncStorage() {
  const store = new Map<string, string>()

  return {
    store,
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
  }
}

beforeEach(() => {
  __resetClientIdForTests()
})

test("returns the clientId stored in AsyncStorage", async () => {
  const asyncStorage = buildAsyncStorage()
  asyncStorage.store.set("@REACTOTRON/clientId", "stored-id")

  await expect(getClientId(asyncStorage as any, "app")).resolves.toBe("stored-id")
})

test("serves the assigned clientId before the storage write settles", async () => {
  const asyncStorage = buildAsyncStorage()
  let releaseWrite: () => void
  asyncStorage.setItem.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        releaseWrite = resolve
      })
  )

  // the server assigns an id; the storage write has not finished yet
  const pending = setClientId(asyncStorage as any, "assigned-id")

  // a reconnect happening right now must still report the assigned id
  await expect(getClientId(asyncStorage as any, "app")).resolves.toBe("assigned-id")

  releaseWrite!()
  await pending
})

test("keeps serving the assigned clientId across reconnects", async () => {
  const asyncStorage = buildAsyncStorage()

  await setClientId(asyncStorage as any, "assigned-id")

  await expect(getClientId(asyncStorage as any, "app")).resolves.toBe("assigned-id")
  await expect(getClientId(asyncStorage as any, "app")).resolves.toBe("assigned-id")
})

test("falls back to a device-derived id when nothing is stored", async () => {
  const asyncStorage = buildAsyncStorage()

  const clientId = await getClientId(asyncStorage as any, "app")

  // no stored id yet, so a stable device-derived value stands in
  expect(clientId).toBeTruthy()
  expect(typeof clientId).toBe("string")
})

test("reuses the same fallback id when storage stays empty", async () => {
  const asyncStorage = buildAsyncStorage()

  const first = await getClientId(asyncStorage as any, "app")
  const second = await getClientId(asyncStorage as any, "app")

  // a reconnect must not look like a brand new client
  expect(second).toBe(first)
})

test("works without an AsyncStorage handler", async () => {
  const first = await getClientId(undefined, "app")
  const second = await getClientId(undefined, "app")

  expect(first).toBeTruthy()
  expect(second).toBe(first)
})
