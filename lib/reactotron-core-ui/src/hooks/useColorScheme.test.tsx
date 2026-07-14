import { renderHook, act } from "@testing-library/react"
import useColorScheme from "./useColorScheme"

describe("useColorScheme", () => {
  const themeModeStorageKey = "reactotron.themeMode"

  afterEach(() => {
    jest.resetAllMocks()
    window.localStorage.removeItem(themeModeStorageKey)
  })

  it("should return tokyo night by default", () => {
    const { result } = renderHook(() => useColorScheme())
    expect(result.current).toBe("tokyoNight")
  })

  it("should return stored theme preference when one is set", () => {
    window.localStorage.setItem(themeModeStorageKey, "t3Code")

    const { result } = renderHook(() => useColorScheme())
    expect(result.current).toBe("t3Code")
  })

  it("should update when theme preference changes", () => {
    const { result } = renderHook(() => useColorScheme())
    expect(result.current).toBe("tokyoNight")

    act(() => {
      window.localStorage.setItem(themeModeStorageKey, "t3Code")
      window.dispatchEvent(new CustomEvent("reactotron-theme-mode-changed", { detail: "t3Code" }))
    })

    expect(result.current).toBe("t3Code")
  })

  it("should clean up event listener on unmount", () => {
    const removeEventListener = jest.spyOn(window, "removeEventListener")

    const { unmount } = renderHook(() => useColorScheme())
    unmount()

    expect(removeEventListener).toHaveBeenCalledWith(
      "reactotron-theme-mode-changed",
      expect.any(Function)
    )
  })
})
