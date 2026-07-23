/**
 * Given a valid http(s) URL, the host for the given URL
 * is returned.
 *
 * @param url {string} URL to extract the host from
 * @returns {string} host of given URL or throws
 */
// Using a capture group to extract the hostname from a URL
export function getHostFromUrl(url: string) {
  // Group 1: http(s)://
  // Group 2: host
  // Group 3: port
  // Group 4: rest
  const host = url.match(/^(?:https?:\/\/)?(\[[^\]]+\]|[^/:\s]+)(?::\d+)?(?:[/?#]|$)/)?.[1]

  if (typeof host !== "string") throw new Error("Invalid URL - host not found")

  return host
}

/**
 * Given a valid http(s) URL with an explicit port, returns that port.
 */
export function getPortFromUrl(url: string) {
  const port = url.match(/^(?:https?:\/\/)?(?:\[[^\]]+\]|[^/:\s]+):(\d+)(?:[/?#]|$)/)?.[1]

  if (typeof port !== "string") throw new Error("Invalid URL - port not found")

  return Number(port)
}

/**
 * Returns the protocol from an http(s) URL when it is explicitly present.
 */
export function getProtocolFromUrl(url: string): "http" | "https" | undefined {
  return url.match(/^(https?):\/\//)?.[1] as "http" | "https" | undefined
}
