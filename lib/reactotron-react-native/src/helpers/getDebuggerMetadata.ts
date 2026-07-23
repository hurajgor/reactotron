import type { DebuggerJsEngine, DebuggerMetadata } from "@hurajgor/reactotron-core-contract"
import { getHostFromUrl, getPortFromUrl, getProtocolFromUrl } from "./parseURL"

interface DebuggerMetadataOptions {
  platform: string
  reactNativeVersion: string | null
  scriptURL?: unknown
  hermesInternal?: unknown
}

export function getDebuggerMetadata({
  platform,
  reactNativeVersion,
  scriptURL,
  hermesInternal,
}: DebuggerMetadataOptions): DebuggerMetadata {
  const jsEngine: DebuggerJsEngine =
    typeof hermesInternal === "object" && hermesInternal !== null
      ? "hermes"
      : typeof hermesInternal === "undefined"
        ? "jsc"
        : "unknown"

  const metadata: DebuggerMetadata = {
    platform,
    jsEngine,
  }

  if (reactNativeVersion) metadata.reactNativeVersion = reactNativeVersion

  try {
    if (typeof scriptURL !== "string") return metadata

    const metro = {
      host: getHostFromUrl(scriptURL),
      port: getPortFromUrl(scriptURL),
    }
    const protocol = getProtocolFromUrl(scriptURL)
    if (protocol) metadata.metro = { ...metro, protocol }
    else metadata.metro = metro
  } catch {
    // NativeSourceCode can contain a non-Metro URL (for example, a file URL).
  }

  return metadata
}
