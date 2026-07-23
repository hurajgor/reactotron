import { getHostFromUrl, getPortFromUrl, getProtocolFromUrl } from "./parseURL"

describe("getHostFromUrl", () => {
  it("should throw when no host is found", () => {
    expect(() => {
      getHostFromUrl("")
    }).toThrow()
  })

  it("should get host from URL without scheme", () => {
    Object.entries({
      localhost: "localhost",
      "127.0.0.1": "127.0.0.1",
      "[::1]": "[::1]",
    }).forEach(([host, url]) => {
      expect(getHostFromUrl(url)).toEqual(host)
    })
    expect(getHostFromUrl("localhost")).toEqual("localhost")
    expect(getHostFromUrl("127.0.0.1")).toEqual("127.0.0.1")
  })

  it("should get the host from URL with http scheme", () => {
    Object.entries({
      localhost: "http://localhost",
      "example.com": "http://example.com",
    }).forEach(([host, url]) => {
      expect(getHostFromUrl(url)).toEqual(host)
    })
  })

  it("should get the host from URL with https scheme", () => {
    Object.entries({
      localhost: "https://localhost",
      "example.com": "https://example.com",
    }).forEach(([host, url]) => {
      expect(getHostFromUrl(url)).toEqual(host)
    })
  })

  it("should get the host from URL and ignore path, port, and query params", () => {
    Object.entries({
      localhost:
        "http://localhost:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&lazy=true&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&app=com.reactotronapp",
      "192.168.1.141":
        "https://192.168.1.141:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&lazy=true&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&app=com.reactotronapp",
    }).forEach(([host, url]) => {
      expect(getHostFromUrl(url)).toEqual(host)
    })
  })

  it("should get the host from an IPv6 URL and ignore path, port, and query params", () => {
    Object.entries({
      "[::1]":
        "http://[::1]:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&lazy=true&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&app=com.reactotronapp",
      "[2001:0db8:85a3:0000:0000:8a2e:0370:7334]":
        "https://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&lazy=true&minify=false&inlineSourceMap=false&modulesOnly=false&runModule=true&app=com.reactotronapp",
    }).forEach(([host, url]) => {
      expect(getHostFromUrl(url)).toEqual(host)
    })
  })

  it("should get the host from URL with hyphens", () => {
    expect(getHostFromUrl("https://example-app.com")).toEqual("example-app.com")
  })

  it("should throw when the URL is an unsupported scheme", () => {
    expect(() => {
      getHostFromUrl("file:///Users/tron")
    }).toThrow()
  })
})

describe("getPortFromUrl", () => {
  it("gets the port from Metro URLs", () => {
    expect(getPortFromUrl("http://localhost:8081/index.bundle?platform=ios")).toEqual(8081)
    expect(getPortFromUrl("https://[::1]:19000/.expo/.virtual-metro-entry.bundle")).toEqual(19000)
  })

  it("throws when no explicit port is present", () => {
    expect(() => getPortFromUrl("http://localhost/index.bundle")).toThrow()
  })
})

describe("getProtocolFromUrl", () => {
  it("gets explicit HTTP protocols", () => {
    expect(getProtocolFromUrl("http://localhost:8081/index.bundle")).toEqual("http")
    expect(getProtocolFromUrl("https://localhost:8081/index.bundle")).toEqual("https")
  })

  it("returns undefined when the protocol is unavailable", () => {
    expect(getProtocolFromUrl("localhost:8081/index.bundle")).toBeUndefined()
  })
})
