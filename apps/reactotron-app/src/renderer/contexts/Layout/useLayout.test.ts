import { act, renderHook } from "@testing-library/react"

import { startWithCompactSidebarStorageKey } from "../AppPreferences"
import useLayout from "./useLayout"

jest.mock("@hurajgor/reactotron-core-ui", () => ({
  themeStyles: ["kanagawa"],
  themeVariants: {
    kanagawa: { dark: "kanagawaWave", light: "kanagawaLotus" },
  },
}))

describe("contexts/Layout/useLayout", () => {
  afterEach(() => {
    window.localStorage.removeItem(startWithCompactSidebarStorageKey)
  })

  describe("UI Handling", () => {
    it("should toggle the sidebar between expanded and compact", () => {
      window.localStorage.setItem(startWithCompactSidebarStorageKey, "false")

      const { result } = renderHook(() => useLayout())

      expect(result.current.isSideBarOpen).toBeTruthy()
      expect(result.current.sideBarMode).toBe("expanded")

      act(() => {
        result.current.toggleSideBar()
      })

      expect(result.current.isSideBarOpen).toBeTruthy()
      expect(result.current.sideBarMode).toBe("compact")

      act(() => {
        result.current.toggleSideBar()
      })

      expect(result.current.isSideBarOpen).toBeTruthy()
      expect(result.current.sideBarMode).toBe("expanded")
    })

    it("should start with the compact sidebar by default", () => {
      const { result } = renderHook(() => useLayout())

      expect(result.current.isSideBarOpen).toBeTruthy()
      expect(result.current.sideBarMode).toBe("compact")
    })

    it("should start with the compact sidebar when stored preference is enabled", () => {
      window.localStorage.setItem(startWithCompactSidebarStorageKey, "true")

      const { result } = renderHook(() => useLayout())

      expect(result.current.isSideBarOpen).toBeTruthy()
      expect(result.current.sideBarMode).toBe("compact")
    })
  })
})
