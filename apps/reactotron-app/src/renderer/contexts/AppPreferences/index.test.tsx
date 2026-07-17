import React, { useContext } from "react"
import { renderHook } from "@testing-library/react"

jest.mock("@hurajgor/reactotron-core-ui", () => ({
  themeStyles: ["kanagawa", "everforest", "one"],
  themeVariants: {
    kanagawa: { dark: "kanagawaWave", light: "kanagawaLotus" },
    everforest: { dark: "everforestDark", light: "everforestLight" },
    one: { dark: "oneDarkPro", light: "oneLight" },
  },
}))

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
})

import AppPreferencesContext, {
  AppPreferencesProvider,
  themeAppearanceStorageKey,
  themeModeStorageKey,
  themeStyleStorageKey,
} from "."

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppPreferencesProvider>{children}</AppPreferencesProvider>
)

describe("AppPreferences", () => {
  afterEach(() => {
    window.localStorage.removeItem(themeModeStorageKey)
    window.localStorage.removeItem(themeStyleStorageKey)
    window.localStorage.removeItem(themeAppearanceStorageKey)
  })

  it.each([
    ["tokyoNight", "kanagawa"],
    ["githubDark", "one"],
    ["rosePine", "kanagawa"],
    ["ayuMirage", "everforest"],
  ])("migrates retired %s preferences to a retained dark style", (legacyTheme, themeStyle) => {
    window.localStorage.setItem(themeModeStorageKey, legacyTheme)

    const { result } = renderHook(() => useContext(AppPreferencesContext), { wrapper })

    expect(result.current.themeStyle).toBe(themeStyle)
    expect(result.current.themeAppearance).toBe("dark")
  })
})
