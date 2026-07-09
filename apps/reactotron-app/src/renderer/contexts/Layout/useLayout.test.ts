import { act, renderHook } from "@testing-library/react"

import useLayout from "./useLayout"

describe("contexts/Layout/useLayout", () => {
  describe("UI Handling", () => {
    it("should toggle the sidebar between expanded and compact", () => {
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
  })
})
